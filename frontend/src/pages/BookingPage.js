import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import BookingConfirmationPopup from '../components/BookingConfirmationPopup';

export default function BookingPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userCity = localStorage.getItem('userCity') || '';

  const [filters, setFilters] = useState({
    sport: '',
    city: userCity,
    date: new Date().toISOString().split('T')[0],
    duration: 60
  });

  const [weekSlots, setWeekSlots] = useState([]);
  const [cities, setCities] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));

  useEffect(() => {
    loadCities();
    loadSports();
  }, []);

  useEffect(() => {
    loadWeekSlots();
  }, [filters, currentWeekStart]);

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  function getWeekDates(startDate) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }

  function navigateWeek(direction) {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + (direction * 7));
    setCurrentWeekStart(newStart);
  }

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

  async function loadWeekSlots() {
    try {
      setLoading(true);
      setError('');

      const weekDates = getWeekDates(currentWeekStart);
      const endDate = new Date(weekDates[6]);
      endDate.setHours(23, 59, 59);

      const params = new URLSearchParams({
        start_date: currentWeekStart.toISOString(),
        end_date: endDate.toISOString(),
        ...(filters.city && { city: filters.city }),
        ...(filters.sport && { sport_id: filters.sport })
      });

      const res = await fetch(`${API_BASE}/slots/search?${params}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          setWeekSlots([]);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setWeekSlots(Array.isArray(data) ? data : []);

    } catch (err) {
      console.error('Failed to load week slots:', err);
      setError('Fehler beim Laden der Plätze');
      setWeekSlots([]);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(field, value) {
    setFilters(prev => ({ ...prev, [field]: value }));
  }

  function handleBookSlot() {
    if (!token) {
      alert('Bitte melde dich an, um zu buchen');
      navigate('/login');
      return;
    }
    setShowConfirmation(true);
  }

  function handleBookingSuccess() {
    setShowConfirmation(false);
    setSelectedSlot(null);
    alert('Buchung erfolgreich!');
    loadWeekSlots();
  }

  function getSlotsForDayAndHour(date, hour) {
    const dateStr = date.toISOString().split('T')[0];
    return weekSlots.filter(slot => {
      const slotDate = new Date(slot.start_time);
      const slotDateStr = slotDate.toISOString().split('T')[0];
      const slotHour = slotDate.getHours();
      return slotDateStr === dateStr && slotHour === hour;
    });
  }

  const weekDates = getWeekDates(currentWeekStart);
  const timeSlots = Array.from({ length: 11 }, (_, i) => i + 10);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: 20, color: '#e5e7eb' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#e5e7eb', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          ← Zurück
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e7eb', margin: 0 }}>Platz buchen</h1>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto 20px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#10b981', marginBottom: 6 }}>🏀 Sportart</label>
            <select value={filters.sport} onChange={(e) => handleFilterChange('sport', e.target.value)} style={{ padding: '8px 10px', background: '#0a0a0a', border: '1px solid #333', borderRadius: 6, color: '#e5e7eb', fontSize: 14, width: '100%' }}>
              <option value="">Alle Sportarten</option>
              {sports.map(sport => <option key={sport.id} value={sport.id}>{sport.name_de || sport.name}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#10b981', marginBottom: 6 }}>📍 Stadt</label>
            <select value={filters.city} onChange={(e) => handleFilterChange('city', e.target.value)} style={{ padding: '8px 10px', background: '#0a0a0a', border: '1px solid #333', borderRadius: 6, color: '#e5e7eb', fontSize: 14, width: '100%' }}>
              <option value="">Alle Städte</option>
              {cities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#10b981', marginBottom: 6 }}>📅 Datum</label>
            <input type="date" value={filters.date} onChange={(e) => handleFilterChange('date', e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ padding: '8px 10px', background: '#0a0a0a', border: '1px solid #333', borderRadius: 6, color: '#e5e7eb', fontSize: 14, width: '100%' }} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#10b981', marginBottom: 6 }}>⏱️ Dauer</label>
            <select value={filters.duration} onChange={(e) => handleFilterChange('duration', parseInt(e.target.value))} style={{ padding: '8px 10px', background: '#0a0a0a', border: '1px solid #333', borderRadius: 6, color: '#e5e7eb', fontSize: 14, width: '100%' }}>
              <option value={60}>1 Stunde</option>
              <option value={90}>1.5 Stunden</option>
              <option value={120}>2 Stunden</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div style={{ maxWidth: 1400, margin: '0 auto 16px', padding: 12, background: '#dc2626', borderRadius: 8, color: 'white', fontSize: 14 }}>⚠️ {error}</div>}

      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 600, background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button onClick={() => navigateWeek(-1)} style={{ padding: '8px 12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: 6, color: '#e5e7eb', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              ← Vorherige Woche
            </button>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e5e7eb' }}>
              {weekDates[0].toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} - {weekDates[6].toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <button onClick={() => navigateWeek(1)} style={{ padding: '8px 12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: 6, color: '#e5e7eb', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Nächste Woche →
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              <p>Lade Kalender...</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 8px', background: '#0a0a0a', border: '1px solid #333', fontSize: 13, fontWeight: 600, color: '#10b981', textAlign: 'left', minWidth: 60 }}>Zeit</th>
                    {weekDates.map((date, i) => (
                      <th key={i} style={{ padding: '10px 8px', background: '#0a0a0a', border: '1px solid #333', fontSize: 13, fontWeight: 600, color: '#10b981', textAlign: 'center', minWidth: 100 }}>
                        <div>{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][i]}</div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', marginTop: 2 }}>{date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map(hour => (
                    <tr key={hour}>
                      <td style={{ padding: '12px 8px', background: '#0a0a0a', border: '1px solid #333', fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>
                        {`${hour.toString().padStart(2, '0')}:00`}
                      </td>
                      {weekDates.map((date, dayIdx) => {
                        const slots = getSlotsForDayAndHour(date, hour);
                        const hasSlots = slots.length > 0;
                        const isBooked = slots.some(s => s.booking_id);
                        
                        return (
                          <td 
                            key={dayIdx}
                            onClick={() => hasSlots && !isBooked && setSelectedSlot(slots[0])}
                            style={{ 
                              padding: 12, 
                              background: hasSlots ? (isBooked ? '#2a2a2a' : '#0a0a0a') : '#0a0a0a',
                              border: '1px solid #333', 
                              textAlign: 'center',
                              cursor: hasSlots && !isBooked ? 'pointer' : 'default',
                              position: 'relative'
                            }}
                          >
                            {hasSlots && (
                              <div style={{ 
                                width: 12, 
                                height: 12, 
                                borderRadius: '50%', 
                                background: isBooked ? '#f59e0b' : '#10b981',
                                margin: '0 auto',
                                border: '2px solid ' + (isBooked ? '#f59e0b' : '#10b981')
                              }} />
                            )}
                            {hasSlots && !isBooked && (
                              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                                {slots.length}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ width: 340, background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: 16 }}>
          {selectedSlot ? (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 12 }}>Slot Details</h3>
              
              <div style={{ width: '100%', height: 180, background: '#0a0a0a', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333' }}>
                <span style={{ fontSize: 48 }}>🏀</span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>
                  {selectedSlot.asset_name}
                </div>
                <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 4 }}>
                  📍 {selectedSlot.location_name}
                </div>
                <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 8 }}>
                  {selectedSlot.city}
                </div>
                {selectedSlot.sport_name && (
                  <div style={{ display: 'inline-block', padding: '4px 12px', background: '#10b981', borderRadius: 4, fontSize: 12, fontWeight: 600, color: 'white', marginBottom: 12 }}>
                    {selectedSlot.sport_name}
                  </div>
                )}
              </div>

              <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>
                  🕐 Zeit
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#e5e7eb', marginBottom: 12 }}>
                  {new Date(selectedSlot.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedSlot.end_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>
                  ⏱️ Dauer
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#e5e7eb', marginBottom: 12 }}>
                  {selectedSlot.duration_minutes} Minuten
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 6 }}>
                  💰 Preis
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>
                  €{parseFloat(selectedSlot.base_price || 0).toFixed(2)}
                </div>
              </div>

              <button 
                onClick={handleBookSlot}
                disabled={!token}
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  background: token ? '#10b981' : '#666', 
                  border: 'none', 
                  borderRadius: 8, 
                  color: 'white', 
                  fontSize: 16, 
                  fontWeight: 700, 
                  cursor: token ? 'pointer' : 'not-allowed' 
                }}
              >
                {token ? 'Jetzt buchen' : 'Anmelden zum Buchen'}
              </button>

              {!token && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  Du musst angemeldet sein, um zu buchen
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
              <div style={{ fontSize: 16, color: '#e5e7eb', fontWeight: 600, marginBottom: 8 }}>
                Wähle einen Slot
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>
                Klicke auf einen grünen Punkt im Kalender, um Details zu sehen
              </div>
            </div>
          )}
        </div>
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
