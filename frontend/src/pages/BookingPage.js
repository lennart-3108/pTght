import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import BookingConfirmationPopup from '../components/BookingConfirmationPopup';
import { useResponsive } from '../hooks/useResponsive';

export default function BookingPage() {
  const navigate = useNavigate();
  const isMobile = useResponsive(768);
  const isTablet = useResponsive(1024);
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
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'list'

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

  // Gruppiere verfügbare Slots nach Datum für Listen-Ansicht
  const availableSlotsByDate = useMemo(() => {
    const grouped = {};
    weekSlots.filter(s => !s.booking_id).forEach(slot => {
      const date = new Date(slot.start_time).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(slot);
    });
    // Sortiere Slots nach Zeit innerhalb jedes Datums
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    });
    return grouped;
  }, [weekSlots]);

  const totalAvailableSlots = useMemo(() => {
    return weekSlots.filter(s => !s.booking_id).length;
  }, [weekSlots]);

  const weekDates = getWeekDates(currentWeekStart);
  const timeSlots = Array.from({ length: 11 }, (_, i) => i + 10);

  // Responsive Styles
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'var(--bg, #081c19)',
      padding: isMobile ? 12 : 20,
      color: 'var(--text, #e5e7eb)'
    },
    header: {
      maxWidth: 1400,
      margin: '0 auto 20px',
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? 8 : 16,
      flexWrap: 'wrap'
    },
    backBtn: {
      padding: isMobile ? '6px 12px' : '8px 16px',
      background: 'var(--surface, #111827)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 6,
      color: 'var(--text, #e5e7eb)',
      cursor: 'pointer',
      fontSize: 14,
      fontWeight: 600,
      transition: 'all 0.2s'
    },
    title: {
      fontSize: isMobile ? 20 : 28,
      fontWeight: 700,
      color: 'var(--text, #e5e7eb)',
      margin: 0
    },
    filterCard: {
      maxWidth: 1400,
      margin: '0 auto 20px',
      background: 'var(--surface, #111827)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: isMobile ? 12 : 16
    },
    filterGrid: {
      display: 'grid',
      gap: 12,
      gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'
    },
    label: {
      display: 'block',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--primary, #10b981)',
      marginBottom: 6
    },
    input: {
      padding: '10px 12px',
      background: 'var(--bg, #0a0a0a)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      color: 'var(--text, #e5e7eb)',
      fontSize: 14,
      width: '100%',
      transition: 'border-color 0.2s',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      appearance: 'none',
      colorScheme: 'dark',
      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2310b981\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 8px center',
      backgroundSize: '20px',
      paddingRight: '36px'
    },
    statsBar: {
      maxWidth: 1400,
      margin: '0 auto 20px',
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    statChip: {
      padding: '8px 16px',
      background: 'var(--surface, #111827)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 20,
      fontSize: 13,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    },
    mainGrid: {
      maxWidth: 1400,
      margin: '0 auto',
      display: 'grid',
      gap: 20,
      gridTemplateColumns: isMobile ? '1fr' : selectedSlot ? '1fr 340px' : '1fr'
    },
    calendarCard: {
      background: 'var(--surface, #111827)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: isMobile ? 12 : 16,
      overflow: 'hidden'
    },
    weekNav: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
      flexWrap: 'wrap'
    },
    navBtn: {
      padding: isMobile ? '6px 10px' : '8px 12px',
      background: 'var(--bg, #0a0a0a)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 6,
      color: 'var(--text, #e5e7eb)',
      cursor: 'pointer',
      fontSize: isMobile ? 12 : 14,
      fontWeight: 600,
      transition: 'all 0.2s'
    },
    weekTitle: {
      fontSize: isMobile ? 14 : 16,
      fontWeight: 700,
      color: 'var(--text, #e5e7eb)',
      textAlign: 'center'
    },
    detailCard: {
      background: 'var(--surface, #111827)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: 16,
      position: isMobile ? 'fixed' : 'sticky',
      top: isMobile ? 0 : 20,
      left: isMobile ? 0 : 'auto',
      right: isMobile ? 0 : 'auto',
      bottom: isMobile ? 0 : 'auto',
      zIndex: isMobile ? 1000 : 1,
      maxHeight: isMobile ? '100vh' : 'calc(100vh - 40px)',
      overflowY: 'auto'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn} onMouseEnter={e => e.target.style.background = 'var(--primary-600, #145a4b)'} onMouseLeave={e => e.target.style.background = 'var(--surface, #111827)'}>
          ← Zurück
        </button>
        <h1 style={styles.title}>Platz buchen</h1>
      </div>

      {/* Filter */}
      <div style={styles.filterCard}>
        <div style={styles.filterGrid}>
          <div>
            <label style={styles.label}>Sportart</label>
            <select value={filters.sport} onChange={(e) => handleFilterChange('sport', e.target.value)} style={styles.input}>
              <option value="">Alle Sportarten</option>
              {sports.map(sport => <option key={sport.id} value={sport.id}>{sport.name_de || sport.name}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>Stadt</label>
            <select value={filters.city} onChange={(e) => handleFilterChange('city', e.target.value)} style={styles.input}>
              <option value="">Alle Städte</option>
              {cities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>Datum</label>
            <input type="date" value={filters.date} onChange={(e) => handleFilterChange('date', e.target.value)} min={new Date().toISOString().split('T')[0]} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>Dauer</label>
            <select value={filters.duration} onChange={(e) => handleFilterChange('duration', parseInt(e.target.value))} style={styles.input}>
              <option value={60}>1 Stunde</option>
              <option value={90}>1.5 Stunden</option>
              <option value={120}>2 Stunden</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.statChip}>
          <span style={{ fontSize: 18 }}>✓</span>
          <span style={{ color: 'var(--primary, #10b981)' }}>{totalAvailableSlots} verfügbar</span>
        </div>
        {!isMobile && (
          <>
            <div style={{ ...styles.statChip, cursor: 'pointer', background: viewMode === 'week' ? 'var(--primary-600, #145a4b)' : 'var(--surface, #111827)' }} onClick={() => setViewMode('week')}>
              Wochenansicht
            </div>
            <div style={{ ...styles.statChip, cursor: 'pointer', background: viewMode === 'list' ? 'var(--primary-600, #145a4b)' : 'var(--surface, #111827)' }} onClick={() => setViewMode('list')}>
              Listenansicht
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ maxWidth: 1400, margin: '0 auto 16px', padding: 12, background: '#dc2626', borderRadius: 8, color: 'white', fontSize: 14 }}>
          ⚠ {error}
        </div>
      )}

      <div style={styles.mainGrid}>
        {/* Calendar View */}
        <div style={styles.calendarCard}>
          <div style={styles.weekNav}>
            <button onClick={() => navigateWeek(-1)} style={styles.navBtn} onMouseEnter={e => e.target.style.background = 'var(--primary-600, #145a4b)'} onMouseLeave={e => e.target.style.background = 'var(--bg, #0a0a0a)'}>
              ← {isMobile ? 'Zurück' : 'Vorherige Woche'}
            </button>
            <div style={styles.weekTitle}>
              {weekDates[0].toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} - {weekDates[6].toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <button onClick={() => navigateWeek(1)} style={styles.navBtn} onMouseEnter={e => e.target.style.background = 'var(--primary-600, #145a4b)'} onMouseLeave={e => e.target.style.background = 'var(--bg, #0a0a0a)'}>
              {isMobile ? 'Weiter' : 'Nächste Woche'} →
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted, #9ca3af)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Lade Kalender...</p>
            </div>
          ) : viewMode === 'week' || isMobile ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 8px', background: 'var(--bg, #0a0a0a)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 600, color: 'var(--primary, #10b981)', textAlign: 'left', minWidth: 60, position: 'sticky', left: 0, zIndex: 2 }}>Zeit</th>
                    {weekDates.map((date, i) => (
                      <th key={i} style={{ padding: '10px 8px', background: 'var(--bg, #0a0a0a)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 600, color: 'var(--primary, #10b981)', textAlign: 'center', minWidth: 80 }}>
                        <div>{['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][i]}</div>
                        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted, #9ca3af)', marginTop: 2 }}>
                          {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map(hour => (
                    <tr key={hour}>
                      <td style={{ padding: '12px 8px', background: 'var(--bg, #0a0a0a)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 600, color: 'var(--text, #e5e7eb)', position: 'sticky', left: 0, zIndex: 1 }}>
                        {`${hour.toString().padStart(2, '0')}:00`}
                      </td>
                      {weekDates.map((date, dayIdx) => {
                        const slots = getSlotsForDayAndHour(date, hour);
                        const availableSlots = slots.filter(s => !s.booking_id);
                        const hasSlots = availableSlots.length > 0;
                        const isBooked = slots.length > 0 && availableSlots.length === 0;
                        
                        return (
                          <td 
                            key={dayIdx}
                            onClick={() => hasSlots && setSelectedSlot(availableSlots[0])}
                            style={{ 
                              padding: 12, 
                              background: hasSlots ? 'rgba(16, 185, 129, 0.1)' : isBooked ? 'rgba(156, 163, 175, 0.05)' : 'var(--bg, #0a0a0a)',
                              border: '1px solid rgba(255,255,255,0.06)', 
                              textAlign: 'center',
                              cursor: hasSlots ? 'pointer' : 'default',
                              position: 'relative',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => hasSlots && (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)')}
                            onMouseLeave={e => hasSlots && (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
                          >
                            {hasSlots && (
                              <div style={{ 
                                width: 10, 
                                height: 10, 
                                borderRadius: '50%', 
                                background: 'var(--primary, #10b981)',
                                margin: '0 auto',
                                boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
                              }} />
                            )}
                            {hasSlots && availableSlots.length > 1 && (
                              <div style={{ fontSize: 9, color: 'var(--primary, #10b981)', marginTop: 4, fontWeight: 700 }}>
                                +{availableSlots.length - 1}
                              </div>
                            )}
                            {isBooked && (
                              <div style={{ fontSize: 16, opacity: 0.3 }}>×</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // Listenansicht
            <div style={{ display: 'grid', gap: 12 }}>
              {Object.keys(availableSlotsByDate).length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted, #9ca3af)' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>—</div>
                  <p style={{ fontSize: 16, fontWeight: 600 }}>Keine verfügbaren Slots</p>
                  <p style={{ fontSize: 14 }}>Versuche andere Filter oder eine andere Woche</p>
                </div>
              ) : (
                Object.entries(availableSlotsByDate).map(([date, slots]) => (
                  <div key={date} style={{ background: 'var(--bg, #0a0a0a)', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary, #10b981)', marginBottom: 12 }}>
                      {new Date(date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {slots.map(slot => (
                        <div 
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          style={{
                            padding: 12,
                            background: 'var(--surface, #111827)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            border: '1px solid rgba(255,255,255,0.06)',
                            transition: 'all 0.2s',
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto',
                            gap: 12,
                            alignItems: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary, #10b981)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                        >
                          <div style={{ fontSize: 24 }}>■</div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text, #e5e7eb)', marginBottom: 4 }}>
                              {slot.asset_name}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted, #9ca3af)' }}>
                              {new Date(slot.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.end_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary, #10b981)' }}>
                            €{parseFloat(slot.base_price || 0).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedSlot && (
          <div style={styles.detailCard}>
            {isMobile && (
              <button 
                onClick={() => setSelectedSlot(null)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 20,
                  color: 'white'
                }}
              >
                ×
              </button>
            )}
            
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text, #e5e7eb)', marginBottom: 12 }}>Slot Details</h3>
              
              <div style={{ width: '100%', height: 160, background: 'var(--bg, #0a0a0a)', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <span style={{ fontSize: 64 }}>▣</span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text, #e5e7eb)', marginBottom: 8 }}>
                  {selectedSlot.asset_name}
                </div>
                <div style={{ fontSize: 14, color: 'var(--muted, #9ca3af)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>●</span>
                  <span>{selectedSlot.location_name}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--muted, #9ca3af)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>○</span>
                  <span>{selectedSlot.city}</span>
                </div>
                {selectedSlot.sport_name && (
                  <div style={{ display: 'inline-block', padding: '6px 12px', background: 'var(--primary, #10b981)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'white', marginBottom: 12 }}>
                    {selectedSlot.sport_name}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--bg, #0a0a0a)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted, #9ca3af)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>◷</span>
                      <span>Zeit</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text, #e5e7eb)' }}>
                      {new Date(selectedSlot.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedSlot.end_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted, #9ca3af)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>▦</span>
                      <span>Datum</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text, #e5e7eb)' }}>
                      {new Date(selectedSlot.start_time).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted, #9ca3af)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⧗</span>
                      <span>Dauer</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text, #e5e7eb)' }}>
                      {selectedSlot.duration_minutes} Minuten
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid var(--primary, #10b981)' }}>
                <div style={{ fontSize: 12, color: 'var(--muted, #9ca3af)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>€</span>
                  <span>Preis</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary, #10b981)' }}>
                  €{parseFloat(selectedSlot.base_price || 0).toFixed(2)}
                </div>
              </div>

              <button 
                onClick={handleBookSlot}
                disabled={!token}
                style={{ 
                  width: '100%', 
                  padding: '14px 20px', 
                  background: token ? 'var(--primary, #10b981)' : '#666', 
                  border: 'none', 
                  borderRadius: 10, 
                  color: 'white', 
                  fontSize: 16, 
                  fontWeight: 700, 
                  cursor: token ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  boxShadow: token ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                }}
                onMouseEnter={e => token && (e.target.style.background = 'var(--primary-600-hover, #0f4a40)')}
                onMouseLeave={e => token && (e.target.style.background = 'var(--primary, #10b981)')}
              >
                {token ? 'Jetzt buchen' : 'Anmelden zum Buchen'}
              </button>

              {!token && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted, #9ca3af)', textAlign: 'center', padding: '8px 12px', background: 'rgba(255, 193, 7, 0.1)', borderRadius: 6, border: '1px solid rgba(255, 193, 7, 0.3)' }}>
                  ⓘ Du musst angemeldet sein, um zu buchen
                </div>
              )}
            </div>
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
