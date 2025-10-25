import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

/**
 * SlotPickerPopup - Find and book next available slot for a match
 * 
 * Features:
 * - Date & time picker with counter
 * - Duration filter (30, 60, 90, 120 minutes)
 * - List of next available slots
 * - Real-time updates when filters change
 */
export default function SlotPickerPopup({ onClose, onSelect, sportId, cityId }) {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [selectedTime, setSelectedTime] = useState(getCurrentTime());
  const [duration, setDuration] = useState(60);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    searchAvailableSlots();
  }, [selectedDate, selectedTime, duration, sportId, cityId]);

  function getTodayDate() {
    return new Date().toISOString().split('T')[0];
  }

  function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = Math.ceil(now.getMinutes() / 15) * 15; // Round to next 15 min
    return `${hours}:${minutes === 60 ? '00' : minutes.toString().padStart(2, '0')}`;
  }

  async function searchAvailableSlots() {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        date: selectedDate,
        time: selectedTime,
        duration: duration,
        limit: 10
      });
      
      if (sportId) params.append('sport_id', sportId);
      if (cityId) params.append('city_id', cityId);
      
      const res = await fetch(`${API_BASE}/slots/search-available?${params}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      setAvailableSlots(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Fehler beim Laden der Slots');
    } finally {
      setLoading(false);
    }
  }

  function adjustDate(days) {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  }

  function adjustTime(minutes) {
    const [hours, mins] = selectedTime.split(':').map(Number);
    let totalMinutes = hours * 60 + mins + minutes;
    
    // Wrap around 24h
    if (totalMinutes < 0) totalMinutes = 0;
    if (totalMinutes >= 24 * 60) totalMinutes = 23 * 60 + 45;
    
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    setSelectedTime(`${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`);
  }

  const durations = [30, 60, 90, 120];
  
  // Find next available slot
  const nextSlot = availableSlots.length > 0 ? availableSlots[0] : null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Platz buchen</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.content}>
          {/* Date & Time Picker */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Wunschtermin</h3>
            
            {/* Date Counter */}
            <div style={styles.counterRow}>
              <label style={styles.counterLabel}>Datum</label>
              <div style={styles.counter}>
                <button
                  onClick={() => adjustDate(-1)}
                  style={styles.counterBtn}
                  disabled={selectedDate === getTodayDate()}
                >
                  −
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={styles.counterInput}
                  min={getTodayDate()}
                />
                <button
                  onClick={() => adjustDate(1)}
                  style={styles.counterBtn}
                >
                  +
                </button>
              </div>
              <div style={styles.counterDisplay}>
                {new Date(selectedDate).toLocaleDateString('de-DE', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short'
                })}
              </div>
            </div>

            {/* Time Counter */}
            <div style={styles.counterRow}>
              <label style={styles.counterLabel}>Uhrzeit</label>
              <div style={styles.counter}>
                <button
                  onClick={() => adjustTime(-15)}
                  style={styles.counterBtn}
                >
                  −
                </button>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  style={styles.counterInput}
                  step="900"
                />
                <button
                  onClick={() => adjustTime(15)}
                  style={styles.counterBtn}
                >
                  +
                </button>
              </div>
              <div style={styles.counterDisplay}>
                {selectedTime}
              </div>
            </div>
          </div>

          {/* Duration Filter */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Spielzeit</h3>
            <div style={styles.durationButtons}>
              {durations.map(dur => (
                <button
                  key={dur}
                  onClick={() => setDuration(dur)}
                  style={{
                    ...styles.durationBtn,
                    ...(duration === dur ? styles.durationBtnActive : {})
                  }}
                >
                  {dur} min
                </button>
              ))}
            </div>
          </div>

          {/* Next Available Slot Highlight */}
          {nextSlot && (
            <div style={styles.nextSlotCard}>
              <div style={styles.nextSlotBadge}>Nächster freier Platz</div>
              <div style={styles.nextSlotDetails}>
                <div style={styles.nextSlotLocation}>{nextSlot.location_name}</div>
                <div style={styles.nextSlotAsset}>{nextSlot.asset_name}</div>
                <div style={styles.nextSlotTime}>
                  {new Date(nextSlot.start_time).toLocaleString('de-DE', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {' - '}
                  {new Date(nextSlot.end_time).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div style={styles.nextSlotPrice}>
                  {nextSlot.base_price} {nextSlot.currency || 'EUR'}
                </div>
              </div>
              <button
                onClick={() => onSelect(nextSlot)}
                style={styles.selectBtn}
              >
                Auswählen
              </button>
            </div>
          )}

          {/* Available Slots List */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              Verfügbare Plätze
              {availableSlots.length > 0 && (
                <span style={styles.slotCount}> ({availableSlots.length})</span>
              )}
            </h3>

            {loading && (
              <div style={styles.loading}>Suche verfügbare Plätze...</div>
            )}

            {error && (
              <div style={styles.error}>{error}</div>
            )}

            {!loading && availableSlots.length === 0 && (
              <div style={styles.emptyState}>
                <p style={{color: '#9ca3af'}}>
                  Keine verfügbaren Plätze für die gewählten Kriterien gefunden.
                </p>
                <p style={{color: '#9ca3af', fontSize: 13, marginTop: 8}}>
                  Versuche ein anderes Datum oder eine andere Uhrzeit.
                </p>
              </div>
            )}

            {!loading && availableSlots.length > 0 && (
              <div style={styles.slotsList}>
                {availableSlots.map((slot, index) => {
                  if (index === 0) return null; // Skip first (already shown above)
                  
                  return (
                    <div key={slot.id} style={styles.slotItem}>
                      <div style={styles.slotItemHeader}>
                        <div style={styles.slotItemLocation}>
                          {slot.location_name}
                        </div>
                        <div style={styles.slotItemPrice}>
                          {slot.base_price} {slot.currency || 'EUR'}
                        </div>
                      </div>
                      
                      <div style={styles.slotItemAsset}>
                        {slot.asset_name}
                      </div>
                      
                      <div style={styles.slotItemTime}>
                        🕐 {new Date(slot.start_time).toLocaleString('de-DE', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {' - '}
                        {new Date(slot.end_time).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      
                      <button
                        onClick={() => onSelect(slot)}
                        style={styles.slotSelectBtn}
                      >
                        Auswählen
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20
  },
  popup: {
    background: '#111827',
    borderRadius: 16,
    border: '1px solid #374151',
    maxWidth: 600,
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottom: '1px solid #374151'
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  closeBtn: {
    padding: 8,
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: 24,
    cursor: 'pointer',
    lineHeight: 1
  },
  content: {
    padding: 24,
    overflowY: 'auto',
    flex: 1
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: 16,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  slotCount: {
    color: '#9ca3af',
    fontWeight: 400
  },
  counterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12
  },
  counterLabel: {
    fontSize: 14,
    color: '#9ca3af',
    minWidth: 80
  },
  counter: {
    display: 'flex',
    gap: 8,
    alignItems: 'center'
  },
  counterBtn: {
    width: 36,
    height: 36,
    border: '1px solid #374151',
    borderRadius: 6,
    background: '#1f2937',
    color: '#e5e7eb',
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  counterInput: {
    padding: '8px 12px',
    border: '1px solid #374151',
    borderRadius: 6,
    background: '#1f2937',
    color: '#e5e7eb',
    fontSize: 14,
    minWidth: 140
  },
  counterDisplay: {
    fontSize: 14,
    color: '#e5e7eb',
    fontWeight: 500,
    minWidth: 100
  },
  durationButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8
  },
  durationBtn: {
    padding: '10px 16px',
    border: '1px solid #374151',
    borderRadius: 8,
    background: '#1f2937',
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  durationBtnActive: {
    background: '#0a2221',
    color: '#fff',
    borderColor: '#0a2221'
  },
  nextSlotCard: {
    background: 'linear-gradient(135deg, #064e3b 0%, #0a2221 100%)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    border: '1px solid #10b981'
  },
  nextSlotBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    background: '#10b981',
    color: '#fff',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 12
  },
  nextSlotDetails: {
    marginBottom: 16
  },
  nextSlotLocation: {
    fontSize: 18,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 4
  },
  nextSlotAsset: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8
  },
  nextSlotTime: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 500,
    marginBottom: 8
  },
  nextSlotPrice: {
    fontSize: 20,
    fontWeight: 600,
    color: '#10b981'
  },
  selectBtn: {
    width: '100%',
    padding: '12px 24px',
    border: 'none',
    borderRadius: 8,
    background: '#fff',
    color: '#064e3b',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  slotsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  slotItem: {
    background: '#1f2937',
    borderRadius: 10,
    padding: 16,
    border: '1px solid #374151',
    transition: 'all 0.2s'
  },
  slotItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  slotItemLocation: {
    fontSize: 16,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  slotItemPrice: {
    fontSize: 16,
    fontWeight: 600,
    color: '#10b981'
  },
  slotItemAsset: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 6
  },
  slotItemTime: {
    fontSize: 14,
    color: '#d1d5db',
    marginBottom: 12
  },
  slotSelectBtn: {
    width: '100%',
    padding: '8px 16px',
    border: '1px solid #0a2221',
    borderRadius: 6,
    background: 'transparent',
    color: '#10b981',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  loading: {
    textAlign: 'center',
    padding: 40,
    color: '#9ca3af',
    fontSize: 14
  },
  error: {
    padding: 16,
    background: '#7f1d1d',
    color: '#fecaca',
    borderRadius: 8,
    fontSize: 14
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    background: '#1f2937',
    borderRadius: 8
  }
};
