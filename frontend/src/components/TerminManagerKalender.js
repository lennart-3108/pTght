import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function fmtTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

function parseTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getWeekInfo(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const day = (d.getDay() + 6) % 7; // Montag = 0
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - day + 3);
  const weekYear = thursday.getFullYear();
  const firstThursday = new Date(weekYear, 0, 4);
  const week = 1 + Math.round(((thursday - firstThursday) / 86400000 - 3) / 7);
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - day);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    key: `${weekYear}-W${String(week).padStart(2, '0')}`,
    week,
    weekYear,
    weekStartStr: weekStart.toISOString().slice(0, 10),
    weekEndStr: weekEnd.toISOString().slice(0, 10)
  };
}

function fmtWeekRange(startStr, endStr) {
  if (!startStr || !endStr) return '';
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  return `${start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
}

function generateAvailableTimes(startTime, endTime, durationMinutes) {
  if (!startTime || !endTime) return [];
  const times = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const slotEnd = endMinutes - durationMinutes;
  
  for (let m = startMinutes; m <= slotEnd; m += 15) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    times.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return times;
}

export default function TerminManagerKalender({ matchId, token, onClose, onInvitationSent, matchInfo }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [frames, setFrames] = useState([]);
  const [slots, setSlots] = useState([]);
  const [meta, setMeta] = useState(null);
  const [otherAvailability, setOtherAvailability] = useState([]);
  const [myAvailability, setMyAvailability] = useState([]);
  const [proposals, setProposals] = useState([]);

  // Host: neuen Verfügbarkeits-Slot anlegen
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  // Gast: Wunschstart je Frame
  const [customTimes, setCustomTimes] = useState({});
  const [sending, setSending] = useState(false);

  // Modal für Gegner-Verfügbarkeiten
  const [selectedAvailSlot, setSelectedAvailSlot] = useState(null);
  const [proposedTime, setProposedTime] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [timeIndex, setTimeIndex] = useState(0);
  const [rejectingProposal, setRejectingProposal] = useState(null);

  const slotDuration = useMemo(() => {
    const candidate = meta?.slotDurationMinutes ?? meta?.matchDurationMinutes ?? 60;
    const n = Number(candidate);
    return Number.isFinite(n) && n > 0 ? n : 60;
  }, [meta]);

  useEffect(() => {
    if (matchId && token) load();
  }, [matchId, token]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [slotsRes, availRes, terminRes] = await Promise.all([
        fetch(`${API_BASE}/matches/${matchId}/time-slots`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/matches/${matchId}/availability`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/matches/${matchId}/termin-manager`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const slotsData = await slotsRes.json().catch(() => ({}));
      if (!slotsRes.ok) {
        throw new Error(slotsData.error || `HTTP ${slotsRes.status}: Fehler beim Laden`);
      }

      const availData = await availRes.json().catch(() => ({}));
      // availability endpoint is best-effort; do not block UI if it fails
      if (availRes.ok) {
        setOtherAvailability(availData.theirAvailability || []);
        setMyAvailability(availData.myAvailability || []);
      } else {
        setOtherAvailability([]);
        setMyAvailability([]);
      }

      const terminData = await terminRes.json().catch(() => ({}));
      if (terminRes.ok && terminData.proposal) {
        setProposals([terminData.proposal]);
      } else {
        setProposals([]);
      }

      setFrames(slotsData.frames || []);
      setSlots(slotsData.slots || []);
      setMeta(slotsData.meta || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addFrame() {
    setError('');
    if (!newDate || !newStart || !newEnd) {
      setError('Bitte Datum und Zeit ausfüllen');
      return;
    }
    if (newStart >= newEnd) {
      setError('Endzeit muss nach Startzeit liegen');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/time-frames`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ date: newDate, timeStart: newStart, timeEnd: newEnd })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Fehler beim Speichern');
      setShowAddSlot(false);
      setNewDate('');
      setNewStart('');
      setNewEnd('');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  function latestStart(frame) {
    const end = parseTime(frame.date, frame.time_end);
    if (!end) return '';
    const latest = new Date(end.getTime() - slotDuration * 60000);
    if (Number.isNaN(latest.getTime())) return '';
    return `${String(latest.getHours()).padStart(2, '0')}:${String(latest.getMinutes()).padStart(2, '0')}`;
  }

  async function proposeSlot(frame) {
    if (!meta?.canProposeSlots && !meta?.canCreateSlots) {
      setError('Nur der Gast kann eine Anfrage senden.');
      return;
    }
    const chosen = customTimes[frame.id] || fmtTime(frame.time_start);
    const start = parseTime(frame.date, chosen);
    const frameStart = parseTime(frame.date, frame.time_start);
    const frameEnd = parseTime(frame.date, frame.time_end);
    if (!start || !frameStart || !frameEnd) {
      setError('Ungültige Zeitangabe.');
      return;
    }
    const end = new Date(start.getTime() + slotDuration * 60000);
    if (start < frameStart || end > frameEnd) {
      setError('Startzeit liegt außerhalb des Host-Slots.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/time-slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          frameId: frame.id,
          slotStart: start.toISOString(),
          slotEnd: end.toISOString(),
          durationMinutes: slotDuration
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Fehler beim Senden');
      setCustomTimes((prev) => ({ ...prev, [frame.id]: chosen }));
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function acceptSlot(slotId) {
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/time-slots/${slotId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Fehler beim Akzeptieren');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeSlot(slotId) {
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/time-slots/${slotId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Fehler beim Löschen');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  function openAvailSlotModal(slot) {
    setSelectedAvailSlot(slot);
    const times = generateAvailableTimes(slot.time_start, slot.time_end, slotDuration);
    setAvailableTimes(times);
    setTimeIndex(0);
    setProposedTime(times[0] || slot.time_start || '');
    setError('');
  }

  function closeAvailSlotModal() {
    setSelectedAvailSlot(null);
    setProposedTime('');
    setAvailableTimes([]);
    setTimeIndex(0);
    setError('');
    setRejectingProposal(null);
  }

  function prevTime() {
    if (timeIndex > 0) {
      const newIndex = timeIndex - 1;
      setTimeIndex(newIndex);
      setProposedTime(availableTimes[newIndex]);
    }
  }

  function nextTime() {
    if (timeIndex < availableTimes.length - 1) {
      const newIndex = timeIndex + 1;
      setTimeIndex(newIndex);
      setProposedTime(availableTimes[newIndex]);
    }
  }

  function latestStartForAvailSlot(slot) {
    if (!slot || !slot.date || !slot.time_end) return '';
    const end = parseTime(slot.date, slot.time_end);
    if (!end) return '';
    const latest = new Date(end.getTime() - slotDuration * 60000);
    if (Number.isNaN(latest.getTime())) return '';
    return `${String(latest.getHours()).padStart(2, '0')}:${String(latest.getMinutes()).padStart(2, '0')}`;
  }

  async function sendAvailabilityInvitation() {
    if (!selectedAvailSlot || !proposedTime) {
      setError('Bitte eine Startzeit wählen');
      return;
    }
    const start = parseTime(selectedAvailSlot.date, proposedTime);
    const frameStart = parseTime(selectedAvailSlot.date, selectedAvailSlot.time_start);
    const frameEnd = parseTime(selectedAvailSlot.date, selectedAvailSlot.time_end);
    if (!start || !frameStart || !frameEnd) {
      setError('Ungültige Zeitangabe.');
      return;
    }
    const end = new Date(start.getTime() + slotDuration * 60000);
    if (start < frameStart || end > frameEnd) {
      setError('Startzeit liegt außerhalb des Verfügbarkeits-Slots.');
      return;
    }
    setSending(true);
    setError('');
    setSuccess('');
    try {
      // If sending as counter-proposal, reject the original first
      if (rejectingProposal) {
        const rejectRes = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${rejectingProposal}/reject`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!rejectRes.ok) {
          const err = await rejectRes.json().catch(() => ({}));
          throw new Error(err.error || 'Fehler beim Ablehnen');
        }
      }

      const res = await fetch(`${API_BASE}/matches/${matchId}/availability/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          datetime: start.toISOString(),
          durationMinutes: slotDuration
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Fehler beim Senden');
      
      closeAvailSlotModal();
      
      if (rejectingProposal) {
        setSuccess('Gegenvorschlag erfolgreich versendet!');
        setRejectingProposal(null);
        load();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setSuccess('Einladung erfolgreich versendet!');
        if (onInvitationSent) {
          setTimeout(() => onInvitationSent(), 500);
        } else {
          load();
          setTimeout(() => setSuccess(''), 5000);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function acceptProposal(proposalId) {
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Fehler beim Annehmen');
      setSuccess('✅ Termin angenommen! Match-Startdatum wurde gesetzt.');
      load();
      setTimeout(() => setSuccess(''), 5000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function rejectProposal(proposalId, sendCounter = false) {
    if (sendCounter) {
      // User wants to send a counter-proposal
      setRejectingProposal(proposalId);
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Fehler beim Ablehnen');
      setSuccess('Terminvorschlag abgelehnt');
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  function handleCounterProposal(slot) {
    // When user clicks a slot while rejecting, send counter-proposal
    setSelectedAvailSlot(slot);
    // Close rejecting modal will be handled after sending
  }

  const framesByWeek = useMemo(() => {
    const grouped = {};
    (frames || []).forEach((f) => {
      const info = getWeekInfo(f.date);
      if (!info) return;
      if (!grouped[info.key]) grouped[info.key] = { ...info, daysMap: {} };
      if (!grouped[info.key].daysMap[f.date]) grouped[info.key].daysMap[f.date] = [];
      grouped[info.key].daysMap[f.date].push(f);
    });

    return Object.values(grouped)
      .map((w) => ({
        ...w,
        days: Object.entries(w.daysMap)
          .map(([date, arr]) => ({ date, frames: arr.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')) }))
          .sort((a, b) => a.date.localeCompare(b.date))
      }))
      .sort((a, b) => (a.weekStartStr || '').localeCompare(b.weekStartStr || ''));
  }, [frames]);

  const otherAvailabilityByWeek = useMemo(() => {
    const grouped = {};
    (otherAvailability || []).forEach((day) => {
      const info = getWeekInfo(day.date);
      if (!info) return;
      if (!grouped[info.key]) grouped[info.key] = { ...info, daysMap: {} };
      if (!grouped[info.key].daysMap[day.date]) grouped[info.key].daysMap[day.date] = [];
      (day.windows || []).forEach((w, idx) => {
        grouped[info.key].daysMap[day.date].push({
          id: w.id || `${day.date}-${idx}`,
          date: day.date,
          time_start: w.timeStart,
          time_end: w.timeEnd
        });
      });
    });

    return Object.values(grouped)
      .map((w) => ({
        ...w,
        days: Object.entries(w.daysMap)
          .map(([date, arr]) => ({ date, frames: arr.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')) }))
          .sort((a, b) => a.date.localeCompare(b.date))
      }))
      .filter((w) => w.days.length > 0)
      .sort((a, b) => (a.weekStartStr || '').localeCompare(b.weekStartStr || ''));
  }, [otherAvailability]);

  const myAvailabilityByWeek = useMemo(() => {
    const grouped = {};
    (myAvailability || []).forEach((day) => {
      const info = getWeekInfo(day.date);
      if (!info) return;
      if (!grouped[info.key]) grouped[info.key] = { ...info, daysMap: {} };
      if (!grouped[info.key].daysMap[day.date]) grouped[info.key].daysMap[day.date] = [];
      (day.windows || []).forEach((w, idx) => {
        grouped[info.key].daysMap[day.date].push({
          id: w.id || `${day.date}-${idx}`,
          date: day.date,
          time_start: w.timeStart,
          time_end: w.timeEnd
        });
      });
    });

    return Object.values(grouped)
      .map((w) => ({
        ...w,
        days: Object.entries(w.daysMap)
          .map(([date, arr]) => ({ date, frames: arr.sort((a, b) => (a.time_start || '').localeCompare(b.time_start || '')) }))
          .sort((a, b) => a.date.localeCompare(b.date))
      }))
      .filter((w) => w.days.length > 0)
      .sort((a, b) => (a.weekStartStr || '').localeCompare(b.weekStartStr || ''));
  }, [myAvailability]);

  if (loading) return <div style={styles.overlay}><div style={styles.modal}>Laden...</div></div>;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.headerRow}>
          <h1 style={styles.title}>Termin Manager</h1>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.matchInfo}>
          {matchInfo?.home_player || 'Spieler 1'} vs. {matchInfo?.away_player || 'Spieler 2'} · {matchInfo?.sport || 'Sport'} · {matchInfo?.league || 'Liga'}
        </div>

        <div style={styles.instructions}>
          Host trägt Verfügbarkeiten ein. Gast wählt eine Startzeit innerhalb des Host-Slots (Dauer {slotDuration} Min) und sendet eine Einladung.
        </div>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        <div style={styles.sectionHeader}>
          <div>
            <h3 style={{ margin: 0, color: '#e8efe8' }}>Verfügbarkeiten (Host)</h3>
            <div style={{ color: '#9db', fontSize: 13 }}>Slots vom Host, aus denen du wählen kannst.</div>
          </div>
          {meta?.canCreateFrames && (
            <button onClick={() => setShowAddSlot((v) => !v)} style={styles.btnPrimary}>
              {showAddSlot ? 'Formular schließen' : 'Slot hinzufügen'}
            </button>
          )}
        </div>

        {showAddSlot && (
          <div style={styles.addForm}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Datum</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={styles.input} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Von</label>
                <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} style={styles.input} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Bis</label>
                <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} style={styles.input} />
              </div>
            </div>
            <div style={styles.formActions}>
              <button onClick={addFrame} style={styles.btnPrimary}>Speichern</button>
              <button onClick={() => { setShowAddSlot(false); setNewDate(''); setNewStart(''); setNewEnd(''); }} style={styles.btnGhost}>Abbrechen</button>
            </div>
          </div>
        )}

        {framesByWeek.length === 0 && (
          <div style={styles.empty}>Keine Verfügbarkeiten vom Host hinterlegt.</div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          {framesByWeek.map((week) => (
            <div key={week.key} style={styles.weekCard}>
              <div style={styles.weekHeader}>
                <div style={{ fontWeight: 800, color: '#debc7c' }}>KW {week.week}</div>
                <div style={{ color: '#9db', fontSize: 12 }}>{fmtWeekRange(week.weekStartStr, week.weekEndStr)}</div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {week.days.map(({ date, frames }) => (
                  <div key={date} style={styles.dateCard}>
                    <div style={styles.dateHeader}>
                      <div style={{ fontWeight: 700 }}>{fmtDate(date)}</div>
                      <div style={{ color: '#9db', fontSize: 13 }}>{frames.length} Slot{frames.length !== 1 ? 's' : ''}</div>
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      {frames.map((frame) => {
                        const latest = latestStart(frame);
                        const chosen = customTimes[frame.id] || fmtTime(frame.time_start);
                        const canPropose = meta?.canProposeSlots || meta?.canCreateSlots;
                        return (
                          <div key={frame.id} style={styles.frameRow}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ fontWeight: 700, color: '#e8efe8' }}>{fmtTime(frame.time_start)} - {fmtTime(frame.time_end)}</div>
                              <div style={{ color: '#9db', fontSize: 13 }}>Spätester Start: {latest || '—'} · Dauer {slotDuration} Min</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="time"
                                value={chosen}
                                min={fmtTime(frame.time_start)}
                                max={latest || undefined}
                                onChange={(e) => setCustomTimes((prev) => ({ ...prev, [frame.id]: e.target.value }))}
                                style={styles.inputTime}
                              />
                              <button
                                onClick={() => proposeSlot(frame)}
                                disabled={!canPropose || sending}
                                style={{ ...styles.btnPrimary, opacity: canPropose ? 1 : 0.5, cursor: canPropose ? 'pointer' : 'not-allowed' }}
                              >
                                Einladung senden
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {myAvailabilityByWeek.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={styles.sectionHeaderSimple}>
              <h3 style={{ margin: 0, color: '#e8efe8' }}>Deine Verfügbarkeiten</h3>
              <div style={{ color: '#9db', fontSize: 13 }}>Zeitslots, die du für dieses Match hinterlegt hast.</div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {myAvailabilityByWeek.map((week) => (
                <div key={week.key} style={styles.weekCard}>
                  <div style={styles.weekHeader}>
                    <div style={{ fontWeight: 800, color: '#debc7c' }}>KW {week.week}</div>
                    <div style={{ color: '#9db', fontSize: 12 }}>{fmtWeekRange(week.weekStartStr, week.weekEndStr)}</div>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {week.days.map(({ date, frames }) => (
                      <div key={date} style={styles.dateCard}>
                        <div style={styles.dateHeader}>
                          <div style={{ fontWeight: 700 }}>{fmtDate(date)}</div>
                          <div style={{ color: '#9db', fontSize: 13 }}>{frames.length} Slot{frames.length !== 1 ? 's' : ''}</div>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                          {frames.map((frame) => (
                            <div key={frame.id} style={styles.windowRow}>
                              <div style={{ fontWeight: 700, color: '#e8efe8' }}>{fmtTime(frame.time_start)} - {fmtTime(frame.time_end)}</div>
                              <div style={{ color: '#9db', fontSize: 13 }}>Dein Slot</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {otherAvailabilityByWeek.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={styles.sectionHeaderSimple}>
              <h3 style={{ margin: 0, color: '#e8efe8' }}>Verfügbarkeiten des Gegners (Match-Erstellung)</h3>
              <div style={{ color: '#9db', fontSize: 13 }}>Zeitslots, die der Gegner beim Erstellen des Matches hinterlegt hat.</div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {otherAvailabilityByWeek.map((week) => (
                <div key={week.key} style={styles.weekCard}>
                  <div style={styles.weekHeader}>
                    <div style={{ fontWeight: 800, color: '#debc7c' }}>KW {week.week}</div>
                    <div style={{ color: '#9db', fontSize: 12 }}>{fmtWeekRange(week.weekStartStr, week.weekEndStr)}</div>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {week.days.map(({ date, frames }) => (
                      <div key={date} style={styles.dateCard}>
                        <div style={styles.dateHeader}>
                          <div style={{ fontWeight: 700 }}>{fmtDate(date)}</div>
                          <div style={{ color: '#9db', fontSize: 13 }}>{frames.length} Slot{frames.length !== 1 ? 's' : ''}</div>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                          {frames.map((frame) => (
                            <div key={frame.id} style={styles.windowRow}>
                              <div style={{ fontWeight: 700, color: '#e8efe8' }}>{fmtTime(frame.time_start)} - {fmtTime(frame.time_end)}</div>
                              <button
                                onClick={() => openAvailSlotModal({ ...frame, date })}
                                style={{ ...styles.btnPrimary, fontSize: 12, padding: '6px 12px' }}
                              >
                                Slot wählen
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <div style={styles.sectionHeaderSimple}>
            <h3 style={{ margin: 0, color: '#e8efe8' }}>Gesendete Anfragen</h3>
            <div style={{ color: '#9db', fontSize: 13 }}>Gast sieht eigene Anfragen, Host kann annehmen.</div>
          </div>
          {slots.length === 0 && proposals.length === 0 ? (
            <div style={styles.empty}>Keine Anfragen vorhanden.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {proposals.map((p) => {
                const viewerIdNum = Number(meta?.viewerId);
                const byYou = viewerIdNum && Number(p.proposerUserId) === viewerIdNum;
                const canAccept = viewerIdNum && Number(p.recipientUserId) === viewerIdNum && p.status === 'sent';
                const dt = p.proposed_datetime ? new Date(p.proposed_datetime) : null;
                return (
                  <div key={p.id} style={styles.slotItem}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#e8efe8' }}>
                        {dt ? dt.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Terminvorschlag'}
                      </div>
                      <div style={{ color: '#9db', fontSize: 13 }}>{byYou ? 'von dir' : 'vom Gegner'} · Status: <span style={{ color: '#c9a75f' }}>{p.status === 'sent' ? 'ausstehend' : p.status}</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {canAccept && (
                        <>
                          <button onClick={() => acceptProposal(p.id)} disabled={sending} style={{ ...styles.btnPrimary, opacity: sending ? 0.5 : 1 }}>Annehmen</button>
                          <button onClick={() => rejectProposal(p.id, true)} disabled={sending} style={styles.btnSecondary}>Gegenvorschlag</button>
                          <button onClick={() => rejectProposal(p.id, false)} disabled={sending} style={styles.btnGhost}>Ablehnen</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {slots.map((s) => {
                const statusColor = s.status === 'accepted' ? '#4a9d5f' : '#c9a75f';
                const viewerIdNum = Number(meta?.viewerId);
                const byYou = viewerIdNum && Number(s.selected_by_user_id) === viewerIdNum;
                return (
                  <div key={s.id} style={styles.slotItem}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#e8efe8' }}>{fmtDate(s.slot_start)} · {new Date(s.slot_start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - {new Date(s.slot_end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div style={{ color: '#9db', fontSize: 13 }}>Dauer {s.duration_minutes} Min · {byYou ? 'von dir' : 'vom Host'} · Status: <span style={{ color: statusColor }}>{s.status}</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {s.status !== 'accepted' && meta?.canCreateSlots && (
                        <button onClick={() => removeSlot(s.id)} style={styles.btnGhost}>Zurückziehen</button>
                      )}
                      {s.status === 'proposed' && meta?.canCreateFrames && (
                        <button onClick={() => acceptSlot(s.id)} style={styles.btnPrimary}>Akzeptieren</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedAvailSlot && (
          <div style={styles.overlay} onClick={closeAvailSlotModal}>
            <div style={{ ...styles.modal, maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
              <div style={styles.headerRow}>
                <h2 style={{ margin: 0, fontSize: 20, color: '#e8efe8' }}>
                  {rejectingProposal ? 'Gegenvorschlag senden' : 'Termin vorschlagen'}
                </h2>
                <button onClick={closeAvailSlotModal} style={styles.closeBtn}>×</button>
              </div>

              <div style={{ marginBottom: 16, padding: 12, background: '#0f2a20', borderRadius: 10, border: '1px solid #26493c' }}>
                <div style={{ fontWeight: 700, color: '#e8efe8', marginBottom: 4 }}>{fmtDate(selectedAvailSlot.date)}</div>
                <div style={{ color: '#9db', fontSize: 14 }}>Verfügbarer Zeitraum: {fmtTime(selectedAvailSlot.time_start)} - {fmtTime(selectedAvailSlot.time_end)}</div>
                <div style={{ color: '#9db', fontSize: 13, marginTop: 4 }}>Spielzeit: {slotDuration} Min · Spätester Start: {latestStartForAvailSlot(selectedAvailSlot) || '—'}</div>
              </div>

              {error && <div style={styles.error}>{error}</div>}

              <div style={{ marginBottom: 16 }}>
                <label style={{ ...styles.label, display: 'block', marginBottom: 8 }}>Gewünschte Startzeit</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={prevTime}
                    disabled={timeIndex === 0}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: '2px solid #26493c',
                      background: timeIndex === 0 ? '#0a1c17' : '#0f2a20',
                      color: timeIndex === 0 ? '#555' : '#e8efe8',
                      fontWeight: 800,
                      fontSize: 20,
                      cursor: timeIndex === 0 ? 'not-allowed' : 'pointer',
                      opacity: timeIndex === 0 ? 0.3 : 1
                    }}
                  >
                    −
                  </button>
                  <div style={{
                    flex: 1,
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '2px solid #26493c',
                    background: '#0f2a20',
                    color: '#debc7c',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 22
                  }}>
                    {proposedTime || '—'}
                  </div>
                  <button
                    onClick={nextTime}
                    disabled={timeIndex >= availableTimes.length - 1}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      border: '2px solid #26493c',
                      background: timeIndex >= availableTimes.length - 1 ? '#0a1c17' : '#0f2a20',
                      color: timeIndex >= availableTimes.length - 1 ? '#555' : '#e8efe8',
                      fontWeight: 800,
                      fontSize: 20,
                      cursor: timeIndex >= availableTimes.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: timeIndex >= availableTimes.length - 1 ? 0.3 : 1
                    }}
                  >
                    +
                  </button>
                </div>
                <div style={{ color: '#9db', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                  {timeIndex + 1} von {availableTimes.length} verfügbaren Zeiten
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={sendAvailabilityInvitation}
                  disabled={sending || !proposedTime}
                  style={{ ...styles.btnPrimary, flex: 1, opacity: sending || !proposedTime ? 0.5 : 1, cursor: sending || !proposedTime ? 'not-allowed' : 'pointer' }}
                >
                  {sending ? 'Wird gesendet...' : 'Einladung versenden'}
                </button>
                <button onClick={closeAvailSlotModal} style={{ ...styles.btnGhost, flex: 1 }}>Abbrechen</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(6px)'
  },
  modal: {
    backgroundColor: '#0a1c17',
    color: '#e8efe8',
    borderRadius: 16,
    padding: 28,
    width: '95%',
    maxWidth: 1100,
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid #26493c',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: '#e8efe8'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#9db',
    fontSize: 28,
    cursor: 'pointer',
    lineHeight: 1
  },
  matchInfo: {
    backgroundColor: '#0f2a20',
    color: '#cfe',
    padding: '12px 14px',
    fontSize: 15,
    marginBottom: 10,
    borderRadius: 10,
    border: '1px solid #26493c'
  },
  instructions: {
    backgroundColor: '#0f2a20',
    color: '#9db',
    padding: '12px 14px',
    fontSize: 14,
    marginBottom: 16,
    borderRadius: 10,
    border: '1px solid #26493c'
  },
  error: {
    backgroundColor: '#2a0f0f',
    color: '#ff6b6b',
    padding: 12,
    marginBottom: 14,
    borderRadius: 8,
    border: '1px solid #ff6b6b'
  },
  success: {
    backgroundColor: '#0f2a1a',
    color: '#6bff9d',
    padding: 12,
    marginBottom: 14,
    borderRadius: 8,
    border: '1px solid #4a9d5f'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionHeaderSimple: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 8
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #debc7c, #c9a75f)',
    color: '#10261f',
    border: 'none',
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    borderRadius: 10,
    boxShadow: '0 6px 16px rgba(222, 188, 124, 0.3)',
    transition: 'all 0.2s ease'
  },
  btnGhost: {
    background: 'rgba(38, 73, 60, 0.6)',
    color: '#cfe',
    border: '1px solid #26493c',
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 10
  },
  btnSecondary: {
    background: 'rgba(222, 188, 124, 0.15)',
    color: '#debc7c',
    border: '1px solid #c9a75f',
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 10
  },
  addForm: {
    backgroundColor: '#0f2a20',
    border: '1px solid #26493c',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 12
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  label: {
    color: '#9db',
    fontSize: 13,
    fontWeight: 600
  },
  input: {
    width: '100%',
    padding: 10,
    fontSize: 14,
    border: '1px solid #26493c',
    borderRadius: 8,
    backgroundColor: '#0a1c17',
    color: '#e8efe8'
  },
  inputTime: {
    padding: 10,
    fontSize: 14,
    border: '1px solid #26493c',
    borderRadius: 8,
    backgroundColor: '#0a1c17',
    color: '#e8efe8'
  },
  formActions: {
    marginTop: 10,
    display: 'flex',
    gap: 10
  },
  empty: {
    color: '#9db',
    backgroundColor: '#0f2a20',
    border: '1px solid #26493c',
    padding: 12,
    borderRadius: 10,
    textAlign: 'center'
  },
  weekCard: {
    backgroundColor: '#08241c',
    border: '1px solid #26493c',
    borderRadius: 12,
    padding: 12,
    display: 'grid',
    gap: 10
  },
  weekHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottom: '1px solid #26493c'
  },
  dateCard: {
    backgroundColor: '#0f2a20',
    border: '1px solid #26493c',
    borderRadius: 12,
    padding: 12
  },
  dateHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  frameRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0a1c17',
    border: '1px solid #26493c',
    borderRadius: 10,
    padding: '10px 12px'
  },
  windowRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0a1c17',
    border: '1px solid #26493c',
    borderRadius: 10,
    padding: '10px 12px'
  },
  slotItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    backgroundColor: '#0f2a20',
    border: '1px solid #26493c',
    borderRadius: 10
  }
};
