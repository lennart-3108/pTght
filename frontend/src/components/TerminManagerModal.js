import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config';

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoFromLocalInput(value) {
  if (!value) return null;
  // value like "2026-01-10T18:30" => interpret as local
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatOption(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function TerminManagerModal({ matchId, token, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [meta, setMeta] = useState(null);
  const [options, setOptions] = useState([]);
  const [proposal, setProposal] = useState(null);

  const [newOptionLocal, setNewOptionLocal] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [note, setNote] = useState('');

  const viewerUserId = meta?.viewerUserId || null;
  const isOwner = !!meta?.isOwner;

  const buttonState = useMemo(() => {
    if (!proposal || proposal.status !== 'sent') return { label: 'Termin vorschlag senden', mode: 'send' };
    if (viewerUserId != null && Number(proposal.proposerUserId) === Number(viewerUserId)) {
      return { label: 'Terminvorschlag versendet', mode: 'sent' };
    }
    return { label: 'Termin vorschlag erhalten', mode: 'received' };
  }, [proposal, viewerUserId]);

  async function load() {
    if (!token || !matchId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Termin-Manager konnte nicht geladen werden.');
      setMeta(data?.meta || null);
      setOptions(Array.isArray(data?.options) ? data.options : []);
      setProposal(data?.proposal || null);

      // default selection
      if (Array.isArray(data?.options) && data.options.length && !selectedOptionId) {
        setSelectedOptionId(String(data.options[0].id));
      }
    } catch (e) {
      setError(e.message || 'Termin-Manager konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, matchId, token]);

  async function addOption() {
    const startsAt = toIsoFromLocalInput(newOptionLocal);
    if (!startsAt) {
      setError('Bitte ein gültiges Datum/Uhrzeit wählen.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ startsAt })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Zeit konnte nicht hinzugefügt werden.');
      setNewOptionLocal('');
      await load();
    } catch (e) {
      setError(e.message || 'Zeit konnte nicht hinzugefügt werden.');
    } finally {
      setLoading(false);
    }
  }

  async function removeOption(optionId) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/options/${optionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Zeit konnte nicht entfernt werden.');
      await load();
    } catch (e) {
      setError(e.message || 'Zeit konnte nicht entfernt werden.');
    } finally {
      setLoading(false);
    }
  }

  async function sendProposal() {
    if (!selectedOptionId) {
      setError('Bitte eine Zeit auswählen.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ optionId: Number(selectedOptionId), note: note && note.trim() ? note.trim() : undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Vorschlag konnte nicht gesendet werden.');
      setNote('');
      await load();
    } catch (e) {
      setError(e.message || 'Vorschlag konnte nicht gesendet werden.');
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
        body: JSON.stringify({ note: note && note.trim() ? note.trim() : undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Annehmen fehlgeschlagen.');
      setNote('');
      await load();
    } catch (e) {
      setError(e.message || 'Annehmen fehlgeschlagen.');
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
        body: JSON.stringify({ note: note && note.trim() ? note.trim() : undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Ablehnen fehlgeschlagen.');
      setNote('');
      await load();
    } catch (e) {
      setError(e.message || 'Ablehnen fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }

  async function counterProposal() {
    if (!proposal?.id) return;
    if (!selectedOptionId) {
      setError('Bitte eine Zeit auswählen.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/termin-manager/proposals/${proposal.id}/counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ optionId: Number(selectedOptionId), note: note && note.trim() ? note.trim() : undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Gegenvorschlag fehlgeschlagen.');
      setNote('');
      await load();
    } catch (e) {
      setError(e.message || 'Gegenvorschlag fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ width: 'min(760px, 100%)', background: '#0f241d', borderRadius: 16, border: '1px solid #285243', boxShadow: '0 12px 28px rgba(0,0,0,0.55)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #285243' }}>
          <div>
            <div style={{ fontWeight: 800, color: '#f0fff6', fontSize: 18 }}>Termin-Manager</div>
            {meta?.opponentName && (
              <div style={{ fontSize: 13, color: '#92b2a4', marginTop: 2 }}>
                Terminvorschlag senden an: <span style={{ color: '#debc7c', fontWeight: 600 }}>{meta.opponentName}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#e8efe8', fontSize: 28, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading && <div style={{ color: '#bcd' }}>Lade ...</div>}
          {error && <div style={{ color: '#ffb4b4', padding: '10px 12px', background: '#2a1b1b', borderRadius: 10, border: '1px solid #553f3f' }}>{error}</div>}

          {/* Active Proposal Status */}
          {proposal && proposal.status === 'sent' && (
            <div style={{ background: '#1a2e26', border: '1px solid #2f6b57', borderRadius: 12, padding: 14 }}>
              <div style={{ color: '#debc7c', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                {buttonState.mode === 'received' ? '📩 Terminvorschlag erhalten' : '📤 Terminvorschlag versendet'}
              </div>
              <div style={{ color: '#c5d9ce', lineHeight: 1.6 }}>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>Vorgeschlagene Zeit:</span>{' '}
                  <span style={{ color: '#e8efe8', fontWeight: 700 }}>{proposal.startsAt ? formatOption(proposal.startsAt) : '—'}</span>
                </div>
                {proposal.note && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: '#0f2a20', borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Nachricht:</span> {proposal.note}
                  </div>
                )}
              </div>
              
              {buttonState.mode === 'received' && (
                <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={acceptProposal}
                    disabled={loading}
                    style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #2f6b57', background: '#1c5b47', color: '#f2fff8', cursor: loading ? 'wait' : 'pointer', fontWeight: 600 }}
                  >
                    ✓ Annehmen
                  </button>
                  <button
                    onClick={rejectProposal}
                    disabled={loading}
                    style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #553f3f', background: '#2a1b1b', color: '#e9d8d8', cursor: loading ? 'wait' : 'pointer' }}
                  >
                    ✗ Ablehnen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Time Options */}
          <div style={{ background: '#0a1c17', border: '1px solid #26493c', borderRadius: 12, padding: 14 }}>
            <div style={{ color: '#e8efe8', fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Verfügbare Zeiten</div>
            
            {!options.length ? (
              <div style={{ padding: '12px 14px', background: '#0f2a20', borderRadius: 10, color: '#92b2a4', textAlign: 'center', marginBottom: 12 }}>
                Noch keine Zeiten hinterlegt. Füge eine Zeit hinzu, um einen Termin vorzuschlagen.
              </div>
            ) : (
              <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {options.map((o) => {
                  const isHostOption = meta?.homeUserId && o.createdByUserId && Number(o.createdByUserId) === Number(meta.homeUserId);
                  const isOwnOption = viewerUserId && o.createdByUserId && Number(o.createdByUserId) === Number(viewerUserId);
                  const isSelected = selectedOptionId === String(o.id);
                  return (
                    <div 
                      key={o.id} 
                      onClick={() => setSelectedOptionId(String(o.id))}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        gap: 10, 
                        padding: '10px 12px', 
                        borderRadius: 10, 
                        border: isSelected ? '2px solid #2f6b57' : '1px solid #26493c', 
                        background: isSelected ? '#1a2e26' : '#0f2a20',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e8efe8', flex: 1 }}>
                        <div style={{ 
                          width: 18, 
                          height: 18, 
                          borderRadius: '50%', 
                          border: isSelected ? '5px solid #2f6b57' : '2px solid #26493c',
                          background: isSelected ? '#1c5b47' : 'transparent'
                        }} />
                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{formatOption(o.startsAt)}</span>
                        {isHostOption && <span style={{ fontSize: 11, color: '#debc7c', fontWeight: 600 }}>⭐ Host-Favorit</span>}
                      </div>
                      {isOwnOption && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeOption(o.id); }}
                          disabled={loading}
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #553f3f', background: '#2a1b1b', color: '#e9d8d8', cursor: loading ? 'wait' : 'pointer', fontSize: 12 }}
                        >
                          Entfernen
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #26493c' }}>
              <input
                type="datetime-local"
                value={newOptionLocal}
                onChange={(e) => setNewOptionLocal(e.target.value)}
                style={{ flex: '1 1 200px', padding: '10px 12px', borderRadius: 10, border: '1px solid #26493c', background: '#0a1c17', color: '#e8efe8', fontSize: 14 }}
              />
              <button
                onClick={addOption}
                disabled={loading || !newOptionLocal}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #2f6b57', background: '#1c5b47', color: '#f2fff8', cursor: loading || !newOptionLocal ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: loading || !newOptionLocal ? 0.5 : 1 }}
              >
                + Zeit hinzufügen
              </button>
            </div>
          </div>

          {/* Send Proposal */}
          <div style={{ background: '#0a1c17', border: '1px solid #26493c', borderRadius: 12, padding: 14 }}>
            <div style={{ color: '#e8efe8', fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
              {buttonState.mode === 'received' ? 'Gegenvorschlag senden' : 'Terminvorschlag senden'}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optionale Nachricht an deinen Gegner …"
              style={{ width: '100%', background: '#153129', borderRadius: 10, border: '1px solid #285243', color: '#e5f4ec', padding: 12, resize: 'vertical', minHeight: 70, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
              maxLength={2000}
            />

            {buttonState.mode === 'received' ? (
              <button
                onClick={counterProposal}
                disabled={loading || !selectedOptionId}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #2f6b57', background: '#1c5b47', color: '#f2fff8', cursor: loading || !selectedOptionId ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 15, opacity: loading || !selectedOptionId ? 0.5 : 1 }}
              >
                📅 Gegenvorschlag senden
              </button>
            ) : (!proposal || proposal.status !== 'sent') && (
              <button
                onClick={sendProposal}
                disabled={loading || !selectedOptionId || !options.length}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #2f6b57', background: '#1c5b47', color: '#f2fff8', cursor: loading || !selectedOptionId || !options.length ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 15, opacity: loading || !selectedOptionId || !options.length ? 0.5 : 1 }}
              >
                📅 Terminvorschlag senden
              </button>
            )}
          </div>

          <div style={{ color: '#92b2a4', fontSize: 12, textAlign: 'center', fontStyle: 'italic' }}>
            Alle Aktionen werden im Match-Chat angezeigt
          </div>
        </div>
      </div>
    </div>
  );
}
