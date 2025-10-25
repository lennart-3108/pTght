import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

// Country data with ISO2 codes
const COUNTRIES = [
  { code: 'DE', name: 'Deutschland' }
];

// German cities with their states (Bundesländer)
const GERMAN_CITIES = [
  // Stadtstaaten (City-States)
  { name: 'Berlin', state: 'Berlin', country: 'DE' },
  { name: 'Bremen', state: 'Bremen', country: 'DE' },
  { name: 'Hamburg', state: 'Hamburg', country: 'DE' },
  
  // Baden-Württemberg
  { name: 'Stuttgart', state: 'Baden-Württemberg', country: 'DE' },
  { name: 'Karlsruhe', state: 'Baden-Württemberg', country: 'DE' },
  { name: 'Mannheim', state: 'Baden-Württemberg', country: 'DE' },
  { name: 'Freiburg', state: 'Baden-Württemberg', country: 'DE' },
  { name: 'Heidelberg', state: 'Baden-Württemberg', country: 'DE' },
  
  // Bayern (Bavaria)
  { name: 'München', state: 'Bayern', country: 'DE' },
  { name: 'Nürnberg', state: 'Bayern', country: 'DE' },
  { name: 'Augsburg', state: 'Bayern', country: 'DE' },
  { name: 'Regensburg', state: 'Bayern', country: 'DE' },
  { name: 'Würzburg', state: 'Bayern', country: 'DE' },
  
  // Brandenburg
  { name: 'Potsdam', state: 'Brandenburg', country: 'DE' },
  { name: 'Cottbus', state: 'Brandenburg', country: 'DE' },
  
  // Hessen
  { name: 'Frankfurt', state: 'Hessen', country: 'DE' },
  { name: 'Wiesbaden', state: 'Hessen', country: 'DE' },
  { name: 'Kassel', state: 'Hessen', country: 'DE' },
  { name: 'Darmstadt', state: 'Hessen', country: 'DE' },
  
  // Mecklenburg-Vorpommern
  { name: 'Rostock', state: 'Mecklenburg-Vorpommern', country: 'DE' },
  { name: 'Schwerin', state: 'Mecklenburg-Vorpommern', country: 'DE' },
  
  // Niedersachsen (Lower Saxony)
  { name: 'Hannover', state: 'Niedersachsen', country: 'DE' },
  { name: 'Braunschweig', state: 'Niedersachsen', country: 'DE' },
  { name: 'Oldenburg', state: 'Niedersachsen', country: 'DE' },
  { name: 'Osnabrück', state: 'Niedersachsen', country: 'DE' },
  { name: 'Göttingen', state: 'Niedersachsen', country: 'DE' },
  
  // Nordrhein-Westfalen (North Rhine-Westphalia)
  { name: 'Köln', state: 'Nordrhein-Westfalen', country: 'DE' },
  { name: 'Düsseldorf', state: 'Nordrhein-Westfalen', country: 'DE' },
  { name: 'Dortmund', state: 'Nordrhein-Westfalen', country: 'DE' },
  { name: 'Essen', state: 'Nordrhein-Westfalen', country: 'DE' },
  { name: 'Duisburg', state: 'Nordrhein-Westfalen', country: 'DE' },
  { name: 'Bochum', state: 'Nordrhein-Westfalen', country: 'DE' },
  { name: 'Wuppertal', state: 'Nordrhein-Westfalen', country: 'DE' },
  { name: 'Bielefeld', state: 'Nordrhein-Westfalen', country: 'DE' },
  { name: 'Bonn', state: 'Nordrhein-Westfalen', country: 'DE' },
  { name: 'Münster', state: 'Nordrhein-Westfalen', country: 'DE' },
  
  // Rheinland-Pfalz (Rhineland-Palatinate)
  { name: 'Mainz', state: 'Rheinland-Pfalz', country: 'DE' },
  { name: 'Koblenz', state: 'Rheinland-Pfalz', country: 'DE' },
  { name: 'Trier', state: 'Rheinland-Pfalz', country: 'DE' },
  
  // Saarland
  { name: 'Saarbrücken', state: 'Saarland', country: 'DE' },
  
  // Sachsen (Saxony)
  { name: 'Dresden', state: 'Sachsen', country: 'DE' },
  { name: 'Leipzig', state: 'Sachsen', country: 'DE' },
  { name: 'Chemnitz', state: 'Sachsen', country: 'DE' },
  
  // Sachsen-Anhalt
  { name: 'Magdeburg', state: 'Sachsen-Anhalt', country: 'DE' },
  { name: 'Halle', state: 'Sachsen-Anhalt', country: 'DE' },
  
  // Schleswig-Holstein
  { name: 'Kiel', state: 'Schleswig-Holstein', country: 'DE' },
  { name: 'Lübeck', state: 'Schleswig-Holstein', country: 'DE' },
  
  // Thüringen (Thuringia)
  { name: 'Erfurt', state: 'Thüringen', country: 'DE' },
  { name: 'Jena', state: 'Thüringen', country: 'DE' },
  { name: 'Weimar', state: 'Thüringen', country: 'DE' }
].sort((a, b) => a.name.localeCompare(b.name));

/**
 * LocationManagerPage - Manage locations, assets, and bookings
 * 
 * Tabs:
 * 1. Meine Locations - View and manage your locations
 * 2. Meine Assets - Manage assets and configure time slots
 * 3. Reporting Buchungen - View booking reports and statistics
 */
