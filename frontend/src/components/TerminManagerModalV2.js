import React, { useEffect, useState } from 'react';
import { API_BASE } from '../config';

const PRESETS = {
  morning: { start: '06:00', end: '12:00', label: 'Morgens (6-12 Uhr)' },
  afternoon: { start: '12:00', end: '18:00', label: 'Mittags (12-18 Uhr)' },
  evening: { start: '18:00', end: '23:00', label: 'Abends (18-23 Uhr)' }
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleString('de-DE', { 
    weekday: 'short', 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

export default function TerminManagerModalV2({ matchId, token, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [myAvailability, setMyAvailability] = useState([]);
  const [theirAvailability, setTheirAvailability] = useState([]);
  const [overlaps, setOverlaps] = useState([]);
  const [proposal, setProposal] = useState(null);
  const [meta, setMeta] = useState(null);

  // Form states
  const [newDate, setNewDate] = useState('');
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  
  // Proposal states
  const [proposalDatetime, setProposalDatetime] = useState('');
  const [proposalNote, setProposalNote] = useState('');

  async function load() {
    if (!token || !matchId) return;
    setLoading(true);
    setError('');
    try {
      // Load availability
      const availRes = await fetch(`${API_BASE}/matches/${matchId}/availability`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const availData = await availRes.json().catch(() => ({}));
      if (!availRes.ok) {
        console.error('[TerminManager] Availability load failed:', availRes.status, availData);
        if (availRes.status === 403 || availRes.status === 401) {
          throw new Error('Nicht berechtigt. Bitte neu anmelden.');
        }
        throw new Error(availData?.error || `HTTP ${availRes.status}: Fehler beim Laden`);
      }

      setMyAvailability(availData.myAvailability || []);
      setTheirAvailability(availData.theirAvailability || []);
      setMeta(availData.meta || null);

      // Load overlaps
      const overlapRes = await fetch(`${API_BASE}/matches/${matchId}/availability/overlaps`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const overlapData = await overlapRes.json().catch(() => ({}));
      if (overlapRes.ok) {
        setOverlaps(overlapData.overlaps || []);
      } else {
        console.warn('[TerminManager] Overlaps load failed:', overlapData);
      }

      // Load active proposal from old endpoint
      const propRes = await fetch(`${API_BASE}/matches/${matchId}/termin-manager`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const propData = await propRes.json().catch(() => ({}));
      if (propRes.ok && propData.proposal) {
        setProposal(propData.proposal);
      } else {
        console.warn('[TerminManager] Proposal load failed:', propData);
      }
    } catch (e) {
      console.error('[TerminManager] Load error:', e);
      setError(e.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, matchId, token]);

  async function addDay() {
    if (!newDate) return setError('Bitte ein Datum wählen');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/availability/days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: newDate })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Fehler beim Hinzufügen');
      setNewDate('');
      await load();
    } catch (e) {
      setError(e.message || 'Fehler beim Hinzufügen');
    } finally {
      setLoading(false);
    }
  }

  async function removeDay(dayId) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/availability/days/${dayId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Fehler beim Entfernen');
      await load();
    } catch (e) {
      setError(e.message || 'Fehler beim Entfernen');
    } finally {
      setLoading(false);
    }
  }

  async function addWindow(dayId) {
    if (!timeStart || !timeEnd) return setError('Bitte Start- und Endzeit angeben');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/availability/days/${dayId}/windows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          timeStart, 
          timeEnd,
          preset: selectedPreset || null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Fehler beim Hinzufügen');
      setTimeStart('');
      setTimeEnd('');
      setSelectedPreset('');
      await load();
    } catch (e) {
      setError(e.message || 'Fehler beim Hinzufügen');
    } finally {
      setLoading(false);
    }
  }

  async function removeWindow(windowId) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/availability/windows/${windowId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Fehler beim Entfernen');
      await load();
    } catch (e) {
      setError(e.message || 'Fehler beim Entfernen');
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(preset) {
    const p = PRESETS[preset];
    if (p) {
      setTimeStart(p.start);
      setTimeEnd(p.end);
      setSelectedPreset(preset);
    }
  }

  async function sendProposal() {
    if (!proposalDatetime) return setError('Bitte eine Zeit auswählen');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/availability/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          datetime: proposalDatetime,
          note: proposalNote || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Fehler beim Senden');
      setProposalDatetime('');
      setProposalNote('');
      await load();
    } catch (e) {
      setError(e.message || 'Fehler beim Senden');
    } finally {
      setLoading(false);
    }
  }

  async function acceptProposal() {
    if (!proposal?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposal.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: proposalNote || undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Fehler');
      setProposalNote('');
      await load();
    } catch (e) {
      setError(e.message || 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  async function rejectProposal() {
    if (!proposal?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: proposalNote || undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Fehler');
      setProposalNote('');
      await load();
    } catch (e) {
      setError(e.message || 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const viewerUserId = meta?.viewerUserId;
  const isProposalReceiver = proposal && proposal.status === 'sent' && Number(proposal.recipientUserId) === viewerUserId;
  const isProposalSender = proposal && proposal.status === 'sent' && Number(proposal.proposerUserId) === viewerUserId;
  const canPropose = overlaps.length > 0 && (!proposal || proposal.status !== 'sent');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16, overflowY: 'auto' }}>
      <div style={{ width: 'min(900px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#0f241d', borderRadius: 16, border: '1px solid #285243', boxShadow: '0 12px 28px rgba(0,0,0,0.55)' }}>
        <div style={{ position: 'sticky', top: 0, background: '#0f241d', borderBottom: '1px solid #285243', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ fontWeight: 800, color: '#f0fff6', fontSize: 18 }}>Termin-Manager</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#e8efe8', fontSize: 28, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && <div style={{ color: '#bcd', textAlign: 'center' }}>Lade ...</div>}
          {error && <div style={{ color: '#ffb4b4', padding: '10px 12px', background: '#2a1b1b', borderRadius: 10, border: '1px solid #553f3f' }}>{error}</div>}

          {/* Active Proposal */}
          {proposal && proposal.status === 'sent' && (
            <div style={{ background: '#1a2e26', border: '2px solid #2f6b57', borderRadius: 12, padding: 14 }}>
              <div style={{ color: '#debc7c', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
                {isProposalReceiver ? '📩 Terminvorschlag erhalten' : '📤 Terminvorschlag versendet'}
              </div>
              <div style={{ color: '#e8efe8', fontWeight: 700, marginBottom: 8 }}>
                {formatDateTime(proposal.proposed_datetime || proposal.startsAt)}
              </div>
              {proposal.note && (
                <div style={{ color: '#c5d9ce', fontSize: 14, padding: '8px 10px', background: '#0f2a20', borderRadius: 8, marginBottom: 12 }}>
                  {proposal.note}
                </div>
              )}
              {isProposalReceiver && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={acceptProposal} disabled={loading} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #2f6b57', background: '#1c5b47', color: '#f2fff8', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                    ✓ Annehmen
                  </button>
                  <button onClick={rejectProposal} disabled={loading} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #553f3f', background: '#2a1b1b', color: '#e9d8d8', cursor: loading ? 'not-allowed' : 'pointer' }}>
                    ✗ Ablehnen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* My Availability */}
          <div style={{ background: '#0a1c17', border: '1px solid #26493c', borderRadius: 12, padding: 14 }}>
            <div style={{ color: '#e8efe8', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Meine Verfügbarkeit</div>
            
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #26493c', background: '#0a1c17', color: '#e8efe8', flex: '1 1 150px' }} />
              <button onClick={addDay} disabled={loading || !newDate} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #2f6b57', background: '#1c5b47', color: '#f2fff8', cursor: loading || !newDate ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                + Tag hinzufügen
              </button>
            </div>

            {myAvailability.length === 0 ? (
              <div style={{ color: '#92b2a4', textAlign: 'center', padding: 12 }}>Noch keine verfügbaren Tage eingetragen</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myAvailability.map((day) => (
                  <div key={day.id} style={{ background: '#0f2a20', border: '1px solid #26493c', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ color: '#e8efe8', fontWeight: 600 }}>{formatDate(day.date)}</div>
                      <button onClick={() => removeDay(day.id)} disabled={loading} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #553f3f', background: '#2a1b1b', color: '#e9d8d8', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer' }}>
                        Entfernen
                      </button>
                    </div>

                    {selectedDayId === day.id && (
                      <div style={{ marginBottom: 10, padding: 10, background: '#153129', borderRadius: 8 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          {Object.keys(PRESETS).map(key => (
                            <button key={key} onClick={() => applyPreset(key)} style={{ padding: '6px 10px', borderRadius: 8, border: selectedPreset === key ? '2px solid #2f6b57' : '1px solid #26493c', background: selectedPreset === key ? '#1a2e26' : '#0a1c17', color: '#e8efe8', fontSize: 12, cursor: 'pointer' }}>
                              {PRESETS[key].label}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #26493c', background: '#0a1c17', color: '#e8efe8' }} />
                          <span style={{ color: '#e8efe8', alignSelf: 'center' }}>bis</span>
                          <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #26493c', background: '#0a1c17', color: '#e8efe8' }} />
                        </div>
                        <button onClick={() => addWindow(day.id)} disabled={loading || !timeStart || !timeEnd} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #2f6b57', background: '#1c5b47', color: '#f2fff8', cursor: loading || !timeStart || !timeEnd ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                          Zeitfenster hinzufügen
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {day.windows.length === 0 ? (
                        <div style={{ color: '#92b2a4', fontSize: 13, textAlign: 'center', padding: 8 }}>
                          Keine Zeitfenster. <button onClick={() => setSelectedDayId(day.id)} style={{ background: 'none', border: 'none', color: '#debc7c', textDecoration: 'underline', cursor: 'pointer' }}>Hinzufügen</button>
                        </div>
                      ) : (
                        <>
                          {day.windows.map(w => (
                            <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#0a1c17', borderRadius: 8 }}>
                              <div style={{ color: '#e8efe8', fontSize: 14 }}>{w.timeStart} - {w.timeEnd}</div>
                              <button onClick={() => removeWindow(w.id)} disabled={loading} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #553f3f', background: '#2a1b1b', color: '#e9d8d8', fontSize: 11, cursor: loading ? 'not-allowed' : 'pointer' }}>×</button>
                            </div>
                          ))}
                          <button onClick={() => setSelectedDayId(selectedDayId === day.id ? null : day.id)} style={{ padding: '6px', borderRadius: 8, border: '1px solid #26493c', background: '#0a1c17', color: '#debc7c', fontSize: 12, cursor: 'pointer' }}>
                            {selectedDayId === day.id ? '− Schließen' : '+ Weitere Zeitfenster'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Their Availability */}
          {theirAvailability.length > 0 && (
            <div style={{ background: '#0a1c17', border: '1px solid #26493c', borderRadius: 12, padding: 14 }}>
              <div style={{ color: '#e8efe8', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Verfügbarkeit des Gegners</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {theirAvailability.map((day) => (
                  <div key={day.id} style={{ background: '#0f2a20', border: '1px solid #26493c', borderRadius: 10, padding: 12 }}>
                    <div style={{ color: '#e8efe8', fontWeight: 600, marginBottom: 8 }}>{formatDate(day.date)}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {day.windows.map(w => (
                        <div key={w.id} style={{ color: '#c5d9ce', fontSize: 14, padding: '6px 10px', background: '#0a1c17', borderRadius: 8 }}>
                          {w.timeStart} - {w.timeEnd}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overlaps & Proposal */}
          {overlaps.length > 0 && (
            <div style={{ background: '#1a2e26', border: '2px solid #2f6b57', borderRadius: 12, padding: 14 }}>
              <div style={{ color: '#debc7c', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Gemeinsame verfügbare Zeiten</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: canPropose ? 14 : 0 }}>
                {overlaps.map((o, idx) => (
                  <div key={idx} style={{ color: '#e8efe8', padding: '8px 12px', background: '#0f2a20', borderRadius: 8 }}>
                    {formatDate(o.date)} • {o.timeStart} - {o.timeEnd}
                  </div>
                ))}
              </div>

              {canPropose && (
                <div>
                  <div style={{ color: '#e8efe8', fontWeight: 600, marginBottom: 8 }}>Konkreten Termin vorschlagen</div>
                  <input 
                    type="datetime-local" 
                    value={proposalDatetime} 
                    onChange={(e) => setProposalDatetime(e.target.value)} 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #26493c', background: '#0a1c17', color: '#e8efe8', marginBottom: 10 }} 
                  />
                  <textarea
                    value={proposalNote}
                    onChange={(e) => setProposalNote(e.target.value)}
                    placeholder="Optionale Nachricht …"
                    style={{ width: '100%', background: '#153129', borderRadius: 10, border: '1px solid #285243', color: '#e5f4ec', padding: 10, resize: 'vertical', minHeight: 60, marginBottom: 10 }}
                    maxLength={2000}
                  />
                  <button onClick={sendProposal} disabled={loading || !proposalDatetime} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #2f6b57', background: '#1c5b47', color: '#f2fff8', cursor: loading || !proposalDatetime ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 15 }}>
                    📅 Terminvorschlag senden
                  </button>
                </div>
              )}
            </div>
          )}

          {overlaps.length === 0 && theirAvailability.length > 0 && (
            <div style={{ color: '#debc7c', textAlign: 'center', padding: 12, background: '#1a2e26', borderRadius: 10 }}>
              Keine gemeinsamen verfügbaren Zeiten gefunden
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
