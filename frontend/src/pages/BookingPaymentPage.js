import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE } from '../config';

function useCountdown(untilIso) {
  const [remaining, setRemaining] = useState(() => {
    const end = untilIso ? new Date(untilIso).getTime() : 0;
    return Math.max(0, end - Date.now());
  });
  useEffect(() => {
    const id = setInterval(() => {
      const end = untilIso ? new Date(untilIso).getTime() : 0;
      setRemaining(Math.max(0, end - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [untilIso]);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return { remaining, minutes, seconds };
}

export default function BookingPaymentPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initiating, setInitiating] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function loadBooking() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/bookings/${bookingId}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setBooking(j);
    } catch (e) {
      setError(e.message || 'Fehler beim Laden der Buchung');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBooking(); }, [bookingId]);

  const countdown = useCountdown(booking?.held_expires_at);

  async function initiatePayment() {
    if (!token) { navigate('/login'); return; }
    setInitiating(true);
    try {
      const res = await fetch(`${API_BASE}/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ booking_id: Number(bookingId), amount: booking?.price || booking?.base_price })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      await loadBooking();
    } catch (e) {
      setError(e.message || 'Initiierung fehlgeschlagen');
    } finally {
      setInitiating(false);
    }
  }

  async function completePayment() {
    if (!token) { navigate('/login'); return; }
    setCompleting(true);
    try {
      const res = await fetch(`${API_BASE}/payments/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ booking_id: Number(bookingId) })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      await loadBooking();
      navigate(`/book/${bookingId}/confirm`);
    } catch (e) {
      setError(e.message || 'Zahlung fehlgeschlagen');
    } finally {
      setCompleting(false);
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Lade Buchung ...</div>;
  if (error) return <div style={{ padding: 16, color: '#ff6b6b' }}>❌ {error}</div>;
  if (!booking) return <div style={{ padding: 16 }}>Buchung nicht gefunden.</div>;

  const expired = countdown.remaining <= 0;

  return (
    <div style={{ padding: 16 }}>
      <h1>Zahlung</h1>
      <div style={{ border: '1px solid #26493c', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{booking.location_name} · {booking.asset_name}</div>
        <div style={{ color: '#9db', marginTop: 6 }}>
          {new Date(booking.start_time).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' })}
        </div>
        <div style={{ color: '#6db', marginTop: 6 }}>Preis: €{parseFloat(booking.price || booking.base_price || 0).toFixed(2)}</div>
        <div style={{ marginTop: 10 }}>
          Status: {booking.status} · Zahlung: {booking.payment_status || 'unpaid'}
        </div>
        <div style={{ marginTop: 10, color: expired ? '#ff6b6b' : '#ffc864' }}>
          {expired ? 'Hold abgelaufen' : `Hold läuft ab in ${String(countdown.minutes).padStart(2,'0')}:${String(countdown.seconds).padStart(2,'0')}`}
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={initiatePayment} disabled={initiating || expired} style={{ padding: '10px 16px', borderRadius: 8, background: '#0a3', color: '#fff', border: 'none', fontWeight: 700 }}>
          {initiating ? '⏳' : 'Zahlung starten'}
        </button>
        <button onClick={completePayment} disabled={completing || expired} style={{ padding: '10px 16px', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 700 }}>
          {completing ? '⏳' : 'Zahlung abschließen'}
        </button>
      </div>
    </div>
  );
}
