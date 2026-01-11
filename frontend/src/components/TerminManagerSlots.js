import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export default function TerminManagerSlots({ matchId, token, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [frames, setFrames] = useState([]);
  const [slots, setSlots] = useState([]);
  const [meta, setMeta] = useState(null);

  // Neuer Frame
  const [newFrameDate, setNewFrameDate] = useState('');
  const [newFrameStart, setNewFrameStart] = useState('');
  const [newFrameEnd, setNewFrameEnd] = useState('');

  // Neuer Slot
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [slotDuration, setSlotDuration] = useState(60); // 1h default
  const [customStartTimes, setCustomStartTimes] = useState({});

  const filteredFrames = useMemo(() => {
    if (!meta?.hostUserId) return frames;
    return frames.filter((f) => String(f.created_by_user_id) === String(meta.hostUserId));
  }, [frames, meta]);

  useEffect(() => {
    if (matchId && token) load();
  }, [matchId, token]);

  // Sync slot duration with match defaults once meta is loaded
  useEffect(() => {
    if (meta) {
      const candidate = meta.slotDurationMinutes ?? meta.matchDurationMinutes ?? meta.slotDuration ?? slotDuration;
      const parsed = Number(candidate);
      setSlotDuration(Number.isFinite(parsed) && parsed > 0 ? parsed : slotDuration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/time-slots`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          throw new Error('Nicht berechtigt. Bitte neu anmelden.');
        }
        throw new Error(data.error || `HTTP ${res.status}: Fehler beim Laden`);
      }

      setFrames(data.frames || []);
      setSlots(data.slots || []);
      setMeta(data.meta || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addFrame() {
    if (!newFrameDate || !newFrameStart || !newFrameEnd) {
      setError('Bitte Datum und Zeit ausfüllen');
      return;
    }
    if (newFrameStart >= newFrameEnd) {
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
        body: JSON.stringify({
          date: newFrameDate,
          timeStart: newFrameStart,
          timeEnd: newFrameEnd
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler beim Speichern');

      setNewFrameDate('');
      setNewFrameStart('');
      setNewFrameEnd('');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeFrame(frameId) {
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/time-frames/${frameId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Löschen');
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
      if (!res.ok) throw new Error('Fehler beim Löschen');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function acceptSlot(slotId) {
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/time-slots/${slotId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Akzeptieren');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  function formatDateTime(dt) {
    const d = new Date(dt);
    return d.toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatTime(time) {
    return time.substring(0, 5); // HH:MM
  }

  const toHm = (dateObj) => {
    if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
    const h = String(dateObj.getHours()).padStart(2, '0');
    const m = String(dateObj.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const latestStartForFrame = (frame) => {
    if (!frame || !slotDuration) return null;
    const end = new Date(`${frame.date}T${frame.time_end}`);
    if (Number.isNaN(end.getTime())) return null;
    return new Date(end.getTime() - slotDuration * 60000);
  };

  const proposeSlot = async (frame) => {
    try {
      setError('');
      const chosenTime = customStartTimes[frame.id] || (frame.time_start ? frame.time_start.substring(0, 5) : '');
      if (!chosenTime) {
        setError('Bitte eine Startzeit wählen.');
        return;
      }

      const start = new Date(`${frame.date}T${chosenTime}`);
      if (Number.isNaN(start.getTime())) {
        setError('Ungültige Startzeit.');
        return;
      }
      const frameStart = new Date(`${frame.date}T${frame.time_start}`);
      const frameEnd = new Date(`${frame.date}T${frame.time_end}`);
      const end = new Date(start.getTime() + slotDuration * 60000);

      if (Number.isNaN(frameStart.getTime()) || Number.isNaN(frameEnd.getTime())) {
        setError('Verfügbarkeitsfenster ist ungültig.');
        return;
      }
      if (start < frameStart) {
        setError('Start liegt vor dem Verfügbarkeitsfenster.');
        return;
      }
      if (end > frameEnd) {
        setError('Start zu spät – das Spiel würde nach dem Slot enden.');
        return;
      }

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
      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Senden der Anfrage');
      }

      setCustomStartTimes((prev) => ({ ...prev, [frame.id]: chosenTime }));
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <div style={styles.overlay}><div style={styles.modal}>Laden...</div></div>;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2>Termin-Manager</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* HOST: Zeitrahmen erstellen */}
        {meta?.canCreateFrames && (
          <div style={styles.section}>
            <h3>Verfügbare Zeiträume festlegen</h3>
            <div style={styles.row}>
              <input
                type="date"
                value={newFrameDate}
                onChange={e => setNewFrameDate(e.target.value)}
                style={styles.input}
              />
              <input
                type="time"
                value={newFrameStart}
                onChange={e => setNewFrameStart(e.target.value)}
                style={styles.inputTime}
              />
              <span>bis</span>
              <input
                type="time"
                value={newFrameEnd}
                onChange={e => setNewFrameEnd(e.target.value)}
                style={styles.inputTime}
              />
              <button onClick={addFrame} style={styles.btnAdd}>+ Hinzufügen</button>
            </div>

            <div style={styles.frameList}>
              {frames.map(frame => (
                <div key={frame.id} style={styles.frameItem}>
                  <span>
                    {new Date(frame.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    {' '}
                    {formatTime(frame.time_start)} - {formatTime(frame.time_end)}
                  </span>
                  <button onClick={() => removeFrame(frame.id)} style={styles.btnRemove}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BEIGETRETENER: Slots wählen */}
        {(meta || frames.length > 0) && (
          <div style={styles.section}>
            <h3>Verfügbarkeiten</h3>
            <div style={{ marginBottom: 12, color: '#ccc', fontSize: 13 }}>
              Verfügbarkeits-Slots des Hosts{meta?.hostName ? ` (${meta.hostName})` : ''}. Spielzeit pro Anfrage: {slotDuration} Min.
            </div>
            {filteredFrames.length === 0 ? (
              <div style={{ color: '#9db' }}>Keine Host-Verfügbarkeiten vorhanden.</div>
            ) : (
              filteredFrames.map(frame => {
                const isExpanded = selectedFrame === frame.id;
                const latestStart = latestStartForFrame(frame);
                const latestStartStr = toHm(latestStart);
                const chosenTime = customStartTimes[frame.id] || (frame.time_start ? frame.time_start.substring(0, 5) : '');
                const canPropose = meta?.canProposeSlots || meta?.canCreateSlots;

                return (
                  <div key={frame.id} style={styles.frameCard}>
                    <div
                      style={styles.frameHeader}
                      onClick={() => setSelectedFrame(isExpanded ? null : frame.id)}
                    >
                      <strong>
                        {new Date(frame.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        {' '}
                        {formatTime(frame.time_start)} - {formatTime(frame.time_end)}
                      </strong>
                      <span>{isExpanded ? '▼' : '▶'}</span>
                    </div>

                    {isExpanded && (
                      <div style={styles.requestBox}>
                        <div style={{ marginBottom: 8, color: '#cfd', fontSize: 13 }}>
                          Spielzeit: {slotDuration} Min · Spätester Start: {latestStartStr || '—'}
                        </div>
                        <div style={styles.row}>
                          <input
                            type="time"
                            value={chosenTime}
                            min={frame.time_start ? frame.time_start.substring(0, 5) : undefined}
                            max={latestStartStr || undefined}
                            onChange={(e) => setCustomStartTimes((prev) => ({ ...prev, [frame.id]: e.target.value }))}
                            style={styles.inputTime}
                          />
                          {canPropose ? (
                            <button onClick={() => proposeSlot(frame)} style={styles.btnSave}>
                              Anfrage senden
                            </button>
                          ) : (
                            <div style={{ color: '#9db' }}>Nur Gäste können eine Anfrage senden.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Gespeicherte Slots anzeigen */}
        {slots.length > 0 && (
          <div style={styles.section}>
            <h3>Vorgeschlagene Termine</h3>
            {slots.map(slot => {
              const viewerIdNum = Number(meta?.viewerId);
              const byYou = viewerIdNum && Number(slot.selected_by_user_id) === viewerIdNum;

              return (
                <div key={slot.id} style={styles.slotItem}>
                  <div>
                    <strong>{formatDateTime(slot.slot_start)}</strong>
                    {' - '}
                    {new Date(slot.slot_end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    {' '}
                    ({slot.duration_minutes} Min)
                    {slot.status === 'accepted' && <span style={styles.badge}>✓ Akzeptiert</span>}
                    {slot.status === 'proposed' && <span style={styles.badgeMuted}>Angefragt</span>}
                  </div>
                  <div style={{ color: '#9db', fontSize: 12, marginTop: 4 }}>
                    {byYou ? 'Von dir angefragt' : 'Vom Host angefragt'} · Status: {slot.status}
                  </div>
                  <div>
                    {meta?.canCreateSlots && slot.status !== 'accepted' && (
                      <button onClick={() => removeSlot(slot.id)} style={styles.btnRemove}>×</button>
                    )}
                    {meta?.canCreateFrames && slot.status === 'proposed' && (
                      <button onClick={() => acceptSlot(slot.id)} style={styles.btnAccept}>Akzeptieren</button>
                    )}
                  </div>
                </div>
              );
            })}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  badgeMuted: {
    marginLeft: 8,
    backgroundColor: '#2d3d4f',
    color: '#cfd',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 12
  },
  modal: {
    backgroundColor: '#1a2332',
    color: '#fff',
    borderRadius: 8,
    padding: 24,
    width: '90%',
    maxWidth: 800,
    maxHeight: '90vh',
    overflow: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 24,
    cursor: 'pointer'
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#243447',
    borderRadius: 6
  },
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12
  },
  input: {
    flex: 1,
    padding: 8,
    backgroundColor: '#1a2332',
    border: '1px solid #3a4a5f',
    borderRadius: 4,
    color: '#fff',
    fontSize: 14
  },
  inputTime: {
    padding: 8,
    backgroundColor: '#1a2332',
    border: '1px solid #3a4a5f',
    borderRadius: 4,
    color: '#fff',
    fontSize: 14
  },
  select: {
    marginLeft: 8,
    padding: 8,
    backgroundColor: '#1a2332',
    border: '1px solid #3a4a5f',
    borderRadius: 4,
    color: '#fff',
    fontSize: 14
  },
  btnAdd: {
    padding: '8px 16px',
    backgroundColor: '#4a9d5f',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold'
  },
  btnSave: {
    padding: '10px 20px',
    backgroundColor: '#4a9d5f',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold'
  },
  btnCancel: {
    padding: '10px 20px',
    backgroundColor: '#666',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14
  },
  btnRemove: {
    padding: '4px 8px',
    backgroundColor: '#c44',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 16
  },
  btnAccept: {
    padding: '6px 12px',
    backgroundColor: '#4a9d5f',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 'bold'
  },
  requestBox: {
    padding: 12,
    backgroundColor: '#1f2c3a',
    borderRadius: 6,
    marginTop: 8
  },
  error: {
    padding: 12,
    backgroundColor: '#c44',
    borderRadius: 4,
    marginBottom: 16
  },
  frameList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  frameItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#1a2332',
    borderRadius: 4
  },
  frameCard: {
    backgroundColor: '#1a2332',
    borderRadius: 6,
    marginBottom: 12,
    overflow: 'hidden'
  },
  frameHeader: {
    padding: 12,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a3a4f',
    borderRadius: 4
  },
  slotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 8,
    padding: 12
  },
  slotBtn: {
    padding: '8px 12px',
    backgroundColor: '#3a4a5f',
    border: '1px solid #4a5a6f',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    transition: 'all 0.2s'
  },
  slotBtnSelected: {
    backgroundColor: '#4a9d5f',
    borderColor: '#5aad6f'
  },
  slotBtnSaved: {
    backgroundColor: '#666',
    cursor: 'not-allowed',
    opacity: 0.6
  },
  slotItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a2332',
    borderRadius: 4,
    marginBottom: 8
  },
  badge: {
    marginLeft: 8,
    padding: '2px 8px',
    backgroundColor: '#4a9d5f',
    borderRadius: 12,
    fontSize: 12
  }
};
