import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import BookingConfirmationPopup from '../components/BookingConfirmationPopup';

export default function BookingPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userCity = localStorage.getItem('userCity') || '';

  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '18:00',
    duration: 60,
    city: userCity,
    sport: ''
  });

  const [availableSlots, setAvailableSlots] = useState([]);
  const [cities, setCities] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    loadCities();
    loadSports();
  }, []);

  useEffect(() => {
    searchAvailableSlots();
  }, [filters]);

  async function loadCities() {
    try {
      const res = await fetch(`${API_BASE}/locations/cities`);
      if (res.ok) {
        const data = await res.json();
        setCities(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load cities:', err);
    }
  }

  async function loadSports() {
    try {
      const res = await fetch(`${API_BASE}/sports/list`);
      if (res.ok) {
        const data = await res.json();
        setSports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load sports:', err);
    }
  }

  async function searchAvailableSlots() {
    if (!filters.date || !filters.time) return;

    try {
      setLoading(true);
      setError('');

      const datetime = `${filters.date}T${filters.time}:00`;
      
      const params = new URLSearchParams({
        datetime,
        duration: filters.duration,
        ...(filters.city && { city: filters.city }),
        ...(filters.sport && { sport_id: filters.sport })
      });

      const res = await fetch(`${API_BASE}/slots/search?${params}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          setAvailableSlots([]);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setAvailableSlots(Array.isArray(data) ? data : []);

    } catch (err) {
      console.error('Failed to search slots:', err);
      setError('Fehler beim Suchen der verfügbaren Plätze');
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(field, value) {
    setFilters(prev => ({ ...prev, [field]: value }));
  }

  function handleBookSlot(slot) {
    if (!token) {
      alert('Bitte melde dich an, um zu buchen');
      navigate('/login');
      return;
    }
    setSelectedSlot(slot);
    setShowConfirmation(true);
  }

  function handleBookingSuccess() {
    setShowConfirmation(false);
    setSelectedSlot(null);
    alert('Buchung erfolgreich!');
    searchAvailableSlots();
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: 20, color: '#e5e7eb' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto 30px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: '#374151', border: 'none', borderRadius: 8, color: '#e5e7eb', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          ← Zurück
        </button>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>Platz buchen</h1>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto 30px', background: '#1f2937', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>📅 Datum</label>
            <input type="date" value={filters.date} onChange={(e) => handleFilterChange('date', e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ padding: '10px 12px', background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#e5e7eb', fontSize: 14, width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>🕐 Uhrzeit</label>
            <input type="time" value={filters.time} onChange={(e) => handleFilterChange('time', e.target.value)} style={{ padding: '10px 12px', background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#e5e7eb', fontSize: 14, width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>⏱️ Dauer</label>
            <select value={filters.duration} onChange={(e) => handleFilterChange('duration', parseInt(e.target.value))} style={{ padding: '10px 12px', background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#e5e7eb', fontSize: 14, width: '100%' }}>
              <option value={60}>1 Stunde</option>
              <option value={90}>1.5 Stunden</option>
              <option value={120}>2 Stunden</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>📍 Stadt</label>
            <select value={filters.city} onChange={(e) => handleFilterChange('city', e.target.value)} style={{ padding: '10px 12px', background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#e5e7eb', fontSize: 14, width: '100%' }}>
              <option value="">Alle Städte</option>
              {cities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>🏀 Sport</label>
            <select value={filters.sport} onChange={(e) => handleFilterChange('sport', e.target.value)} style={{ padding: '10px 12px', background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#e5e7eb', fontSize: 14, width: '100%' }}>
              <option value="">Alle Sportarten</option>
              {sports.map(sport => <option key={sport.id} value={sport.id}>{sport.name_de || sport.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>&nbsp;</label>
            <button onClick={searchAvailableSlots} disabled={loading} style={{ padding: '10px 20px', background: '#10b981', border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
              {loading ? '🔄 Suche...' : '🔍 Suchen'}
            </button>
          </div>
        </div>
      </div>

      {error && <div style={{ maxWidth: 1400, margin: '0 auto 20px', padding: 16, background: '#7f1d1d', borderRadius: 8, color: '#fecaca', fontSize: 14 }}>⚠️ {error}</div>}

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#e5e7eb', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          Verfügbare Plätze
          {availableSlots.length > 0 && <span style={{ fontSize: 18, color: '#10b981', fontWeight: 600 }}>({availableSlots.length})</span>}
        </h2>

        {loading ? (
          <div style={{ background: '#1f2937', borderRadius: 12, padding: 60, textAlign: 'center', color: '#9ca3af' }}>
            <p>Suche verfügbare Plätze...</p>
          </div>
        ) : availableSlots.length === 0 ? (
          <div style={{ background: '#1f2937', borderRadius: 12, padding: 60, textAlign: 'center' }}>
            <p style={{ color: '#e5e7eb', fontSize: 16, marginBottom: 12 }}>Keine verfügbaren Plätze für die gewählten Filter gefunden.</p>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Versuche ein anderes Datum, eine andere Zeit oder einen anderen Ort.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {availableSlots.map(slot => (
              <SlotCard key={slot.id} slot={slot} onBook={() => handleBookSlot(slot)} />
            ))}
          </div>
        )}
      </div>

      {showConfirmation && selectedSlot && (
        <BookingConfirmationPopup
          slot={selectedSlot}
          onClose={() => { setShowConfirmation(false); setSelectedSlot(null); }}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  );
}

function SlotCard({ slot, onBook }) {
  const startTime = new Date(slot.start_time);
  const endTime = new Date(slot.end_time);

  return (
    <div style={{ background: '#1f2937', borderRadius: 12, padding: 20, border: '1px solid #374151' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ padding: '4px 12px', background: '#374151', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>
          📍 {slot.location_name}
        </div>
        {slot.sport_name && (
          <div style={{ padding: '4px 12px', background: '#10b981', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'white' }}>
            {slot.sport_name}
          </div>
        )}
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>{slot.asset_name}</h3>
      <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 12 }}>{slot.city}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>
        🕐 {startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 12 }}>⏱️ {slot.duration_minutes} Minuten</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #374151' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>€{parseFloat(slot.base_price || 0).toFixed(2)}</div>
        <button onClick={onBook} style={{ padding: '10px 24px', background: '#10b981', border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Jetzt buchen
        </button>
      </div>
    </div>
  );
}
