import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

export default function SlotSearchPage() {
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const [sportId, setSportId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [city, setCity] = useState('');
  const [duration, setDuration] = useState(60);

  const [sports, setSports] = useState([]);
  const [cities, setCities] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          fetch(`${API_BASE}/sports/list`),
          fetch(`${API_BASE}/locations/cities`)
        ]);
        const s = await sRes.json().catch(() => []);
        const c = await cRes.json().catch(() => []);
        if (sRes.ok) setSports(Array.isArray(s) ? s : []);
        if (cRes.ok) setCities(Array.isArray(c) ? c : []);
      } catch {}
    })();
  }, []);

  async function search() {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      // Backend expects datetime + duration
      const target = new Date(`${date}T12:00:00`); // midday default; user can refine later
      params.append('datetime', target.toISOString());
      params.append('duration', String(duration));
      if (sportId) params.append('sport_id', sportId);
      if (city) params.append('city', city);
      const res = await fetch(`${API_BASE}/slots/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => []);
      setSlots(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Fehler bei der Suche');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { search(); }, [sportId, date, city, duration]);

  const resultsText = useMemo(() => {
    return `${slots.length} Slots gefunden`;
  }, [slots]);

  return (
    <div style={{ padding: 16 }}>
      <h1>Slots suchen</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 12 }}>
        <div>
          <label>Sport</label>
          <select value={sportId} onChange={e => setSportId(e.target.value)} style={{ width: '100%' }}>
            <option value="">Alle</option>
            {sports.map(s => <option key={s.id} value={s.id}>{s.name_de || s.name}</option>)}
          </select>
        </div>
        <div>
          <label>Datum</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label>Stadt</label>
          <select value={city} onChange={e => setCity(e.target.value)} style={{ width: '100%' }}>
            <option value="">Alle</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label>Dauer (Minuten)</label>
          <select value={duration} onChange={e => setDuration(parseInt(e.target.value))} style={{ width: '100%' }}>
            <option value={60}>60</option>
            <option value={90}>90</option>
            <option value={120}>120</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 12, color: '#6db' }}>{loading ? 'Lade...' : resultsText}</div>
      {error && <div style={{ marginTop: 8, color: '#ff6b6b' }}>❌ {error}</div>}

      <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        {slots.map(slot => (
          <div key={slot.id} style={{ border: '1px solid #26493c', borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{slot.location_name} · {slot.asset_name}</div>
              <div style={{ color: '#9db' }}>
                {new Date(slot.start_time).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {new Date(slot.end_time).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ color: '#6db' }}>€{parseFloat(slot.base_price || 0).toFixed(2)}</div>
            </div>
            <button
              onClick={() => navigate(`/book/slot/${slot.id}`)}
              style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              disabled={!token}
              title={!token ? 'Bitte anmelden' : 'Slot prüfen'}
            >
              Book
            </button>
          </div>
        ))}
        {slots.length === 0 && !loading && (
          <div style={{ color: '#9db' }}>Keine Ergebnisse für die gewählten Filter.</div>
        )}
      </div>
    </div>
  );
}
