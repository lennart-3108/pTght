import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../config';
import SportSelector from '../components/SportSelector';
import SlotBookingConfirmationPopup from '../components/SlotBookingConfirmationPopup';

export default function SlotSearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Helper function to get next 15-minute mark (00, 15, 30, 45)
  const getNext15MinuteMark = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const nextMark = Math.ceil(minutes / 15) * 15;
    
    if (nextMark >= 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
    } else {
      now.setMinutes(nextMark);
    }
    now.setSeconds(0);
    return now.toTimeString().slice(0, 5);
  };

  // Round any time to nearest 15-minute mark
  const roundTo15Minutes = (timeString) => {
    if (!timeString || !timeString.includes(':')) return getNext15MinuteMark();
    const [h, m] = timeString.split(':').map(Number);
    const roundedMinutes = Math.round(m / 15) * 15;
    
    if (roundedMinutes >= 60) {
      const newH = (h + 1) % 24;
      return `${String(newH).padStart(2, '0')}:00`;
    }
    return `${String(h).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`;
  };

  // Tab state
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'series' | 'mybookings'

  // Single booking state - initialize from URL params
  const [sportId, setSportId] = useState(searchParams.get('sportId') || '');
  const [date, setDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(roundTo15Minutes(searchParams.get('time')) || getNext15MinuteMark());
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [duration, setDuration] = useState(60);

  // Series booking state
  const [seriesSportId, setSeriesSportId] = useState('');
  const [seriesCity, setSeriesCity] = useState('');
  const [seriesAssetId, setSeriesAssetId] = useState('');
  const [seriesWeekday, setSeriesWeekday] = useState('1'); // 1=Mo, 7=So
  const [seriesTime, setSeriesTime] = useState('18:00');
  const [seriesDuration, setSeriesDuration] = useState('12'); // months
  const [assets, setAssets] = useState([]);
  const [seriesPrice, setSeriesPrice] = useState(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  const [sports, setSports] = useState([]);
  const [sportCategories, setSportCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sportDropdownOpen, setSportDropdownOpen] = useState(false);
  const [selectedSportName, setSelectedSportName] = useState('');

  // My bookings state
  const [myBookings, setMyBookings] = useState([]);
  const [mySeries, setMySeries] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  
  // Booking confirmation popup state
  const [showBookingPopup, setShowBookingPopup] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, scRes, cRes] = await Promise.all([
          fetch(`${API_BASE}/sports/list`),
          fetch(`${API_BASE}/sports/categories`),
          fetch(`${API_BASE}/locations/cities`)
        ]);
        const s = await sRes.json().catch(() => []);
        const sc = await scRes.json().catch(() => []);
        const c = await cRes.json().catch(() => []);
        if (sRes.ok) setSports(Array.isArray(s) ? s : []);
        if (scRes.ok) setSportCategories(Array.isArray(sc) ? sc : []);
        if (cRes.ok) setCities(Array.isArray(c) ? c : []);
      } catch {}
    })();
  }, []);

  // Set selectedSportName when sportId is set from URL or changed
  useEffect(() => {
    if (sportId && sports.length > 0) {
      const sport = sports.find(s => String(s.id) === String(sportId));
      if (sport) setSelectedSportName(sport.name);
    }
  }, [sportId, sports]);

  // Load assets when city/sport changes
  useEffect(() => {
    if (!seriesCity || !seriesSportId) {
      setAssets([]);
      return;
    }
    (async () => {
      try {
        const params = new URLSearchParams();
        params.append('city', seriesCity);
        params.append('sport_id', seriesSportId);
        const res = await fetch(`${API_BASE}/assets?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to load assets');
        const data = await res.json();
        setAssets(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Load assets failed:', e);
        setAssets([]);
      }
    })();
  }, [seriesCity, seriesSportId]);

  // Calculate series price
  async function calculateSeriesPrice() {
    if (!seriesAssetId || !seriesWeekday || !seriesTime || !seriesDuration) {
      setSeriesPrice(null);
      return;
    }
    try {
      setCalculatingPrice(true);
      const res = await fetch(`${API_BASE}/bookings/series/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          asset_id: seriesAssetId,
          weekday: parseInt(seriesWeekday),
          time: seriesTime,
          duration_months: parseInt(seriesDuration)
        })
      });
      if (!res.ok) throw new Error('Price calculation failed');
      const data = await res.json();
      setSeriesPrice(data.total_price || 0);
    } catch (e) {
      console.error('Calculate price failed:', e);
      setSeriesPrice(null);
    } finally {
      setCalculatingPrice(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'series') {
      calculateSeriesPrice();
    } else if (activeTab === 'mybookings') {
      loadMyBookings();
    }
  }, [seriesAssetId, seriesWeekday, seriesTime, seriesDuration, activeTab]);

  async function loadMyBookings() {
    if (!token) return;
    try {
      setLoadingBookings(true);
      const res = await fetch(`${API_BASE}/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load bookings');
      const data = await res.json();
      setMyBookings(data.bookings || []);
      setMySeries(data.series || []);
    } catch (e) {
      console.error('Load bookings failed:', e);
    } finally {
      setLoadingBookings(false);
    }
  }

  async function toggleResale(bookingId, currentStatus) {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}/resale`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ available: !currentStatus })
      });
      if (!res.ok) throw new Error('Failed to toggle resale');
      // Reload bookings
      await loadMyBookings();
    } catch (e) {
      alert(`Fehler: ${e.message}`);
    }
  }

  async function bookSeries() {
    if (!token) {
      alert('Bitte anmelden');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/bookings/series`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          asset_id: seriesAssetId,
          weekday: parseInt(seriesWeekday),
          time: seriesTime,
          duration_months: parseInt(seriesDuration)
        })
      });
      if (!res.ok) throw new Error('Booking failed');
      const data = await res.json();
      // Open PayPal payment in new window
      if (data.payment_url) {
        window.open(data.payment_url, '_blank');
        alert('Bitte schließe die Zahlung in dem neuen Fenster ab.');
      } else {
        alert('Serienbuchung erfolgreich!');
        navigate('/bookings');
      }
    } catch (e) {
      alert(`Fehler: ${e.message}`);
    }
  }

  async function search() {
    if (!date || !time) return;
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      // Backend expects datetime + duration
      const [hours, minutes] = time.split(':');
      const target = new Date(`${date}T${hours}:${minutes}:00`);
      params.append('datetime', target.toISOString());
      params.append('duration', String(duration));
      if (sportId) params.append('sport_id', sportId);
      if (city) params.append('city', city);
      params.append('prioritize_time', 'true'); // New parameter for time prioritization
      const res = await fetch(`${API_BASE}/slots/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => []);
      
      // Don't filter by current time - user can search for any time
      // Backend and booking logic will handle validation
      const filteredData = Array.isArray(data) ? data : [];
      
      // Sort slots chronologically by start time
      const sortedData = filteredData.sort((a, b) => {
        const aStart = new Date(a.start_time);
        const bStart = new Date(b.start_time);
        
        // Sort by start time (chronological order)
        return aStart.getTime() - bStart.getTime();
      });
      
      setSlots(sortedData);
    } catch (e) {
      setError(e.message || 'Fehler bei der Suche');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { search(); }, [sportId, date, time, city, duration]);

  const resultsText = useMemo(() => {
    return `${slots.length} Slots gefunden`;
  }, [slots]);

  async function quickTestLogin() {
    try {
      // First try to register a test user
      const regRes = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@test.de',
          password: 'test123',
          firstname: 'Test',
          lastname: 'User',
          birthday: '1990-01-01',
          accept_terms: true,
          accept_gdpr: true,
          country_code: 'DE'
        })
      }).catch(() => null); // Ignore if already exists
      
      // Then login
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.de', password: 'test123' })
      });
      if (!res.ok) throw new Error('Login fehlgeschlagen');
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        window.location.reload();
      }
    } catch (e) {
      alert(`Test-Login fehlgeschlagen: ${e.message}`);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <h1>Platz buchen</h1>
      
      {/* Quick Test Login for Development */}
      {!token && (
        <div style={{ background: '#debc7c', color: '#081c19', padding: 12, borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>🔒 Du bist nicht eingeloggt</span>
          <button
            onClick={quickTestLogin}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#081c19',
              color: '#debc7c',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Test-Login (test@test.de)
          </button>
        </div>
      )}
      
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #2f6b57' }}>
        <button
          onClick={() => setActiveTab('single')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'single' ? '#debc7c' : 'transparent',
            color: activeTab === 'single' ? '#10261f' : '#e8efe8',
            fontWeight: 700,
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0',
            fontSize: 15
          }}
        >
          Einzelbuchung
        </button>
        <button
          onClick={() => setActiveTab('series')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: activeTab === 'series' ? '#debc7c' : 'transparent',
            color: activeTab === 'series' ? '#10261f' : '#e8efe8',
            fontWeight: 700,
            cursor: 'pointer',
            borderRadius: '8px 8px 0 0',
            fontSize: 15
          }}
        >
          Slot-Abos & Serienbuchungen
        </button>
        {token && (
          <button
            onClick={() => setActiveTab('mybookings')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: activeTab === 'mybookings' ? '#debc7c' : 'transparent',
              color: activeTab === 'mybookings' ? '#10261f' : '#e8efe8',
              fontWeight: 700,
              cursor: 'pointer',
              borderRadius: '8px 8px 0 0',
              fontSize: 15
            }}
          >
            Meine Buchungen
          </button>
        )}
      </div>

      {activeTab === 'single' && (
      <div>
      <div style={{ background: 'rgba(127,252,204,0.05)', border: '1px solid #2f6b57', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#7fc' }}>🎾 Freie Plätze finden</h3>
        <p style={{ margin: 0, color: '#8bbfad', fontSize: 14 }}>Wähle deinen gewünschten Sport, Stadt und Zeitpunkt. Wir zeigen dir zuerst Plätze zur gewünschten Uhrzeit.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#e8efe8' }}>Sport</label>
          <SportSelector
            sports={sportCategories}
            value={selectedSportName}
            onChange={(name, id) => {
              setSelectedSportName(name);
              setSportId(id ? String(id) : '');
            }}
            placeholder="Alle Sportarten"
            onOpen={() => setSportDropdownOpen(true)}
            isOpen={sportDropdownOpen}
            onClose={() => setSportDropdownOpen(false)}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#e8efe8' }}>Stadt</label>
          <select 
            value={city} 
            onChange={e => setCity(e.target.value)} 
            style={{ 
              width: '100%', 
              padding: '10px 14px', 
              borderRadius: 10, 
              border: '1px solid #2f6b57', 
              background: '#0b1e19', 
              color: '#e8efe8', 
              fontSize: 15 
            }}
          >
            <option value="">Alle Städte</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#e8efe8' }}>Datum</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() - 1);
                setDate(d.toISOString().split('T')[0]);
              }}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #2f6b57',
                background: '#0b1e19',
                color: '#7fc',
                fontSize: 20,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1a3329'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#0b1e19'}
            >−</button>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              style={{ 
                flex: 1,
                padding: '10px', 
                borderRadius: 8, 
                border: '1px solid #2f6b57', 
                background: '#0b1e19', 
                color: '#e8efe8', 
                fontSize: 14 
              }} 
            />
            <button
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() + 1);
                setDate(d.toISOString().split('T')[0]);
              }}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #2f6b57',
                background: '#0b1e19',
                color: '#7fc',
                fontSize: 20,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1a3329'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#0b1e19'}
            >+</button>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#e8efe8' }}>⏰ Gewünschte Uhrzeit</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                const [h, m] = time.split(':').map(Number);
                let totalMinutes = h * 60 + m - 15;
                if (totalMinutes < 0) totalMinutes = 23 * 60 + 45;
                const newH = Math.floor(totalMinutes / 60);
                const newM = totalMinutes % 60;
                setTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
              }}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #2f6b57',
                background: '#0b1e19',
                color: '#7fc',
                fontSize: 20,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1a3329'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#0b1e19'}
            >−</button>
            <input 
              type="time" 
              value={time} 
              onChange={e => setTime(roundTo15Minutes(e.target.value))}
              step="900"
              style={{ 
                flex: 1,
                padding: '10px', 
                borderRadius: 8, 
                border: '1px solid #2f6b57', 
                background: '#0b1e19', 
                color: '#e8efe8', 
                fontSize: 16,
                fontWeight: 600,
                textAlign: 'center'
              }} 
            />
            <button
              onClick={() => {
                const [h, m] = time.split(':').map(Number);
                let totalMinutes = h * 60 + m + 15;
                if (totalMinutes >= 24 * 60) totalMinutes = 0;
                const newH = Math.floor(totalMinutes / 60);
                const newM = totalMinutes % 60;
                setTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
              }}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #2f6b57',
                background: '#0b1e19',
                color: '#7fc',
                fontSize: 20,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1a3329'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#0b1e19'}
            >+</button>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#e8efe8' }}>Dauer</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                if (duration > 30) setDuration(duration - 30);
              }}
              disabled={duration <= 30}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #2f6b57',
                background: duration > 30 ? '#0b1e19' : '#0a1915',
                color: duration > 30 ? '#7fc' : '#4a6b57',
                fontSize: 20,
                fontWeight: 700,
                cursor: duration > 30 ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
                opacity: duration > 30 ? 1 : 0.5
              }}
              onMouseEnter={(e) => { if (duration > 30) e.currentTarget.style.background = '#1a3329'; }}
              onMouseLeave={(e) => { if (duration > 30) e.currentTarget.style.background = '#0b1e19'; }}
            >−</button>
            <div style={{
              flex: 1,
              padding: '10px',
              borderRadius: 8,
              border: '1px solid #2f6b57',
              background: '#0b1e19',
              color: '#e8efe8',
              fontSize: 16,
              fontWeight: 600,
              textAlign: 'center'
            }}>
              {duration} min
            </div>
            <button
              onClick={() => {
                if (duration < 180) setDuration(duration + 30);
              }}
              disabled={duration >= 180}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #2f6b57',
                background: duration < 180 ? '#0b1e19' : '#0a1915',
                color: duration < 180 ? '#7fc' : '#4a6b57',
                fontSize: 20,
                fontWeight: 700,
                cursor: duration < 180 ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
                opacity: duration < 180 ? 1 : 0.5
              }}
              onMouseEnter={(e) => { if (duration < 180) e.currentTarget.style.background = '#1a3329'; }}
              onMouseLeave={(e) => { if (duration < 180) e.currentTarget.style.background = '#0b1e19'; }}
            >+</button>
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#7fc' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <div>Suche verfügbare Plätze...</div>
      </div>}

      {!loading && (
        <>
        {slots.length === 0 ? (
          <div style={{ background: '#0f2b27', border: '1px solid #2f6b57', borderRadius: 10, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#e8efe8' }}>Keine freien Plätze gefunden</div>
            <div style={{ color: '#8bbfad' }}>Versuche es mit anderen Filtern oder einem anderen Datum.</div>
          </div>
        ) : (
          <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#7fc', fontWeight: 600, fontSize: 16 }}>
              {slots.length} {slots.length === 1 ? 'Platz' : 'Plätze'} verfügbar
            </div>
            <div style={{ color: '#9db', fontSize: 13 }}>
              Sortiert nach Verfügbarkeit zur gewünschten Uhrzeit
            </div>
          </div>
          
          <div style={{ display: 'grid', gap: 12 }}>
            {slots.map((slot, index) => {
              const slotStart = new Date(slot.start_time);
              const slotEnd = new Date(slot.end_time);
              const targetTime = new Date(`${date}T${time}:00`);
              const isExactMatch = Math.abs(slotStart.getTime() - targetTime.getTime()) < 5 * 60 * 1000; // Within 5 min
              const isResale = slot.is_resale;
              
              // Calculate dynamic price based on duration
              const slotDurationMinutes = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
              const basePricePerHour = parseFloat(slot.base_price || 20);
              const calculatedPrice = (basePricePerHour / 60) * slotDurationMinutes;
              
              return (
                <div key={slot.id || slot.booking_id || index} style={{ 
                  border: isResale ? '2px solid #debc7c' : (isExactMatch ? '2px solid #7fc' : '1px solid #2f6b57'), 
                  borderRadius: 10, 
                  padding: 16, 
                  background: isExactMatch ? 'rgba(127,252,204,0.05)' : '#0f2b27',
                  display: 'grid', 
                  gridTemplateColumns: '1fr auto', 
                  alignItems: 'center',
                  gap: 16
                }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {isResale && <span style={{ background: '#debc7c', color: '#081c19', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>💰 RESALE</span>}
                      {isExactMatch && <span style={{ background: '#7fc', color: '#081c19', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>✓ ZUR GEWÜNSCHTEN ZEIT</span>}
                      {index === 0 && !isExactMatch && !isResale && <span style={{ background: '#debc7c', color: '#081c19', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>🔹 NÄCHSTER FREIER SLOT</span>}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: '#e8efe8' }}>
                      {slot.location_name} · {slot.asset_name}
                    </div>
                    <div style={{ color: '#8bbfad', fontSize: 14, marginBottom: 4 }}>
                      📅 {slotStart.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      {' '}
                      ⏰ {slotStart.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {slotEnd.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                    </div>
                    {slot.surface && <div style={{ color: '#9db', fontSize: 13 }}>🎾 {slot.surface}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#7fc', marginBottom: 8 }}>€{calculatedPrice.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#8bbfad', marginBottom: 6 }}>{slotDurationMinutes} min · €{basePricePerHour.toFixed(2)}/60min</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!token) {
                          alert('Bitte melde dich an, um zu buchen.');
                          return;
                        }
                        // Open booking confirmation popup
                        setSelectedSlot({
                          ...slot,
                          isResale
                        });
                        setShowBookingPopup(true);
                      }}
                      disabled={!token}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: token ? (isResale ? '#debc7c' : '#7fc') : '#444',
                        color: '#081c19',
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: token ? 'pointer' : 'not-allowed',
                        opacity: token ? 1 : 0.5,
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => { if (token) e.currentTarget.style.background = isResale ? '#c9a65c' : '#5fa'; }}
                      onMouseLeave={(e) => { if (token) e.currentTarget.style.background = isResale ? '#debc7c' : '#7fc'; }}
                    >
                      {token ? (isResale ? 'Resale buchen' : 'Jetzt buchen') : 'Login erforderlich'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
        </>
      )}
      {error && <div style={{ marginTop: 16, padding: 16, background: 'rgba(255,107,107,0.1)', border: '1px solid #ff6b6b', borderRadius: 10, color: '#ff6b6b' }}>❌ {error}</div>}
      </div>
      )}

      {activeTab === 'series' && (
      <div>
        <div style={{ background: 'rgba(222,188,124,0.1)', border: '1px solid #debc7c', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#debc7c' }}>🎫 Slot-Abo</h3>
          <p style={{ margin: 0, color: '#8bbfad', fontSize: 14 }}>Buche deinen Lieblingsslot für mehrere Monate im Voraus. Zahle einmalig und sichere dir deinen festen Termin!</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Sport</label>
            <select value={seriesSportId} onChange={e => setSeriesSportId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #2f6b57', background: '#0b1e19', color: '#e8efe8' }}>
              <option value="">Bitte wählen</option>
              {sports.map(s => <option key={s.id} value={s.id}>{s.name_de || s.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Stadt</label>
            <select value={seriesCity} onChange={e => setSeriesCity(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #2f6b57', background: '#0b1e19', color: '#e8efe8' }}>
              <option value="">Bitte wählen</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Anlage</label>
            <select value={seriesAssetId} onChange={e => setSeriesAssetId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #2f6b57', background: '#0b1e19', color: '#e8efe8' }} disabled={!assets.length}>
              <option value="">Bitte wählen</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.location_name})</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Wochentag</label>
            <select value={seriesWeekday} onChange={e => setSeriesWeekday(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #2f6b57', background: '#0b1e19', color: '#e8efe8' }}>
              <option value="1">Montag</option>
              <option value="2">Dienstag</option>
              <option value="3">Mittwoch</option>
              <option value="4">Donnerstag</option>
              <option value="5">Freitag</option>
              <option value="6">Samstag</option>
              <option value="7">Sonntag</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Uhrzeit</label>
            <input type="time" value={seriesTime} onChange={e => setSeriesTime(e.target.value)} step="900" style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #2f6b57', background: '#0b1e19', color: '#e8efe8' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Laufzeit</label>
            <select value={seriesDuration} onChange={e => setSeriesDuration(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #2f6b57', background: '#0b1e19', color: '#e8efe8' }}>
              <option value="1">1 Monat</option>
              <option value="3">3 Monate</option>
              <option value="6">6 Monate</option>
              <option value="12">12 Monate</option>
            </select>
          </div>
        </div>

        {seriesPrice !== null && (
          <div style={{ background: '#0f2b27', border: '1px solid #2f6b57', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, color: '#8bbfad', marginBottom: 4 }}>Gesamtpreis für {seriesDuration} Monat{seriesDuration !== '1' ? 'e' : ''}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#debc7c' }}>€{parseFloat(seriesPrice).toFixed(2)}</div>
                <div style={{ fontSize: 12, color: '#9db', marginTop: 4 }}>Einmalige Zahlung via PayPal</div>
              </div>
              <button
                onClick={bookSeries}
                disabled={!token || calculatingPrice}
                style={{
                  padding: '14px 28px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#debc7c',
                  color: '#10261f',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: token && !calculatingPrice ? 'pointer' : 'not-allowed',
                  opacity: token && !calculatingPrice ? 1 : 0.5
                }}
              >
                {calculatingPrice ? 'Berechne...' : 'Jetzt buchen'}
              </button>
            </div>
          </div>
        )}

        {!seriesPrice && seriesAssetId && (
          <div style={{ color: '#9db', textAlign: 'center', padding: 20 }}>
            {calculatingPrice ? 'Preis wird berechnet...' : 'Bitte wähle alle Optionen aus'}
          </div>
        )}
      </div>
      )}

      {activeTab === 'mybookings' && (
        <div>
          <div style={{ background: 'rgba(127,252,204,0.05)', border: '1px solid #2f6b57', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#7fc' }}>📅 Deine Buchungen</h3>
            <p style={{ margin: 0, color: '#8bbfad', fontSize: 14 }}>Verwalte deine Slot-Buchungen und gib nicht benötigte Plätze zum Weiterverkauf frei.</p>
          </div>

          {loadingBookings ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9db' }}>
              Laden...
            </div>
          ) : (
            <>
              {/* Series Bookings */}
              {mySeries.length > 0 && (
                <div style={{ marginBottom: 30 }}>
                  <h3 style={{ color: '#debc7c', marginBottom: 16 }}>Slot-Abos & Serien</h3>
                  {mySeries.map(series => (
                    <div key={series.id} style={{ background: '#0f2b27', border: '1px solid #2f6b57', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: '#e8efe8', marginBottom: 4 }}>
                            {series.sport_name} - {series.asset_name}
                          </div>
                          <div style={{ fontSize: 14, color: '#8bbfad', marginBottom: 2 }}>
                            📍 {series.location_name}
                          </div>
                          <div style={{ fontSize: 14, color: '#9db' }}>
                            ⏰ {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][parseInt(series.weekday) - 1]} {series.time} | {series.duration_months} Monat{series.duration_months > 1 ? 'e' : ''}
                          </div>
                          <div style={{ fontSize: 13, color: '#7fc', marginTop: 8, fontWeight: 600 }}>
                            {series.future_bookings_count} zukünftige Termine
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#debc7c', marginBottom: 4 }}>
                            €{parseFloat(series.total_price || 0).toFixed(2)}
                          </div>
                          <div style={{ fontSize: 12, color: '#9db' }}>
                            {series.status === 'confirmed' ? '✓ Bezahlt' : '⏳ Ausstehend'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Individual Bookings */}
              {myBookings.length > 0 && (
                <div>
                  <h3 style={{ color: '#debc7c', marginBottom: 16 }}>Einzelbuchungen</h3>
                  {myBookings.map(booking => {
                    const startDate = new Date(booking.start_time);
                    const isResaleActive = booking.available_for_resale;
                    
                    return (
                      <div key={booking.id} style={{ background: '#0f2b27', border: '1px solid #2f6b57', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 16, color: '#e8efe8', marginBottom: 4 }}>
                              {booking.sport_name || 'Sport'} - {booking.asset_name}
                            </div>
                            <div style={{ fontSize: 14, color: '#8bbfad', marginBottom: 2 }}>
                              📍 {booking.location_name}
                            </div>
                            <div style={{ fontSize: 14, color: '#9db', marginBottom: 2 }}>
                              📅 {startDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                            <div style={{ fontSize: 14, color: '#9db' }}>
                              ⏰ {startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - {new Date(booking.end_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {booking.series_id && (
                              <div style={{ fontSize: 12, color: '#7fc', marginTop: 6, fontWeight: 600 }}>
                                ♻️ Teil einer Serienbuchung
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: '#debc7c', marginBottom: 4 }}>
                              €{parseFloat(booking.price || booking.asset_price || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid #2f6b57', paddingTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button
                            onClick={() => toggleResale(booking.id, isResaleActive)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: 8,
                              border: isResaleActive ? '1px solid #f77' : '1px solid #7fc',
                              background: isResaleActive ? 'rgba(255,119,119,0.1)' : 'rgba(127,252,204,0.1)',
                              color: isResaleActive ? '#f77' : '#7fc',
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {isResaleActive ? '🚫 Resale deaktivieren' : '💰 Slot freigeben'}
                          </button>
                          {isResaleActive && (
                            <span style={{ fontSize: 12, color: '#7fc', fontWeight: 600 }}>
                              ✓ Für Resale verfügbar
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {myBookings.length === 0 && mySeries.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: '#9db' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Keine Buchungen vorhanden</div>
                  <div style={{ fontSize: 14 }}>Buche deinen ersten Slot in den anderen Tabs!</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Booking Confirmation Popup */}
      {showBookingPopup && selectedSlot && (
        <SlotBookingConfirmationPopup
          slot={selectedSlot}
          token={token}
          onClose={() => {
            setShowBookingPopup(false);
            setSelectedSlot(null);
          }}
          onConfirm={async (bookingOptions) => {
            try {
              const isResale = selectedSlot.isResale;
              
              if (isResale) {
                // Purchase resale slot
                const res = await fetch(`${API_BASE}/bookings/${selectedSlot.booking_id}/purchase-resale`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                  },
                  body: JSON.stringify({
                    payment_method: bookingOptions.paymentMethod,
                    split_cost: bookingOptions.splitCost,
                    split_user_id: bookingOptions.splitUserId
                  })
                });
                if (!res.ok) throw new Error('Buchung fehlgeschlagen');
                const data = await res.json();
                alert(`Erfolgreich gebucht! Der Vorbesitzer erhält €${parseFloat(data.credited_amount).toFixed(2)} Guthaben.`);
              } else {
                // Direct booking
                const res = await fetch(`${API_BASE}/bookings/direct`, {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                  },
                  body: JSON.stringify({
                    asset_id: selectedSlot.asset_id,
                    start_time: selectedSlot.start_time,
                    duration_minutes: selectedSlot.duration_minutes,
                    payment_method: bookingOptions.paymentMethod,
                    split_cost: bookingOptions.splitCost,
                    split_user_id: bookingOptions.splitUserId
                  })
                });
                if (!res.ok) throw new Error('Buchung fehlgeschlagen');
                const data = await res.json();
                
                // If split cost is enabled, show notification about split payment request
                if (bookingOptions.splitCost && bookingOptions.splitUserId) {
                  alert(`Erfolgreich gebucht! Eine Zahlungsanforderung wurde an den Mitspieler gesendet.`);
                } else {
                  alert(`Erfolgreich gebucht! Deine Buchung ist bestätigt.`);
                }
              }
              
              setShowBookingPopup(false);
              setSelectedSlot(null);
              search(); // Refresh the slots
            } catch (e) {
              throw new Error(e.message || 'Buchung fehlgeschlagen');
            }
          }}
        />
      )}
    </div>
  );
}
