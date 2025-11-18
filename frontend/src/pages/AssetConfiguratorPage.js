import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

export default function AssetConfiguratorPage() {
  const { locationId, assetId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [location, setLocation] = useState(null);
  const [asset, setAsset] = useState(null);
  const [slots, setSlots] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'court',
    surface: '',
    capacity: '',
    min_booking_duration: 60,
    max_booking_duration: 180,
    slot_interval: 30,
    advance_booking_days: 30,
    cancellation_hours: 24
  });

  useEffect(() => {
    loadData();
  }, [locationId, assetId]);

  async function loadData() {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Load location
      const locationRes = await fetch(`${API_BASE}/locations/${locationId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const locationData = await locationRes.json();
      setLocation(locationData);
      
      // Load asset
      const assetRes = await fetch(`${API_BASE}/assets/${assetId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const assetData = await assetRes.json();
      setAsset(assetData);
      setFormData({
        name: assetData.name || '',
        description: assetData.description || '',
        type: assetData.type || 'court',
        surface: assetData.surface || '',
        capacity: assetData.capacity || '',
        min_booking_duration: assetData.min_booking_duration || 60,
        max_booking_duration: assetData.max_booking_duration || 180,
        slot_interval: assetData.slot_interval || 30,
        advance_booking_days: assetData.advance_booking_days || 30,
        cancellation_hours: assetData.cancellation_hours || 24
      });
      
      // Load slots for current week
      await loadWeekSlots();
      
    } catch (err) {
      console.error('Load error:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  }

  async function loadWeekSlots() {
    try {
      const token = localStorage.getItem('token');
      const startOfWeek = getStartOfWeek(currentWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      
      const response = await fetch(
        `${API_BASE}/assets/${assetId}/slots?start=${startOfWeek.toISOString()}&end=${endOfWeek.toISOString()}`,
        {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }
      );
      const slotsData = await response.json();
      setSlots(slotsData);
    } catch (err) {
      console.error('Load slots error:', err);
    }
  }

  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    return new Date(d.setDate(diff));
  }

  function handleInputChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/assets/${assetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Speichern fehlgeschlagen');
      }

      alert('✅ Asset erfolgreich gespeichert!');
      
    } catch (err) {
      console.error('Save error:', err);
      alert('❌ Fehler beim Speichern: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function navigateWeek(direction) {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction * 7));
    setCurrentWeek(newWeek);
  }

  useEffect(() => {
    if (asset) {
      loadWeekSlots();
    }
  }, [currentWeek, asset]);

  function renderWeekCalendar() {
    const startOfWeek = getStartOfWeek(currentWeek);
    const days = [];
    const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00-21:00

    // Generate 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      days.push(date);
    }

    return (
      <div style={styles.calendar}>
        {/* Week Navigation */}
        <div style={styles.weekNav}>
          <button onClick={() => navigateWeek(-1)} style={styles.weekNavBtn}>
            ← Vorherige Woche
          </button>
          <div style={styles.weekTitle}>
            {startOfWeek.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - {' '}
            {new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
          <button onClick={() => navigateWeek(1)} style={styles.weekNavBtn}>
            Nächste Woche →
          </button>
        </div>

        {/* Calendar Grid */}
        <div style={styles.calendarGrid}>
          {/* Header with days */}
          <div style={styles.timeColumn}></div>
          {days.map((day, dayIndex) => (
            <div key={dayIndex} style={styles.dayHeader}>
              <div style={styles.dayName}>
                {day.toLocaleDateString('de-DE', { weekday: 'short' })}
              </div>
              <div style={styles.dayDate}>
                {day.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
              </div>
            </div>
          ))}

          {/* Time slots */}
          {hours.map(hour => (
            <React.Fragment key={hour}>
              <div style={styles.timeSlot}>
                {hour}:00
              </div>
              {days.map((day, dayIndex) => {
                const slotDateTime = new Date(day);
                slotDateTime.setHours(hour, 0, 0, 0);
                
                const slot = slots.find(s => {
                  const slotTime = new Date(s.start_time);
                  return slotTime.getTime() === slotDateTime.getTime();
                });

                return (
                  <div 
                    key={`${dayIndex}-${hour}`} 
                    style={{
                      ...styles.calendarSlot,
                      ...(slot ? {
                        backgroundColor: slot.status === 'booked' ? '#ef4444' : 
                                       slot.status === 'available' ? '#10b981' : '#6b7280',
                        color: '#fff'
                      } : {})
                    }}
                    title={slot ? `${slot.status} - ${slot.base_price}€` : 'Kein Slot'}
                  >
                    {slot && (
                      <div style={styles.slotInfo}>
                        <div>{slot.base_price}€</div>
                        <div style={{ fontSize: '10px', opacity: 0.8 }}>
                          {slot.status === 'booked' ? '🚫' : slot.status === 'available' ? '✓' : '—'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={styles.container}>Loading...</div>;
  }

  if (error) {
    return <div style={styles.container}>Error: {error}</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/location-manager')} style={styles.backBtn}>
          ← Zurück zum Location Manager
        </button>
        <h1 style={styles.title}>
          Asset Konfigurator: {asset?.name}
        </h1>
        <div style={styles.locationInfo}>
          📍 {location?.name}, {location?.city}
        </div>
      </div>

      <div style={styles.content}>
        {/* Left: Form */}
        <div style={styles.formPanel}>
          <h2 style={styles.panelTitle}>Asset Einstellungen</h2>
          
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Beschreibung</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                style={styles.textarea}
                rows={3}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Typ</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                style={styles.select}
              >
                <option value="court">Court</option>
                <option value="field">Field</option>
                <option value="hall">Hall</option>
                <option value="table">Table</option>
                <option value="room">Room</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Oberfläche</label>
              <input
                type="text"
                name="surface"
                value={formData.surface}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="z.B. Hardcourt, Rasen, Sand"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Kapazität</label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="Anzahl Personen"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Min. Buchungsdauer (Min)</label>
              <input
                type="number"
                name="min_booking_duration"
                value={formData.min_booking_duration}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Max. Buchungsdauer (Min)</label>
              <input
                type="number"
                name="max_booking_duration"
                value={formData.max_booking_duration}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Slot-Intervall (Min)</label>
              <input
                type="number"
                name="slot_interval"
                value={formData.slot_interval}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Vorlaufzeit (Tage)</label>
              <input
                type="number"
                name="advance_booking_days"
                value={formData.advance_booking_days}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Stornierungsfrist (Stunden)</label>
              <input
                type="number"
                name="cancellation_hours"
                value={formData.cancellation_hours}
                onChange={handleInputChange}
                style={styles.input}
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? 'Speichere...' : '💾 Speichern'}
          </button>
        </div>

        {/* Right: Calendar */}
        <div style={styles.calendarPanel}>
          <h2 style={styles.panelTitle}>Wochenansicht</h2>
          {renderWeekCalendar()}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    marginBottom: '30px'
  },
  backBtn: {
    background: '#6b7280',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '16px'
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '0 0 8px 0',
    color: '#1f2937'
  },
  locationInfo: {
    color: '#6b7280',
    fontSize: '16px'
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '400px 1fr',
    gap: '30px',
    alignItems: 'start'
  },
  formPanel: {
    background: '#f9fafb',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb'
  },
  calendarPanel: {
    background: '#ffffff',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  panelTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 20px 0',
    color: '#374151'
  },
  formGrid: {
    display: 'grid',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '4px',
    color: '#374151'
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  textarea: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    resize: 'vertical'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  checkbox: {
    marginRight: '8px'
  },
  saveBtn: {
    background: '#10b981',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '24px',
    width: '100%'
  },
  calendar: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  weekNav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb'
  },
  weekNavBtn: {
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  weekTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151'
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: '60px repeat(7, 1fr)'
  },
  timeColumn: {
    background: '#f9fafb',
    borderRight: '1px solid #e5e7eb'
  },
  dayHeader: {
    padding: '12px 8px',
    textAlign: 'center',
    background: '#f3f4f6',
    borderRight: '1px solid #e5e7eb',
    borderBottom: '1px solid #e5e7eb'
  },
  dayName: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase'
  },
  dayDate: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginTop: '2px'
  },
  timeSlot: {
    padding: '12px 8px',
    fontSize: '12px',
    color: '#6b7280',
    background: '#f9fafb',
    borderRight: '1px solid #e5e7eb',
    borderBottom: '1px solid #e5e7eb',
    textAlign: 'center'
  },
  calendarSlot: {
    minHeight: '48px',
    borderRight: '1px solid #e5e7eb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    background: '#f9fafb'
  },
  slotInfo: {
    textAlign: 'center',
    lineHeight: 1.2
  }
};