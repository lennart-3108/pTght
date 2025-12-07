import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE } from '../config';

export default function SlotReviewPage() {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const [slot, setSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [holdLoading, setHoldLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/slots/${slotId}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
        if (mounted) setSlot(j);
      } catch (e) {
        if (mounted) setError(e.message || 'Fehler beim Laden des Slots');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slotId]);

  async function holdSlot() {
    if (!token) { navigate('/login'); return; }
    setHoldLoading(true);
    try {
      const res = await fetch(`${API_BASE}/bookings/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slot_id: Number(slotId) })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      const bookingId = j.id || j.booking_id || j.bookingId;
      if (!bookingId) throw new Error('Keine booking_id in Antwort');
      navigate(`/book/${bookingId}/payment`);
    } catch (e) {
      setError(e.message || 'Hold fehlgeschlagen');
    } finally {
      setHoldLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Lade Slot ...</div>;
  if (error) return <div style={{ padding: 16, color: '#ff6b6b' }}>❌ {error}</div>;
  if (!slot) return <div style={{ padding: 16 }}>Slot nicht gefunden.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>Slot prüfen</h1>
      <div style={{ border: '1px solid #26493c', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{slot.location_name} · {slot.asset_name}</div>
        <div style={{ color: '#9db', marginTop: 6 }}>
          {new Date(slot.start_time).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' })}
        </div>
        <div style={{ color: '#6db', marginTop: 6 }}>Preis: €{parseFloat(slot.base_price || 0).toFixed(2)}</div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '10px 16px', borderRadius: 8 }}>Zurück</button>
        <button onClick={holdSlot} disabled={holdLoading || !token} style={{ padding: '10px 16px', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 700 }}>
          {holdLoading ? '⏳' : 'Slot halten'}
        </button>
        {!token && <div style={{ color: '#ffc864' }}>Bitte anmelden</div>}
      </div>
    </div>
  );
}
