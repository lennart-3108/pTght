import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE } from '../config';

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
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

  useEffect(() => { load(); }, [bookingId]);
  useEffect(() => {
    const id = setInterval(() => { load(); }, 5000); // Poll every 5s
    return () => clearInterval(id);
  }, [bookingId]);

  if (loading) return <div style={{ padding: 16 }}>Lade Buchung ...</div>;
  if (error) return <div style={{ padding: 16, color: '#ff6b6b' }}>❌ {error}</div>;
  if (!booking) return <div style={{ padding: 16 }}>Buchung nicht gefunden.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>Buchungsdetails</h1>
      <div style={{ border: '1px solid #26493c', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{booking.location_name} · {booking.asset_name}</div>
        <div style={{ color: '#9db', marginTop: 6 }}>
          {new Date(booking.start_time).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' })}
        </div>
        <div style={{ color: '#6db', marginTop: 6 }}>Preis: €{parseFloat(booking.price || booking.base_price || 0).toFixed(2)}</div>
        <div style={{ marginTop: 10 }}>Status: {booking.status}</div>
        <div style={{ marginTop: 10 }}>Zahlung: {booking.payment_status || 'unpaid'}</div>
      </div>
    </div>
  );
}
