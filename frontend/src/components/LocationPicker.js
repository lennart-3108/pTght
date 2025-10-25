import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

/**
 * LocationPicker Component
 * 
 * Allows users to browse and select sports locations/venues
 * Features:
 * - Filter by city, sport, and location name
 * - Display location cards with key info
 * - Map view integration ready
 * - Rating and review display
 */
export default function LocationPicker({ onSelectLocation, selectedLocationId, sportFilter }) {
  const [locations, setLocations] = useState([]);
  const [cities, setCities] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedSport, setSelectedSport] = useState(sportFilter || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (sportFilter) {
      setSelectedSport(sportFilter);
    }
  }, [sportFilter]);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      
      const [locationsRes, citiesRes, sportsRes] = await Promise.all([
        fetch(`${API_BASE}/locations`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/cities/list`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/sports/list`).then(r => r.ok ? r.json() : [])
      ]);
      
      setLocations(Array.isArray(locationsRes) ? locationsRes : []);
      setCities(Array.isArray(citiesRes) ? citiesRes : []);
      setSports(Array.isArray(sportsRes) ? sportsRes : []);
    } catch (err) {
      setError(err.message || 'Fehler beim Laden der Locations');
    } finally {
      setLoading(false);
    }
  }

  // Filter locations based on selected criteria
  const filteredLocations = locations.filter(loc => {
    if (selectedCity && loc.city !== selectedCity) return false;
    if (searchTerm && !loc.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    
    // Sport filter: check if location has assets that support this sport
    if (selectedSport) {
      // This would need assets data - for now, simplified
      // In real implementation, you'd filter by loc.assets[].supported_sports
      return true;
    }
    
    // Only show active locations
    if (loc.status !== 'active') return false;
    
    return true;
  });

  if (loading) return <div style={styles.container}>Lade Locations...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Platz wählen</h2>
        
        {/* View Mode Toggle */}
        <div style={styles.viewToggle}>
          <button
            onClick={() => setViewMode('list')}
            style={{...styles.toggleBtn, ...(viewMode === 'list' ? styles.toggleBtnActive : {})}}
          >
            📋 Liste
          </button>
          <button
            onClick={() => setViewMode('map')}
            style={{...styles.toggleBtn, ...(viewMode === 'map' ? styles.toggleBtnActive : {})}}
          >
            🗺️ Karte
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          type="text"
          placeholder="🔍 Suche nach Location-Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          style={styles.select}
        >
          <option value="">📍 Alle Städte</option>
          {cities.map(city => (
            <option key={city.id} value={city.name}>{city.name}</option>
          ))}
        </select>
        
        <select
          value={selectedSport}
          onChange={(e) => setSelectedSport(e.target.value)}
          style={styles.select}
        >
          <option value="">⚽ Alle Sportarten</option>
          {sports.map(sport => (
            <option key={sport.id} value={sport.id}>{sport.name}</option>
          ))}
        </select>
        
        {(selectedCity || selectedSport || searchTerm) && (
          <button
            onClick={() => {
              setSelectedCity('');
              setSelectedSport('');
              setSearchTerm('');
            }}
            style={styles.clearBtn}
          >
            ✕ Zurücksetzen
          </button>
        )}
      </div>

      {/* Results Summary */}
      <div style={styles.summary}>
        {filteredLocations.length} Location{filteredLocations.length !== 1 ? 's' : ''} gefunden
      </div>

      {/* Location List/Grid */}
      {viewMode === 'list' ? (
        <div style={styles.grid}>
          {filteredLocations.length === 0 ? (
            <div style={styles.emptyState}>
              <p>Keine Locations gefunden.</p>
              <p>Versuche andere Filter oder erstelle eine neue Location.</p>
            </div>
          ) : (
            filteredLocations.map(location => (
              <LocationCard
                key={location.id}
                location={location}
                isSelected={selectedLocationId === location.id}
                onSelect={() => onSelectLocation && onSelectLocation(location)}
              />
            ))
          )}
        </div>
      ) : (
        <div style={styles.mapPlaceholder}>
          <p>🗺️ Kartenansicht</p>
          <p style={{ fontSize: 14, color: '#666' }}>
            Integration mit Google Maps / OpenStreetMap kommt hier hin
          </p>
          <div style={{ marginTop: 20 }}>
            {filteredLocations.map(loc => (
              <div key={loc.id} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                📍 {loc.name} - {loc.city}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LocationCard({ location, isSelected, onSelect }) {
  const photos = Array.isArray(location.photos) && location.photos.length > 0
    ? location.photos
    : ['/placeholder-location.jpg'];

  return (
    <div
      style={{
        ...styles.card,
        ...(isSelected ? styles.cardSelected : {})
      }}
      onClick={onSelect}
    >
      {/* Photo */}
      <div style={styles.cardImage}>
        {photos[0] && (
          <img
            src={photos[0]}
            alt={location.name}
            style={styles.image}
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/400x200?text=No+Image';
            }}
          />
        )}
        {location.is_verified && (
          <div style={styles.verifiedBadge}>✓ Verifiziert</div>
        )}
      </div>

      {/* Content */}
      <div style={styles.cardContent}>
        <h3 style={styles.cardTitle}>{location.name}</h3>
        
        {/* Rating */}
        {location.rating > 0 && (
          <div style={styles.rating}>
            ⭐ {location.rating.toFixed(1)} ({location.review_count} Bewertungen)
          </div>
        )}
        
        {/* Address */}
        <div style={styles.address}>
          📍 {location.address || location.city}
          {location.city && `, ${location.city}`}
        </div>
        
        {/* Description */}
        {location.description && (
          <p style={styles.description}>
            {location.description.length > 100
              ? location.description.substring(0, 100) + '...'
              : location.description}
          </p>
        )}
        
        {/* Contact Info */}
        <div style={styles.contact}>
          {location.phone && <span>📞 {location.phone}</span>}
          {location.email && <span>✉️ {location.email}</span>}
        </div>
        
        {/* Opening Hours Indicator */}
        {location.opening_hours && (
          <div style={styles.openingHours}>
            🕐 Öffnungszeiten verfügbar
          </div>
        )}
      </div>

      {/* Action Button */}
      <div style={styles.cardFooter}>
        <button
          style={{
            ...styles.selectBtn,
            ...(isSelected ? styles.selectBtnActive : {})
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected ? '✓ Ausgewählt' : 'Auswählen'}
        </button>
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    padding: 20,
    maxWidth: 1200,
    margin: '0 auto',
    background: '#081c19'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  viewToggle: {
    display: 'flex',
    gap: 8,
    background: '#1f2937',
    padding: 4,
    borderRadius: 8
  },
  toggleBtn: {
    padding: '8px 16px',
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.2s'
  },
  toggleBtnActive: {
    background: '#111827',
    color: '#e5e7eb',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
  },
  filters: {
    display: 'flex',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap'
  },
  searchInput: {
    flex: 1,
    minWidth: 200,
    padding: '10px 12px',
    border: '1px solid #374151',
    borderRadius: 8,
    fontSize: 14,
    background: '#1f2937',
    color: '#e5e7eb'
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #374151',
    borderRadius: 8,
    fontSize: 14,
    background: '#1f2937',
    color: '#e5e7eb',
    cursor: 'pointer'
  },
  clearBtn: {
    padding: '10px 16px',
    border: '1px solid #ddd',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#666'
  },
  summary: {
    marginBottom: 16,
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: 500
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 20
  },
  card: {
    border: '1px solid #374151',
    borderRadius: 12,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s',
    background: '#111827',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
  },
  cardSelected: {
    borderColor: '#4CAF50',
    boxShadow: '0 4px 16px rgba(76, 175, 80, 0.3)',
    transform: 'translateY(-2px)'
  },
  cardImage: {
    position: 'relative',
    height: 180,
    background: '#1f2937',
    overflow: 'hidden'
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: '#4CAF50',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600
  },
  cardContent: {
    padding: 16
  },
  cardTitle: {
    margin: '0 0 8px 0',
    fontSize: 18,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  rating: {
    fontSize: 14,
    color: '#f57c00',
    marginBottom: 8
  },
  address: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8
  },
  description: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 1.5,
    marginBottom: 12
  },
  contact: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 8
  },
  openingHours: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: 500
  },
  cardFooter: {
    padding: '12px 16px',
    borderTop: '1px solid #374151'
  },
  selectBtn: {
    width: '100%',
    padding: '10px 16px',
    border: '2px solid #0a2221',
    borderRadius: 8,
    background: '#111827',
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  selectBtnActive: {
    background: '#0a2221',
    color: '#fff'
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: 60,
    color: '#9ca3af'
  },
  mapPlaceholder: {
    border: '2px dashed #374151',
    borderRadius: 12,
    padding: 40,
    textAlign: 'center',
    background: '#1f2937',
    color: '#9ca3af',
    minHeight: 400
  },
  error: {
    padding: 20,
    background: '#ffebee',
    color: '#c62828',
    borderRadius: 8,
    margin: 20
  }
};