export default function LocationManagerPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('locations');
  const [locations, setLocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewLocationForm, setShowNewLocationForm] = useState(false);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadLocations();
    loadAllAssets();
  }, [token, navigate]);

  async function loadLocations() {
    try {
      setLoading(true);
      // align with backend new route
      const res = await fetch(`${API_BASE}/locations/owner/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
      
      if (data.length > 0) {
        setSelectedLocation(data[0]);
      }
    } catch (err) {
      setError(err.message || 'Fehler beim Laden der Locations');
    } finally {
      setLoading(false);
    }
  }

  async function loadAllAssets() {
    try {
      // Load all assets across all locations owned by this user
      const allAssets = [];
      const locRes = await fetch(`${API_BASE}/locations/owner/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (locRes.ok) {
        const locs = await locRes.json();
        for (const loc of locs) {
          const assetRes = await fetch(`${API_BASE}/assets/location/${loc.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (assetRes.ok) {
            const locAssets = await assetRes.json();
            allAssets.push(...locAssets.map(a => ({ ...a, location_name: loc.name })));
          }
        }
      }
      setAssets(allAssets);
      if (allAssets.length > 0) {
        setSelectedAsset(allAssets[0]);
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Locations...</div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <h2>Keine Locations vorhanden</h2>
          <p style={{color: '#9ca3af'}}>Du hast noch keine Location erstellt.</p>
          <button style={styles.primaryBtn} onClick={() => setShowNewLocationForm(true)}>
            + Neue Location erstellen
          </button>
        </div>
        
        {showNewLocationForm && (
          <LocationForm
            onClose={() => setShowNewLocationForm(false)}
            onSave={() => {
              setShowNewLocationForm(false);
              loadLocations();
              loadAllAssets();
            }}
            token={token}
          />
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Page Title */}
      <div style={styles.pageTitle}>
        <h1 style={styles.mainTitle}>Location Manager</h1>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError('')} style={styles.errorClose}>✕</button>
        </div>
      )}

      {/* Main Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('locations')}
          style={{...styles.tab, ...(activeTab === 'locations' ? styles.tabActive : {})}}
        >
          📍 Meine Locations
        </button>
        <button
          onClick={() => setActiveTab('assets')}
          style={{...styles.tab, ...(activeTab === 'assets' ? styles.tabActive : {})}}
        >
          🏟️ Meine Assets
        </button>
        <button
          onClick={() => setActiveTab('reporting')}
          style={{...styles.tab, ...(activeTab === 'reporting' ? styles.tabActive : {})}}
        >
          📊 Reporting Buchungen
        </button>
      </div>

      {/* Tab Content */}
      <div style={styles.content}>
        {activeTab === 'locations' && (
          <MyLocationsTab 
            locations={locations} 
            selectedLocation={selectedLocation}
            setSelectedLocation={setSelectedLocation}
            onUpdate={loadLocations}
            token={token}
          />
        )}
        {activeTab === 'assets' && (
          <MyAssetsTab 
            assets={assets}
            selectedAsset={selectedAsset}
            setSelectedAsset={setSelectedAsset}
            locations={locations}
            onUpdate={() => { loadLocations(); loadAllAssets(); }}
            token={token}
          />
        )}
        {activeTab === 'reporting' && (
          <ReportingTab 
            locations={locations}
            assets={assets}
            token={token}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Tab 1: My Locations - View and manage locations
 */
function MyLocationsTab({ locations, selectedLocation, setSelectedLocation, onUpdate, token }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  if (locations.length === 0) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.emptyState}>
          <h2>Keine Locations vorhanden</h2>
          <p style={{color: '#9ca3af'}}>Erstelle deine erste Location, um loszulegen.</p>
          <button onClick={() => setShowAddForm(true)} style={styles.primaryBtn}>
            + Neue Location erstellen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.tabContent}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Meine Locations</h2>
        <button onClick={() => setShowAddForm(true)} style={styles.primaryBtn}>
          + Neue Location
        </button>
      </div>

      {showAddForm && (
        <LocationForm
          onClose={() => setShowAddForm(false)}
          onSave={() => {
            setShowAddForm(false);
            onUpdate();
          }}
          token={token}
        />
      )}

      {editingLocation && (
        <LocationForm
          location={editingLocation}
          onClose={() => setEditingLocation(null)}
          onSave={() => {
            setEditingLocation(null);
            onUpdate();
          }}
          token={token}
        />
      )}

      <div style={styles.locationGrid}>
        {locations.map(loc => (
          <LocationCard
            key={loc.id}
            location={loc}
            isSelected={selectedLocation?.id === loc.id}
            onSelect={() => setSelectedLocation(loc)}
            onEdit={() => setEditingLocation(loc)}
            onDelete={() => {
              if (window.confirm(`Location "${loc.name}" wirklich löschen?`)) {
                // Delete logic here
                onUpdate();
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function LocationCard({ location, isSelected, onSelect, onEdit, onDelete }) {
  const navigate = useNavigate();
  
  return (
    <div 
      style={{
        ...styles.locationCard,
        ...(isSelected ? styles.locationCardSelected : {})
      }}
      onClick={onSelect}
    >
      <div style={styles.locationCardHeader}>
        <h3 style={styles.locationCardTitle}>{location.name}</h3>
        <div style={styles.locationCardActions}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={styles.iconBtn} title="Bearbeiten">✏️</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={styles.iconBtn} title="Löschen">🗑️</button>
        </div>
      </div>
      <div style={styles.locationCardBody}>
        <div style={styles.locationInfo}>
          <span>📍 {location.city || 'Keine Stadt'}</span>
        </div>
        {location.address && (
          <div style={styles.locationInfo}>
            <span style={{fontSize: 13, color: '#9ca3af'}}>{location.address}</span>
          </div>
        )}
        <div style={styles.locationInfo}>
          <span style={{
            ...styles.statusBadge,
            background: location.status === 'active' ? '#064e3b' : '#1f2937'
          }}>
            {location.status}
          </span>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/location/${location.id}`);
          }}
          style={{...styles.primaryBtn, width: '100%', marginTop: 12}}
        >
          Assets verwalten →
        </button>
      </div>
    </div>
  );
}

function LocationForm({ location, onClose, onSave, token }) {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    description: location?.description || '',
    country_code: location?.country_code || 'DE',
    city: location?.city || '',
    state: location?.state || '',
    postal_code: location?.postal_code || '',
    street: location?.street || '',
    house_number: location?.house_number || '',
    address: location?.address || '', // Keep for backward compatibility
    phone: location?.phone || '',
    email: location?.email || '',
    website: location?.website || '',
    timezone: location?.timezone || 'Europe/Berlin',
    status: location?.status || 'active'
  });
  const [saving, setSaving] = useState(false);

  // Get state (Bundesland) when city is selected
  const handleCityChange = (cityName) => {
    const cityData = GERMAN_CITIES.find(c => c.name === cityName);
    setFormData({
      ...formData,
      city: cityName,
      state: cityData?.state || ''
    });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      // Combine street and house_number into address field for backend
      const dataToSend = {
        ...formData,
        country: COUNTRIES.find(c => c.code === formData.country_code)?.name || 'Deutschland',
        address: formData.street && formData.house_number 
          ? `${formData.street} ${formData.house_number}`
          : formData.address
      };
      
      const url = location 
        ? `${API_BASE}/locations/${location.id}`
        : `${API_BASE}/locations`;
      
      const res = await fetch(url, {
        method: location ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dataToSend)
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      onSave();
    } catch (err) {
      alert('Fehler beim Speichern: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>
            {location ? 'Location bearbeiten' : 'Neue Location'}
          </h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Name *
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              style={styles.input}
              required
            />
          </label>

          <label style={styles.label}>
            Land *
            <select
              value={formData.country_code}
              onChange={(e) => setFormData({...formData, country_code: e.target.value})}
              style={styles.input}
              required
            >
              {COUNTRIES.map(country => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.code})
                </option>
              ))}
            </select>
          </label>

          <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16}}>
            <label style={styles.label}>
              Stadt *
              <select
                value={formData.city}
                onChange={(e) => handleCityChange(e.target.value)}
                style={styles.input}
                required
              >
                <option value="">-- Stadt wählen --</option>
                {GERMAN_CITIES.map(city => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              PLZ *
              <input
                type="text"
                value={formData.postal_code}
                onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                style={styles.input}
                required
              />
            </label>
          </div>

          {formData.state && (
            <div style={styles.infoBox}>
              <span style={{fontSize: 13, color: '#9ca3af'}}>
                📍 Bundesland: <strong style={{color: '#e5e7eb'}}>{formData.state}</strong>
              </span>
            </div>
          )}

          <div style={{display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16}}>
            <label style={styles.label}>
              Straße *
              <input
                type="text"
                value={formData.street}
                onChange={(e) => setFormData({...formData, street: e.target.value})}
                style={styles.input}
                required
              />
            </label>

            <label style={styles.label}>
              Hausnr. *
              <input
                type="text"
                value={formData.house_number}
                onChange={(e) => setFormData({...formData, house_number: e.target.value})}
                style={styles.input}
                required
              />
            </label>
          </div>

          <label style={styles.label}>
            Beschreibung
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              style={{...styles.input, minHeight: 100}}
              rows={4}
              placeholder="Beschreibe deine Location..."
            />
          </label>

          <label style={styles.label}>
            Zeitzone *
            <input
              type="text"
              value={formData.timezone}
              onChange={(e) => setFormData({...formData, timezone: e.target.value})}
              style={styles.input}
              required
            />
          </label>

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.secondaryBtn}>
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{...styles.primaryBtn, ...(saving ? styles.btnDisabled : {})}}
            >
              {saving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Tab 2: My Assets - Manage assets and configure time slots
 */
function MyAssetsTab({ assets, selectedAsset, setSelectedAsset, locations, onUpdate, token }) {
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);

  if (assets.length === 0) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.emptyState}>
          <h2>Keine Assets vorhanden</h2>
          <p style={{color: '#9ca3af'}}>Erstelle dein erstes Asset, um Zeitslots zu konfigurieren.</p>
          <button onClick={() => setShowAddAsset(true)} style={styles.primaryBtn}>
            + Neues Asset erstellen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.tabContent}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>Meine Assets</h2>
          <p style={{color: '#9ca3af', fontSize: 14, marginTop: 4}}>
            Wähle ein Asset aus, um Zeitslots zu konfigurieren
          </p>
        </div>
        <button onClick={() => setShowAddAsset(true)} style={styles.primaryBtn}>
          + Neues Asset
        </button>
      </div>

      <div style={styles.assetGrid}>
        {assets.map(asset => (
          <div
            key={asset.id}
            style={{
              ...styles.assetCard,
              ...(selectedAsset?.id === asset.id ? { border: '2px solid #4CAF50' } : {})
            }}
            onClick={() => {
              setSelectedAsset(asset);
              setShowTimeSlots(true);
            }}
          >
            <div style={styles.assetCardHeader}>
              <h3 style={styles.assetCardTitle}>{asset.name}</h3>
              <div style={styles.assetCardActions}>
                <button onClick={(e) => { e.stopPropagation(); }} style={styles.iconBtn}>✏️</button>
              </div>
            </div>
            <div style={styles.assetCardBody}>
              <div style={styles.assetInfo}>
                <span style={styles.assetLabel}>Location:</span>
                <span style={styles.assetValue}>{asset.location_name}</span>
              </div>
              <div style={styles.assetInfo}>
                <span style={styles.assetLabel}>Typ:</span>
                <span style={styles.assetValue}>{asset.type}</span>
              </div>
              {asset.indoor !== undefined && (
                <div style={styles.assetInfo}>
                  <span style={styles.assetLabel}>{asset.indoor ? '🏠 Indoor' : '🌤️ Outdoor'}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showTimeSlots && selectedAsset && (
        <div style={{ marginTop: 32, paddingTop: 32, borderTop: '1px solid #374151' }}>
          <TimeSlotsConfig asset={selectedAsset} token={token} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

/**
 * Time Slots Configuration Component
 */
function TimeSlotsConfig({ asset, token, onUpdate }) {
  // Set default date to tomorrow to ensure we have slots
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [viewDate, setViewDate] = useState(tomorrow.toISOString().split('T')[0]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  useEffect(() => {
    if (asset) {
      loadTimeSlots();
    }
  }, [asset, viewDate]);

  async function loadTimeSlots() {
    try {
      setLoading(true);
      const start = `${viewDate} 00:00:00`;
      const end = `${viewDate} 23:59:59`;
      const res = await fetch(
        `${API_BASE}/slots/asset/${asset.id}?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`,
        { headers: { 'Authorization': `Bearer ${token}` }}
      );
      
      if (res.ok) {
        const data = await res.json();
        setTimeSlots(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={styles.sectionHeader}>
        <div>
          <h3 style={styles.sectionTitle}>⏰ Zeitslots für {asset.name}</h3>
          <p style={{color: '#9ca3af', fontSize: 14, marginTop: 4}}>
            Verwalte verfügbare Buchungszeiten
          </p>
        </div>
        <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
          <input
            type="date"
            value={viewDate}
            onChange={(e) => setViewDate(e.target.value)}
            style={styles.input}
          />
          <button 
            onClick={() => setShowGenerator(true)} 
            style={{...styles.primaryBtn, background: '#8b5cf6'}}
          >
            🔄 Slots Generieren
          </button>
          <button onClick={() => setShowAddSlot(true)} style={styles.primaryBtn}>
            + Zeitslot hinzufügen
          </button>
        </div>
      </div>

      {showGenerator && (
        <SlotGenerator
          asset={asset}
          onClose={() => setShowGenerator(false)}
          onGenerated={() => {
            setShowGenerator(false);
            loadTimeSlots();
            onUpdate();
          }}
          token={token}
        />
      )}

      {showAddSlot && (
        <SlotForm
          assetId={asset.id}
          date={viewDate}
          onClose={() => setShowAddSlot(false)}
          onSave={() => {
            setShowAddSlot(false);
            loadTimeSlots();
            onUpdate();
          }}
          token={token}
        />
      )}

      {loading ? (
        <div style={styles.loading}>Lade Zeitslots...</div>
      ) : timeSlots.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{color: '#9ca3af'}}>Keine Zeitslots für dieses Datum vorhanden</p>
        </div>
      ) : (
        <div style={styles.slotList}>
          {timeSlots.map(slot => (
            <div key={slot.id} style={styles.slotListItem}>
              <div style={styles.slotListTime}>
                {new Date(slot.start_time).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}
                {' - '}
                {new Date(slot.end_time).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}
              </div>
              <div style={styles.slotListInfo}>
                <span style={{color: '#9ca3af'}}>{slot.duration_minutes} min</span>
                <span style={{color: '#9ca3af'}}>•</span>
                <span style={{color: '#9ca3af'}}>{slot.base_price} {slot.currency}</span>
                <span style={{color: '#9ca3af'}}>•</span>
                <span style={{
                  ...styles.statusBadge,
                  background: slot.status === 'available' ? '#064e3b' : '#1f2937'
                }}>
                  {slot.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Slot Generator Component - Automatically generate slots based on asset rules
 */
function SlotGenerator({ asset, onClose, onGenerated, token }) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const [formData, setFormData] = useState({
    startDate: tomorrow.toISOString().split('T')[0],
    endDate: new Date(tomorrow.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +7 days
    openTime: '08:00',
    closeTime: '22:00'
  });
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  async function handleGenerate() {
    try {
      setGenerating(true);
      setResult(null);

      // Operating hours for all days (simplified - same hours every day)
      const operatingHours = {
        monday: { open: formData.openTime, close: formData.closeTime },
        tuesday: { open: formData.openTime, close: formData.closeTime },
        wednesday: { open: formData.openTime, close: formData.closeTime },
        thursday: { open: formData.openTime, close: formData.closeTime },
        friday: { open: formData.openTime, close: formData.closeTime },
        saturday: { open: formData.openTime, close: formData.closeTime },
        sunday: { open: formData.openTime, close: formData.closeTime }
      };

      const res = await fetch(`${API_BASE}/slot-generator/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assetId: asset.id,
          startDate: formData.startDate,
          endDate: formData.endDate,
          operatingHours
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      
      // Auto-close after 2 seconds on success
      setTimeout(() => {
        onGenerated();
      }, 2000);

    } catch (err) {
      console.error('Failed to generate slots:', err);
      alert(`Fehler beim Generieren: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3 style={{color: '#e5e7eb', margin: 0}}>🔄 Slots Generieren für {asset.name}</h3>
          <button onClick={onClose} style={styles.iconBtn}>✖️</button>
        </div>

        <div style={{padding: 20}}>
          <p style={{color: '#9ca3af', marginBottom: 20, fontSize: 14}}>
            Generiert automatisch buchbare Zeitslots basierend auf Mindest- und Maximalbuchungsdauer.
            <br/>
            Aktuelle Regeln: {asset.min_booking_duration || 60} - {asset.max_booking_duration || 120} Minuten
          </p>

          <div style={{display: 'grid', gap: 16, marginBottom: 20}}>
            <div>
              <label style={styles.label}>Von Datum</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                style={styles.input}
                min={today.toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label style={styles.label}>Bis Datum</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
                style={styles.input}
                min={formData.startDate}
              />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
              <div>
                <label style={styles.label}>Öffnungszeit</label>
                <input
                  type="time"
                  value={formData.openTime}
                  onChange={(e) => setFormData(prev => ({...prev, openTime: e.target.value}))}
                  style={styles.input}
                />
              </div>

              <div>
                <label style={styles.label}>Schließzeit</label>
                <input
                  type="time"
                  value={formData.closeTime}
                  onChange={(e) => setFormData(prev => ({...prev, closeTime: e.target.value}))}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {result && (
            <div style={{
              padding: 16,
              background: result.created > 0 ? '#064e3b' : '#854d0e',
              borderRadius: 8,
              marginBottom: 20
            }}>
              <div style={{color: '#e5e7eb', fontWeight: 600, marginBottom: 8}}>
                ✅ {result.message}
              </div>
              <div style={{fontSize: 14, color: '#d1d5db'}}>
                • Erstellt: {result.created} Slots
                {result.skipped > 0 && ` • Übersprungen: ${result.skipped} (bereits vorhanden)`}
              </div>
            </div>
          )}

          <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
            <button
              onClick={onClose}
              style={styles.secondaryBtn}
              disabled={generating}
            >
              Abbrechen
            </button>
            <button
              onClick={handleGenerate}
              style={styles.primaryBtn}
              disabled={generating}
            >
              {generating ? 'Generiere...' : '🔄 Jetzt Generieren'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlotForm({ assetId, date, onClose, onSave, token }) {
  const [formData, setFormData] = useState({
    start_time: '09:00',
    end_time: '10:00',
    base_price: 0,
    status: 'available'
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      const startDateTime = `${date}T${formData.start_time}:00`;
      const endDateTime = `${date}T${formData.end_time}:00`;
      
      const res = await fetch(`${API_BASE}/slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          asset_id: assetId,
          start_time: startDateTime,
          end_time: endDateTime,
          base_price: formData.base_price,
          status: formData.status
        })
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      onSave();
    } catch (err) {
      alert('Fehler beim Erstellen: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.inlineForm}>
      <h4 style={{color: '#e5e7eb', marginBottom: 12}}>Neuer Zeitslot</h4>
      <form onSubmit={handleSubmit} style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
        <label style={styles.label}>
          Von
          <input
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({...formData, start_time: e.target.value})}
            style={styles.input}
            required
          />
        </label>

        <label style={styles.label}>
          Bis
          <input
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData({...formData, end_time: e.target.value})}
            style={styles.input}
            required
          />
        </label>

        <label style={styles.label}>
          Preis (€)
          <input
            type="number"
            step="0.01"
            value={formData.base_price}
            onChange={(e) => setFormData({...formData, base_price: parseFloat(e.target.value)})}
            style={styles.input}
          />
        </label>

        <div style={{display: 'flex', gap: 8, alignItems: 'flex-end'}}>
          <button
            type="submit"
            disabled={saving}
            style={{...styles.primaryBtn, ...(saving ? styles.btnDisabled : {})}}
          >
            {saving ? 'Erstellt...' : 'Erstellen'}
          </button>
          <button type="button" onClick={onClose} style={styles.secondaryBtn}>
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Tab 3: Reporting - Booking reports and statistics
 */
function ReportingTab({ locations, assets, token }) {
  const [overviewStats, setOverviewStats] = useState(null);
  const [locationStats, setLocationStats] = useState([]);
  const [assetStats, setAssetStats] = useState([]);
  const [utilization, setUtilization] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Fetch all statistics
  useEffect(() => {
    loadStatistics();
  }, [selectedLocation, selectedAsset, dateRange]);

  async function loadStatistics() {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        ...(selectedLocation && { locationId: selectedLocation }),
        ...(selectedAsset && { assetId: selectedAsset }),
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate })
      }).toString();

      const [overview, byLocation, byAsset, util, monthly, bookingsList] = await Promise.all([
        fetch(`${API_BASE}/booking-stats/overview?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/booking-stats/by-location?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/booking-stats/by-asset?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/booking-stats/utilization?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/booking-stats/monthly?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/bookings?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.ok ? r.json() : [])
      ]);

      setOverviewStats(overview);
      setLocationStats(byLocation);
      setAssetStats(byAsset);
      setUtilization(util);
      setMonthlyStats(monthly);
      setBookings(Array.isArray(bookingsList) ? bookingsList : []);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.loading}>Lade Buchungsdaten...</div>
      </div>
    );
  }

  return (
    <div style={styles.tabContent}>
      <h2 style={styles.sectionTitle}>📊 Reporting Buchungen</h2>
      <p style={{color: '#9ca3af', marginBottom: 24}}>
        Auslastung und Umsatz Ihrer Locations
      </p>

      {/* Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 32,
        padding: 20,
        background: '#1f2937',
        borderRadius: 8
      }}>
        <div>
          <label style={{display: 'block', color: '#9ca3af', marginBottom: 8, fontSize: 13}}>
            Location
          </label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: 6,
              color: '#e5e7eb'
            }}
          >
            <option value="">Alle Locations</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{display: 'block', color: '#9ca3af', marginBottom: 8, fontSize: 13}}>
            Asset
          </label>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: 6,
              color: '#e5e7eb'
            }}
            disabled={!selectedLocation}
          >
            <option value="">Alle Assets</option>
            {assets
              .filter(a => !selectedLocation || a.location_id == selectedLocation)
              .map(asset => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))
            }
          </select>
        </div>

        <div>
          <label style={{display: 'block', color: '#9ca3af', marginBottom: 8, fontSize: 13}}>
            Von
          </label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: 6,
              color: '#e5e7eb'
            }}
          />
        </div>

        <div>
          <label style={{display: 'block', color: '#9ca3af', marginBottom: 8, fontSize: 13}}>
            Bis
          </label>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: 6,
              color: '#e5e7eb'
            }}
          />
        </div>
      </div>

      {/* Overview Stats Cards */}
      {overviewStats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32
        }}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{overviewStats?.totalBookings || 0}</div>
            <div style={styles.statLabel}>📅 Gesamt Buchungen</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              €{Number(overviewStats?.totalRevenue || 0).toFixed(2)}
            </div>
            <div style={styles.statLabel}>💰 Gesamtumsatz</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              €{Number(overviewStats?.averageBookingValue || 0).toFixed(2)}
            </div>
            <div style={styles.statLabel}>📊 Ø Buchungswert</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {utilization?.utilizationRate != null ? `${utilization.utilizationRate.toFixed(1)}%` : 'N/A'}
            </div>
            <div style={styles.statLabel}>⚡ Auslastung</div>
          </div>
        </div>
      )}

      {/* Location Stats Table */}
      {locationStats.length > 0 && (
        <div style={{marginBottom: 32}}>
          <h3 style={{color: '#e5e7eb', marginBottom: 16}}>📍 Statistik nach Location</h3>
          <div style={{
            background: '#1f2937',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{background: '#111827'}}>
                  <th style={{...styles.tableHeader, textAlign: 'left'}}>Location</th>
                  <th style={{...styles.tableHeader, textAlign: 'right'}}>Stadt</th>
                  <th style={{...styles.tableHeader, textAlign: 'right'}}>Buchungen</th>
                  <th style={{...styles.tableHeader, textAlign: 'right'}}>Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {locationStats.map((stat, idx) => (
                  <tr key={idx} style={{borderTop: '1px solid #374151'}}>
                    <td style={styles.tableCell}>{stat.location_name}</td>
                    <td style={{...styles.tableCell, textAlign: 'right'}}>{stat.city}</td>
                    <td style={{...styles.tableCell, textAlign: 'right', fontWeight: 600}}>
                      {stat.total_bookings}
                    </td>
                    <td style={{...styles.tableCell, textAlign: 'right', color: '#10b981'}}>
                      €{parseFloat(stat.total_revenue || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Asset Stats Table */}
      {assetStats.length > 0 && (
        <div style={{marginBottom: 32}}>
          <h3 style={{color: '#e5e7eb', marginBottom: 16}}>🎯 Statistik nach Asset</h3>
          <div style={{
            background: '#1f2937',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr style={{background: '#111827'}}>
                  <th style={{...styles.tableHeader, textAlign: 'left'}}>Asset</th>
                  <th style={{...styles.tableHeader, textAlign: 'right'}}>Typ</th>
                  <th style={{...styles.tableHeader, textAlign: 'right'}}>Buchungen</th>
                  <th style={{...styles.tableHeader, textAlign: 'right'}}>Umsatz</th>
                  <th style={{...styles.tableHeader, textAlign: 'right'}}>Auslastung</th>
                </tr>
              </thead>
              <tbody>
                {assetStats.map((stat, idx) => (
                  <tr key={idx} style={{borderTop: '1px solid #374151'}}>
                    <td style={styles.tableCell}>{stat.asset_name}</td>
                    <td style={{...styles.tableCell, textAlign: 'right'}}>{stat.asset_type}</td>
                    <td style={{...styles.tableCell, textAlign: 'right', fontWeight: 600}}>
                      {stat.total_bookings}
                    </td>
                    <td style={{...styles.tableCell, textAlign: 'right', color: '#10b981'}}>
                      €{parseFloat(stat.total_revenue || 0).toFixed(2)}
                    </td>
                    <td style={{...styles.tableCell, textAlign: 'right'}}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: stat.utilization_rate > 70 ? '#064e3b' : 
                                   stat.utilization_rate > 40 ? '#854d0e' : '#7f1d1d',
                        fontSize: 13
                      }}>
                        {stat.utilization_rate != null ? `${stat.utilization_rate.toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Trend Chart */}
      {monthlyStats.length > 0 && (
        <div style={{marginBottom: 32}}>
          <h3 style={{color: '#e5e7eb', marginBottom: 16}}>📈 Monatlicher Trend</h3>
          <div style={{
            background: '#1f2937',
            borderRadius: 8,
            padding: 20
          }}>
            <div style={{display: 'flex', alignItems: 'flex-end', gap: 8, height: 200}}>
              {monthlyStats.map((stat, idx) => {
                const maxBookings = Math.max(...monthlyStats.map(s => s.total_bookings));
                const height = maxBookings > 0 ? (stat.total_bookings / maxBookings) * 180 : 0;
                return (
                  <div key={idx} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <div
                      style={{
                        width: '100%',
                        background: '#10b981',
                        height: `${height}px`,
                        borderRadius: '4px 4px 0 0',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      title={`${stat.month_name}: ${stat.total_bookings} Buchungen, €${stat.total_revenue}`}
                    >
                      <div style={{
                        position: 'absolute',
                        top: -20,
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        fontSize: 12,
                        color: '#9ca3af'
                      }}>
                        {stat.total_bookings}
                      </div>
                    </div>
                    <div style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: '#6b7280',
                      transform: 'rotate(-45deg)',
                      transformOrigin: 'center',
                      width: 40
                    }}>
                      {stat.month_name?.substring(0, 3)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Utilization Details */}
      {utilization && (
        <div style={{marginBottom: 32}}>
          <h3 style={{color: '#e5e7eb', marginBottom: 16}}>⚡ Auslastungsdetails</h3>
          <div style={{
            background: '#1f2937',
            borderRadius: 8,
            padding: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 16
          }}>
            <div>
              <div style={{fontSize: 13, color: '#9ca3af', marginBottom: 4}}>Gesamtslots</div>
              <div style={{fontSize: 24, fontWeight: 600, color: '#e5e7eb'}}>
                {utilization.totalSlots || 0}
              </div>
            </div>
            <div>
              <div style={{fontSize: 13, color: '#9ca3af', marginBottom: 4}}>Gebucht</div>
              <div style={{fontSize: 24, fontWeight: 600, color: '#10b981'}}>
                {utilization.bookedSlots || 0}
              </div>
            </div>
            <div>
              <div style={{fontSize: 13, color: '#9ca3af', marginBottom: 4}}>Verfügbar</div>
              <div style={{fontSize: 24, fontWeight: 600, color: '#6b7280'}}>
                {utilization.availableSlots || 0}
              </div>
            </div>
            <div>
              <div style={{fontSize: 13, color: '#9ca3af', marginBottom: 4}}>Auslastungsrate</div>
              <div style={{fontSize: 24, fontWeight: 600, color: '#3b82f6'}}>
                {utilization.utilizationRate != null ? `${utilization.utilizationRate.toFixed(1)}%` : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Bookings List */}
      {bookings.length > 0 && (
        <div>
          <h3 style={{color: '#e5e7eb', marginBottom: 16}}>📋 Letzte Buchungen</h3>
          <div style={{
            background: '#1f2937',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            {bookings.slice(0, 10).map((booking, idx) => (
              <div
                key={booking.id}
                style={{
                  padding: 16,
                  borderTop: idx > 0 ? '1px solid #374151' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{fontWeight: 600, color: '#e5e7eb', marginBottom: 4}}>
                    {booking.location_name} - {booking.asset_name}
                  </div>
                  <div style={{fontSize: 13, color: '#9ca3af'}}>
                    📅 {new Date(booking.start_time).toLocaleString('de-DE', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </div>
                  {booking.user_id && (
                    <div style={{fontSize: 13, color: '#9ca3af', marginTop: 2}}>
                      👤 User ID: {booking.user_id}
                    </div>
                  )}
                </div>
                <div style={{display: 'flex', gap: 16, alignItems: 'center'}}>
                  <span style={{color: '#10b981', fontWeight: 600, fontSize: 16}}>
                    €{booking.price || 0}
                  </span>
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    background: 
                      booking.status === 'paid' || booking.status === 'confirmed' ? '#064e3b' :
                      booking.status === 'cancelled' ? '#7f1d1d' :
                      booking.status === 'held' ? '#854d0e' : '#1f2937',
                    color: '#e5e7eb'
                  }}>
                    {booking.status?.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!overviewStats && bookings.length === 0 && (
        <div style={styles.emptyState}>
          <p style={{color: '#9ca3af', fontSize: 16}}>
            Noch keine Buchungsdaten für den gewählten Zeitraum vorhanden
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * OLD COMPONENTS BELOW - Not currently used in new 3-tab layout
 * (AssetsManagementTab, AssetCard, AssetForm, TimeSlotsTab, TimelineView, SlotForm)
 */
function AssetsManagementTab({ location }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (location) {
      loadAssets();
    }
  }, [location]);

  async function loadAssets() {
    try {
      setLoading(true);
      // use new assets route: /assets/location/:locationId
      const res = await fetch(`${API_BASE}/assets/location/${location.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setAssets(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={styles.loading}>Lade Assets...</div>;
  }

  return (
    <div style={styles.tabContent}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Plätze & Assets</h2>
        <button
          onClick={() => setShowAddForm(true)}
          style={styles.primaryBtn}
        >
          + Neuer Platz
        </button>
      </div>

      {showAddForm && (
        <AssetForm
          locationId={location.id}
          onClose={() => setShowAddForm(false)}
          onSave={() => {
            setShowAddForm(false);
            loadAssets();
          }}
        />
      )}

      {editingAsset && (
        <AssetForm
          locationId={location.id}
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
          onSave={() => {
            setEditingAsset(null);
            loadAssets();
          }}
        />
      )}

      <div style={styles.assetGrid}>
        {assets.map(asset => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onEdit={() => setEditingAsset(asset)}
            onDelete={() => {
              if (window.confirm('Asset wirklich löschen?')) {
                // Delete logic
                loadAssets();
              }
            }}
          />
        ))}
      </div>

      {assets.length === 0 && !showAddForm && (
        <div style={styles.emptyState}>
          <p style={{color: '#9ca3af'}}>Noch keine Plätze hinzugefügt</p>
        </div>
      )}
    </div>
  );
}

function AssetCard({ asset, onEdit, onDelete }) {
  return (
    <div style={styles.assetCard}>
      <div style={styles.assetCardHeader}>
        <h3 style={styles.assetCardTitle}>{asset.name}</h3>
        <div style={styles.assetCardActions}>
          <button onClick={onEdit} style={styles.iconBtn}>✏️</button>
          <button onClick={onDelete} style={styles.iconBtn}>🗑️</button>
        </div>
      </div>
      
      <div style={styles.assetCardBody}>
        <div style={styles.assetInfo}>
          <span style={styles.assetLabel}>Typ:</span>
          <span style={styles.assetValue}>{asset.type}</span>
        </div>
        {(asset.length || asset.width) && (
          <div style={styles.assetInfo}>
            <span style={styles.assetLabel}>Maße:</span>
            <span style={styles.assetValue}>{`${asset.length || ''}${asset.length ? 'x' : ''}${asset.width || ''}`}</span>
          </div>
        )}
        <div style={styles.assetInfo}>
          <span style={styles.assetLabel}>Status:</span>
          <span style={{
            ...styles.statusBadge,
            background: asset.status === 'active' ? '#064e3b' : '#1f2937'
          }}>
            {asset.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function AssetForm({ locationId, asset, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: asset?.name || '',
    asset_type: asset?.asset_type || 'court',
    sport_id: asset?.sport_id || '',
    dimensions: asset?.dimensions || '',
    surface_type: asset?.surface_type || '',
    indoor: asset?.indoor || false,
    status: asset?.status || 'active',
    description: asset?.description || '',
    base_price_per_hour: asset?.base_price_per_hour || 0
  });
  const [sports, setSports] = useState([]);
  const [saving, setSaving] = useState(false);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    loadSports();
  }, []);

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

  async function handleSubmit(e) {
    e.preventDefault();
    
    try {
      setSaving(true);
      // map form fields to backend schema
      const payload = {
        name: formData.name,
        type: formData.asset_type,
        surface: formData.surface_type || null,
        indoor: !!formData.indoor,
        status: formData.status,
        description: formData.description || null,
      };

      const url = asset 
        ? `${API_BASE}/assets/${asset.id}`
        : `${API_BASE}/assets`;

      const body = asset ? JSON.stringify(payload) : JSON.stringify({ location_id: locationId, ...payload });

      const res = await fetch(url, {
        method: asset ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      onSave();
    } catch (err) {
      alert('Fehler beim Speichern: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>
            {asset ? 'Asset bearbeiten' : 'Neues Asset'}
          </h3>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Name *
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              style={styles.input}
              required
            />
          </label>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
            <label style={styles.label}>
              Typ *
              <select
                value={formData.asset_type}
                onChange={(e) => setFormData({...formData, asset_type: e.target.value})}
                style={styles.input}
                required
              >
                <option value="court">Court/Platz</option>
                <option value="field">Feld</option>
                <option value="hall">Halle</option>
                <option value="room">Raum</option>
                <option value="track">Bahn</option>
              </select>
            </label>

            <label style={styles.label}>
              Sport
              <select
                value={formData.sport_id}
                onChange={(e) => setFormData({...formData, sport_id: e.target.value})}
                style={styles.input}
              >
                <option value="">Alle Sportarten</option>
                {sports.map(sport => (
                  <option key={sport.id} value={sport.id}>{sport.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
            <label style={styles.label}>
              Maße (z.B. 20x40m)
              <input
                type="text"
                value={formData.dimensions}
                onChange={(e) => setFormData({...formData, dimensions: e.target.value})}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Bodenbelag
              <input
                type="text"
                value={formData.surface_type}
                onChange={(e) => setFormData({...formData, surface_type: e.target.value})}
                style={styles.input}
                placeholder="z.B. Kunstrasen, Parkett"
              />
            </label>
          </div>

          <label style={styles.label}>
            Preis pro Stunde (€)
            <input
              type="number"
              step="0.01"
              value={formData.base_price_per_hour}
              onChange={(e) => setFormData({...formData, base_price_per_hour: parseFloat(e.target.value)})}
              style={styles.input}
            />
          </label>

          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={formData.indoor}
              onChange={(e) => setFormData({...formData, indoor: e.target.checked})}
            />
            <span>Indoor / Überdacht</span>
          </label>

          <label style={styles.label}>
            Beschreibung
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              style={{...styles.input, minHeight: 80}}
              rows={3}
            />
          </label>

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.secondaryBtn}>
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{...styles.primaryBtn, ...(saving ? styles.btnDisabled : {})}}
            >
              {saving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Tab 3: Time Slots Configuration
 */
function TimeSlotsTab({ location }) {
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (location) {
      loadAssets();
    }
  }, [location]);

  useEffect(() => {
    if (selectedAsset) {
      loadTimeSlots();
    }
  }, [selectedAsset, viewDate]);

  async function loadAssets() {
    try {
      const res = await fetch(`${API_BASE}/locations/${location.id}/assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setAssets(Array.isArray(data) ? data : []);
        if (data.length > 0) {
          setSelectedAsset(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTimeSlots() {
    try {
      const start = `${viewDate} 00:00:00`;
      const end = `${viewDate} 23:59:59`;
      const res = await fetch(
        `${API_BASE}/slots/asset/${selectedAsset.id}?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`,
        { headers: { 'Authorization': `Bearer ${token}` }}
      );
      
      if (res.ok) {
        const data = await res.json();
        setTimeSlots(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
    }
  }

  if (loading) {
    return <div style={styles.loading}>Lade Assets...</div>;
  }

  if (assets.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p style={{color: '#9ca3af'}}>Erstelle zuerst Assets, um Zeitslots zu konfigurieren</p>
      </div>
    );
  }

  return (
    <div style={styles.tabContent}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Zeitslot Konfiguration</h2>
        <div style={{display: 'flex', gap: 12}}>
          <select
            value={selectedAsset?.id || ''}
            onChange={(e) => {
              const asset = assets.find(a => a.id === parseInt(e.target.value));
              setSelectedAsset(asset);
            }}
            style={styles.input}
          >
            {assets.map(asset => (
              <option key={asset.id} value={asset.id}>{asset.name}</option>
            ))}
          </select>
          
          <input
            type="date"
            value={viewDate}
            onChange={(e) => setViewDate(e.target.value)}
            style={styles.input}
          />
        </div>
      </div>

      <TimelineView
        asset={selectedAsset}
        date={viewDate}
        slots={timeSlots}
        onUpdate={loadTimeSlots}
      />
    </div>
  );
}

/**
 * Visual Timeline Component for Time Slots
 */
function TimelineView({ asset, date, slots, onUpdate }) {
  const [showAddSlot, setShowAddSlot] = useState(false);
  
  // Generate hourly grid (6:00 - 24:00)
  const hours = Array.from({ length: 19 }, (_, i) => i + 6);
  
  return (
    <div style={styles.timeline}>
      <div style={styles.timelineHeader}>
        <h3 style={styles.timelineTitle}>
          {asset.name} - {new Date(date).toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })}
        </h3>
        <button
          onClick={() => setShowAddSlot(true)}
          style={styles.primaryBtn}
        >
          + Zeitslot hinzufügen
        </button>
      </div>

      {showAddSlot && (
        <SlotForm
          assetId={asset.id}
          date={date}
          onClose={() => setShowAddSlot(false)}
          onSave={() => {
            setShowAddSlot(false);
            onUpdate();
          }}
        />
      )}

      <div style={styles.timelineGrid}>
        {/* Hour labels */}
        <div style={styles.hourLabels}>
          {hours.map(hour => (
            <div key={hour} style={styles.hourLabel}>
              {hour.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div style={styles.slotsContainer}>
          {slots.map(slot => {
            const start = new Date(slot.start_time);
            const end = new Date(slot.end_time);
            const startHour = start.getHours() + start.getMinutes() / 60;
            const duration = (end - start) / (1000 * 60 * 60); // hours
            
            const left = ((startHour - 6) / 18) * 100;
            const width = (duration / 18) * 100;
            
            return (
              <div
                key={slot.id}
                style={{
                  ...styles.slotBlock,
                  left: `${left}%`,
                  width: `${width}%`,
                  background: slot.status === 'available' ? '#064e3b' : 
                             slot.status === 'booked' ? '#1f2937' : '#7f1d1d'
                }}
                title={`${start.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} - ${end.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}`}
              >
                <div style={styles.slotBlockContent}>
                  <div style={styles.slotBlockTime}>
                    {start.toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}
                  </div>
                  <div style={styles.slotBlockStatus}>
                    {slot.status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slot List */}
      <div style={styles.slotList}>
        <h4 style={{color: '#e5e7eb', marginBottom: 12}}>Alle Zeitslots</h4>
        {slots.map(slot => (
          <div key={slot.id} style={styles.slotListItem}>
            <div style={styles.slotListTime}>
              {new Date(slot.start_time).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}
              {' - '}
              {new Date(slot.end_time).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}
            </div>
            <div style={styles.slotListInfo}>
              <span style={{color: '#9ca3af'}}>{slot.duration_minutes} min</span>
              <span style={{color: '#9ca3af'}}>•</span>
              <span style={{color: '#9ca3af'}}>{slot.base_price} {slot.currency}</span>
              <span style={{color: '#9ca3af'}}>•</span>
              <span style={{
                ...styles.statusBadge,
                background: slot.status === 'available' ? '#064e3b' : '#1f2937'
              }}>
                {slot.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    background: '#081c19',
    padding: 20
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: 32,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  subtitle: {
    margin: 0,
    fontSize: 16,
    color: '#9ca3af'
  },
  locationSelect: {
    padding: '10px 16px',
    border: '1px solid #374151',
    borderRadius: 8,
    background: '#111827',
    color: '#e5e7eb',
    fontSize: 16,
    minWidth: 250
  },
  tabs: {
    display: 'flex',
    gap: 8,
    borderBottom: '2px solid #374151',
    marginBottom: 24
  },
  tab: {
    padding: '12px 24px',
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: -2,
    transition: 'all 0.2s'
  },
  tabActive: {
    color: '#e5e7eb',
    borderBottomColor: '#4CAF50',
    fontWeight: 600
  },
  content: {
    maxWidth: 1200,
    margin: '0 auto'
  },
  tabContent: {
    background: '#111827',
    borderRadius: 12,
    padding: 24,
    border: '1px solid #374151'
  },
  sectionTitle: {
    margin: '0 0 20px 0',
    fontSize: 24,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 14,
    fontWeight: 500,
    color: '#e5e7eb'
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #374151',
    borderRadius: 6,
    background: '#1f2937',
    color: '#e5e7eb',
    fontSize: 14
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: '#e5e7eb',
    cursor: 'pointer'
  },
  primaryBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 8,
    background: '#0a2221',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  secondaryBtn: {
    padding: '10px 20px',
    border: '1px solid #374151',
    borderRadius: 8,
    background: 'transparent',
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer'
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  message: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    color: '#fff',
    fontSize: 14
  },
  assetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16
  },
  assetCard: {
    background: '#1f2937',
    borderRadius: 8,
    border: '1px solid #374151',
    overflow: 'hidden'
  },
  assetCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottom: '1px solid #374151'
  },
  assetCardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  assetCardActions: {
    display: 'flex',
    gap: 8
  },
  iconBtn: {
    padding: 6,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 16
  },
  assetCardBody: {
    padding: 16
  },
  assetInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: 14
  },
  assetLabel: {
    color: '#9ca3af'
  },
  assetValue: {
    color: '#e5e7eb',
    fontWeight: 500
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    color: '#fff'
  },
  infoBox: {
    padding: '12px 16px',
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: 8,
    marginBottom: 8
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: '#111827',
    borderRadius: 12,
    border: '1px solid #374151',
    maxWidth: 600,
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottom: '1px solid #374151'
  },
  modalTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  closeBtn: {
    padding: 8,
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: 20,
    cursor: 'pointer'
  },
  modalActions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 20
  },
  timeline: {
    marginTop: 24
  },
  timelineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  timelineTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  timelineGrid: {
    position: 'relative',
    background: '#1f2937',
    borderRadius: 8,
    padding: '20px 0',
    marginBottom: 24,
    minHeight: 80
  },
  hourLabels: {
    display: 'flex',
    paddingLeft: 20,
    paddingRight: 20
  },
  hourLabel: {
    flex: 1,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    borderLeft: '1px solid #374151',
    paddingTop: 8
  },
  slotsContainer: {
    position: 'relative',
    height: 60,
    marginTop: 12,
    marginLeft: 20,
    marginRight: 20
  },
  slotBlock: {
    position: 'absolute',
    height: 50,
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  slotBlockContent: {
    padding: 8,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  slotBlockTime: {
    fontSize: 11,
    fontWeight: 600,
    color: '#fff'
  },
  slotBlockStatus: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2
  },
  slotList: {
    background: '#1f2937',
    borderRadius: 8,
    padding: 16
  },
  slotListItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #374151'
  },
  slotListTime: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  slotListInfo: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    fontSize: 13
  },
  inlineForm: {
    background: '#1f2937',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20
  },
  loading: {
    textAlign: 'center',
    padding: 40,
    fontSize: 16,
    color: '#9ca3af'
  },
  emptyState: {
    textAlign: 'center',
    padding: 60,
    background: '#111827',
    borderRadius: 12,
    border: '1px solid #374151'
  },
  error: {
    position: 'relative',
    marginBottom: 20,
    padding: 16,
    background: '#7f1d1d',
    color: '#fecaca',
    borderRadius: 8,
    border: '1px solid #991b1b'
  },
  errorClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    border: 'none',
    background: 'transparent',
    fontSize: 18,
    cursor: 'pointer',
    color: '#fecaca'
  }
};
