import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import { useLanguage } from '../i18n';

export default function CreateMatchModal({ sports, cities, onClose, onSuccess }) {
  const { t } = useLanguage();
  const [sportId, setSportId] = useState('');
  const [cityId, setCityId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  // Load available locations when all params are set
  useEffect(() => {
    if (!sportId || !cityId || !date || !time) {
      setAvailableLocations([]);
      return;
    }

    const datetime = `${date}T${time}:00`;
    setLoading(true);
    setError('');

    const params = new URLSearchParams({
      sport_id: sportId,
      city_id: cityId,
      datetime: datetime,
      duration: duration
    });

    fetch(`${API_BASE}/locations/availability?${params.toString()}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load availability');
        return r.json();
      })
      .then(data => {
        setAvailableLocations(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Availability error:', err);
        setError(err.message);
        setAvailableLocations([]);
        setLoading(false);
      });
  }, [sportId, cityId, date, time, duration]);

  const handleBookLocation = async (locationId, assetId) => {
    setCreating(true);
    setError('');

    try {
      const datetime = `${date}T${time}:00`;
      const response = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          location_id: locationId,
          asset_id: assetId,
          sport_id: sportId,
          start_datetime: datetime,
          duration: duration
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Booking failed');
      }

      const booking = await response.json();
      onSuccess(booking);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  };

  const inputStyle = {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #2f6b57',
    background: '#0e2a22',
    color: '#e8efe8',
    fontSize: 14,
    width: '100%'
  };

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.6)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 1000, 
        overflowY: 'auto', 
        padding: '20px' 
      }} 
      onClick={onClose}
    >
      <div 
        className="ml-card" 
        style={{ 
          width: '100%', 
          maxWidth: 560, 
          maxHeight: '90vh', 
          overflowY: 'auto', 
          margin: 'auto' 
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
          <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: 22 }}>
            {t('match.createPublic.title')}
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#e8efe8',
              fontSize: 28,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
              marginTop: -4
            }}
          >×</button>
        </div>
        <p style={{ margin: '0 0 16px 0', color: '#9db', fontSize: 14, lineHeight: 1.5 }}>
          {t('match.createPublic.subtitleLong')}
        </p>

        {error && (
          <div style={{ 
            padding: 12, 
            background: '#4a1a1a', 
            border: '1px solid #8a2a2a', 
            borderRadius: 8, 
            marginBottom: 16, 
            color: '#ffa5a5' 
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 16 }}>
          {/* Sport */}
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Sportart *</span>
            <select value={sportId} onChange={(e) => setSportId(e.target.value)} style={inputStyle}>
              <option value="">Bitte wählen</option>
              {sports.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          {/* City */}
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Stadt *</span>
            <select value={cityId} onChange={(e) => setCityId(e.target.value)} style={inputStyle}>
              <option value="">Stadt wählen</option>
              {cities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {/* Date Options */}
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Wann möchtest du spielen?</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {(() => {
                const today = new Date();
                const options = [
                  { label: 'Heute', days: 0, end: 0 },
                  { label: 'Morgen', days: 1, end: 1 },
                  { label: 'Diese Woche', days: 0, end: 6 },
                  { label: 'Nächste Woche', days: 7, end: 13 },
                  { label: 'Nächste 2 Wochen', days: 0, end: 13 },
                  { label: 'Dieses Wochenende', days: null, weekend: 'this' },
                ];
                return options.map((opt, idx) => {
                  let dateStr = '';
                  let isSelected = false;
                  
                  if (opt.days !== null) {
                    const d = new Date(today);
                    d.setDate(d.getDate() + opt.days);
                    dateStr = d.toISOString().split('T')[0];
                  }
                  
                  // Determine if this option is selected
                  const selectedDate = date || '';
                  if (opt.days !== null && selectedDate) {
                    const selDate = new Date(selectedDate);
                    const optDate = new Date(today);
                    optDate.setDate(optDate.getDate() + opt.days);
                    isSelected = selDate.toDateString() === optDate.toDateString();
                  }
                  
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (opt.weekend) {
                          // Set to next Saturday
                          const d = new Date(today);
                          const dayOfWeek = d.getDay();
                          const daysToSaturday = dayOfWeek === 0 ? 6 : (6 - dayOfWeek);
                          d.setDate(d.getDate() + daysToSaturday);
                          setDate(d.toISOString().split('T')[0]);
                        } else {
                          const d = new Date(today);
                          d.setDate(d.getDate() + opt.days);
                          setDate(d.toISOString().split('T')[0]);
                        }
                      }}
                      style={{
                        padding: '16px 14px',
                        borderRadius: 10,
                        border: isSelected ? '2px solid #debc7c' : '1px solid #2f6b57',
                        background: isSelected ? '#1a3c33' : '#0e2a22',
                        color: '#e8efe8',
                        fontSize: 15,
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{opt.label}</span>
                      <span style={{ 
                        background: isSelected ? '#debc7c' : '#2f6b57', 
                        color: isSelected ? '#10261f' : '#e8efe8',
                        padding: '4px 10px', 
                        borderRadius: 6, 
                        fontSize: 13,
                        fontWeight: 700
                      }}>
                        {opt.end !== undefined ? `${opt.end - opt.days + 1} ${opt.end - opt.days === 0 ? 'Tag' : 'Tage'}` : '2 Tage'}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
          </label>

          {/* Time & Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Uhrzeit *</span>
              <input 
                type="time" 
                value={time} 
                onChange={(e) => setTime(e.target.value)} 
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Dauer (min)</span>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} style={inputStyle}>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select>
            </label>
          </div>

          {/* Available Locations */}
          {sportId && cityId && date && time && (
            <div style={{ marginTop: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#debc7c' }}>
                Verfügbare Locations
              </h3>

              {loading && (
                <div style={{ padding: 16, textAlign: 'center', color: '#9db', fontSize: 14 }}>
                  Suche verfügbare Plätze...
                </div>
              )}

              {!loading && availableLocations.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: '#9db', fontSize: 14 }}>
                  Keine freien Plätze für diese Auswahl
                </div>
              )}

              {!loading && availableLocations.length > 0 && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {availableLocations.map(loc => {
                    const photos = loc.photos ? (typeof loc.photos === 'string' ? JSON.parse(loc.photos) : loc.photos) : [];
                    const firstPhoto = photos.length > 0 ? photos[0] : null;
                    const priceText = loc.hourly_rate ? `${loc.hourly_rate}€/h` : 'Preis auf Anfrage';

                    return (
                      <div 
                        key={loc.id}
                        style={{
                          padding: 14,
                          border: '2px solid #2f6b57',
                          borderRadius: 12,
                          background: '#0b1e19',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'center',
                          transition: 'border-color 0.2s'
                        }}
                      >
                        {firstPhoto && (
                          <img 
                            src={firstPhoto} 
                            alt={loc.name}
                            style={{
                              width: 60,
                              height: 60,
                              borderRadius: 10,
                              objectFit: 'cover',
                              border: '1px solid #2f6b57'
                            }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: '#e8efe8', marginBottom: 4 }}>
                            {loc.name}
                          </div>
                          {loc.address && (
                            <div style={{ fontSize: 12, color: '#9db', marginBottom: 6 }}>
                              {loc.address}
                            </div>
                          )}
                          <div style={{ fontSize: 13, color: '#debc7c', fontWeight: 600 }}>
                            {loc.available_slots} {loc.available_slots === 1 ? 'freier Platz' : 'freie Plätze'} • {priceText}
                          </div>
                        </div>
                        <button
                          onClick={() => handleBookLocation(loc.id, null)}
                          disabled={creating}
                          style={{
                            background: '#debc7c',
                            color: '#0e2a22',
                            border: 'none',
                            padding: '10px 18px',
                            borderRadius: 8,
                            fontWeight: 700,
                            cursor: creating ? 'not-allowed' : 'pointer',
                            fontSize: 13,
                            opacity: creating ? 0.6 : 1,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {creating ? 'Buche...' : 'Platz buchen'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #1a3c33' }}>
            <button
              onClick={onClose}
              style={{
                background: '#0e2a22',
                color: '#e8efe8',
                border: '1px solid #2f6b57',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
