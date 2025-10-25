import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

/**
 * LocationDetailsPage - Shows all assets of a location, grouped by sport
 * 
 * Features:
 * - Asset list grouped by sport type
 * - Add new asset
 * - Configure asset (sports, slot timing)
 * - Generate time slots for assets
 */
export default function LocationDetailsPage() {
  const { locationId } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [assets, setAssets] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadData();
  }, [locationId, token, navigate]);

  async function loadData() {
    try {
      setLoading(true);
      
      // Load location details
      const locRes = await fetch(`${API_BASE}/locations/${locationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (locRes.ok) {
        const locData = await locRes.json();
        setLocation(locData);
      }
      
      // Load assets for this location
      const assetsRes = await fetch(`${API_BASE}/assets/location/${locationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        setAssets(Array.isArray(assetsData) ? assetsData : []);
      }
      
      // Load available sports
      const sportsRes = await fetch(`${API_BASE}/sports`);
      if (sportsRes.ok) {
        const sportsData = await sportsRes.json();
        setSports(Array.isArray(sportsData) ? sportsData : []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Group assets by their sports
  const assetsBySport = assets.reduce((acc, asset) => {
    const sportsList = asset.sports_json ? JSON.parse(asset.sports_json) : [];
    
    if (sportsList.length === 0) {
      if (!acc['Ohne Sportart']) acc['Ohne Sportart'] = [];
      acc['Ohne Sportart'].push(asset);
    } else {
      sportsList.forEach(sportId => {
        const sport = sports.find(s => s.id === sportId);
        const sportName = sport ? sport.name : `Sport ${sportId}`;
        if (!acc[sportName]) acc[sportName] = [];
        acc[sportName].push(asset);
      });
    }
    
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Location...</div>
      </div>
    );
  }

  if (!location) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Location nicht gefunden</div>
        <button onClick={() => navigate('/location-manager')} style={styles.secondaryBtn}>
          Zurück zur Übersicht
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/location-manager')} style={styles.backBtn}>
          ← Zurück
        </button>
        <div>
          <h1 style={styles.title}>{location.name}</h1>
          <p style={styles.subtitle}>
            {location.city} • {location.address || 'Keine Adresse'}
          </p>
        </div>
        <button onClick={() => setShowAssetForm(true)} style={styles.primaryBtn}>
          + Asset hinzufügen
        </button>
      </div>

      {/* Asset Form Modal */}
      {(showAssetForm || editingAsset) && (
        <AssetForm
          asset={editingAsset}
          locationId={locationId}
          sports={sports}
          onClose={() => {
            setShowAssetForm(false);
            setEditingAsset(null);
          }}
          onSave={() => {
            setShowAssetForm(false);
            setEditingAsset(null);
            loadData();
          }}
          token={token}
        />
      )}

      {/* Assets grouped by Sport */}
      <div style={styles.content}>
        {Object.keys(assetsBySport).length === 0 ? (
          <div style={styles.emptyState}>
            <h2>Keine Assets vorhanden</h2>
            <p style={{color: '#9ca3af'}}>Erstelle dein erstes Asset für diese Location.</p>
          </div>
        ) : (
          Object.entries(assetsBySport).map(([sportName, sportAssets]) => (
            <div key={sportName} style={styles.sportGroup}>
              <h2 style={styles.sportTitle}>
                <span style={styles.sportIcon}>
                  {sportName === 'Tennis' ? '🎾' : 
                   sportName === 'Fußball' ? '⚽' : 
                   sportName === 'Basketball' ? '🏀' : 
                   sportName === 'Volleyball' ? '🏐' : '🏟️'}
                </span>
                {sportName}
                <span style={styles.sportCount}>({sportAssets.length})</span>
              </h2>
              
              <div style={styles.assetGrid}>
                {sportAssets.map(asset => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    onEdit={() => setEditingAsset(asset)}
                    onConfigure={() => navigate(`/location/${locationId}/asset/${asset.id}/configure`)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * AssetCard - Display single asset
 */
function AssetCard({ asset, onEdit, onConfigure }) {
  return (
    <div style={styles.assetCard}>
      <div style={styles.assetCardHeader}>
        <h3 style={styles.assetName}>{asset.name}</h3>
        <div style={styles.assetActions}>
          <button onClick={onEdit} style={styles.iconBtn} title="Bearbeiten">
            ✏️
          </button>
        </div>
      </div>
      
      <div style={styles.assetCardBody}>
        {asset.description && (
          <p style={{fontSize: 13, color: '#9ca3af', marginBottom: 12}}>{asset.description}</p>
        )}
        
        <div style={styles.assetInfo}>
          <span style={styles.assetLabel}>Typ:</span>
          <span style={styles.assetValue}>{asset.type || '-'}</span>
        </div>
        
        {asset.surface && (
          <div style={styles.assetInfo}>
            <span style={styles.assetLabel}>Oberfläche:</span>
            <span style={styles.assetValue}>{asset.surface}</span>
          </div>
        )}
        
        {(asset.length && asset.width) && (
          <div style={styles.assetInfo}>
            <span style={styles.assetLabel}>Größe:</span>
            <span style={styles.assetValue}>{asset.length}m × {asset.width}m</span>
          </div>
        )}
        
        <div style={styles.assetInfo}>
          <span style={styles.assetLabel}>Zeitslot:</span>
          <span style={styles.assetValue}>
            {asset.slot_duration || 60} min + {asset.slot_pause || 0} min Pause
          </span>
        </div>
        
        <button onClick={onConfigure} style={{...styles.primaryBtn, width: '100%', marginTop: 12}}>
          ⚙️ Konfigurieren
        </button>
      </div>
    </div>
  );
}

/**
 * AssetForm - Create or edit asset
 */
function AssetForm({ asset, locationId, sports, onClose, onSave, token }) {
  const [formData, setFormData] = useState({
    name: asset?.name || '',
    description: asset?.description || '',
    type: asset?.type || 'court',
    surface: asset?.surface || '',
    length: asset?.length || '',
    width: asset?.width || '',
    capacity: asset?.capacity || '',
    sports_json: asset?.sports_json || '[]',
    slot_duration: asset?.slot_duration || 60,
    slot_pause: asset?.slot_pause || 0,
    status: asset?.status || 'active'
  });
  const [selectedSports, setSelectedSports] = useState(
    asset?.sports_json ? JSON.parse(asset.sports_json) : []
  );
  const [saving, setSaving] = useState(false);

  const toggleSport = (sportId) => {
    if (selectedSports.includes(sportId)) {
      setSelectedSports(selectedSports.filter(id => id !== sportId));
    } else {
      setSelectedSports([...selectedSports, sportId]);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      const dataToSend = {
        ...formData,
        location_id: locationId,
        sports_json: JSON.stringify(selectedSports)
      };
      
      const url = asset 
        ? `${API_BASE}/assets/${asset.id}`
        : `${API_BASE}/assets`;
      
      const res = await fetch(url, {
        method: asset ? 'PUT' : 'POST',
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

          <label style={styles.label}>
            Beschreibung
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              style={{...styles.input, minHeight: 60}}
              rows={2}
            />
          </label>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
            <label style={styles.label}>
              Typ *
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                style={styles.input}
                required
              >
                <option value="court">Court</option>
                <option value="field">Field</option>
                <option value="hall">Hall</option>
                <option value="table">Table</option>
                <option value="track">Track</option>
              </select>
            </label>

            <label style={styles.label}>
              Oberfläche
              <input
                type="text"
                value={formData.surface}
                onChange={(e) => setFormData({...formData, surface: e.target.value})}
                style={styles.input}
                placeholder="z.B. Hartplatz, Rasen"
              />
            </label>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16}}>
            <label style={styles.label}>
              Länge (m)
              <input
                type="number"
                step="0.1"
                value={formData.length}
                onChange={(e) => setFormData({...formData, length: e.target.value})}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Breite (m)
              <input
                type="number"
                step="0.1"
                value={formData.width}
                onChange={(e) => setFormData({...formData, width: e.target.value})}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Kapazität
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                style={styles.input}
              />
            </label>
          </div>

          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Sportarten *</legend>
            <div style={styles.sportCheckboxes}>
              {sports.map(sport => (
                <label key={sport.id} style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedSports.includes(sport.id)}
                    onChange={() => toggleSport(sport.id)}
                    style={styles.checkbox}
                  />
                  {sport.name}
                  {sport.type && (
                    <span style={{fontSize: 11, color: '#9ca3af', marginLeft: 4}}>
                      ({sport.type})
                    </span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Zeitslot-Taktung</legend>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
              <label style={styles.label}>
                Session-Dauer (min) *
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={formData.slot_duration}
                  onChange={(e) => setFormData({...formData, slot_duration: parseInt(e.target.value)})}
                  style={styles.input}
                  required
                />
              </label>

              <label style={styles.label}>
                Pause danach (min)
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={formData.slot_pause}
                  onChange={(e) => setFormData({...formData, slot_pause: parseInt(e.target.value)})}
                  style={styles.input}
                />
              </label>
            </div>
            <p style={{fontSize: 12, color: '#9ca3af', marginTop: 8}}>
              💡 Zeitslots werden automatisch mit {formData.slot_duration}min Session + {formData.slot_pause}min Pause generiert
            </p>
          </fieldset>

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.secondaryBtn}>
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving || selectedSports.length === 0}
              style={{...styles.primaryBtn, ...(saving || selectedSports.length === 0 ? styles.btnDisabled : {})}}
            >
              {saving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </form>
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
    alignItems: 'center',
    marginBottom: 30,
    gap: 20
  },
  backBtn: {
    padding: '8px 16px',
    border: '1px solid #374151',
    borderRadius: 8,
    background: '#111827',
    color: '#e5e7eb',
    fontSize: 14,
    cursor: 'pointer'
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: 14,
    color: '#9ca3af'
  },
  loading: {
    textAlign: 'center',
    padding: 60,
    color: '#9ca3af'
  },
  error: {
    color: '#ef4444',
    padding: 20,
    marginBottom: 20
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 40
  },
  emptyState: {
    textAlign: 'center',
    padding: 60,
    color: '#e5e7eb'
  },
  sportGroup: {
    marginBottom: 32
  },
  sportTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 22,
    fontWeight: 600,
    color: '#e5e7eb',
    marginBottom: 20
  },
  sportIcon: {
    fontSize: 28
  },
  sportCount: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: 400
  },
  assetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16
  },
  assetCard: {
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: 12,
    overflow: 'hidden'
  },
  assetCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 16px 0 16px'
  },
  assetName: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#e5e7eb'
  },
  assetActions: {
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
  primaryBtn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: 8,
    background: '#0a2221',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: '0.2s'
  },
  secondaryBtn: {
    padding: '10px 20px',
    border: '1px solid #374151',
    borderRadius: 8,
    background: 'transparent',
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
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
    maxWidth: 700,
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
  form: {
    padding: 20
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 16,
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
  fieldset: {
    border: '1px solid #374151',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16
  },
  legend: {
    fontSize: 14,
    fontWeight: 600,
    color: '#e5e7eb',
    padding: '0 8px'
  },
  sportCheckboxes: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: 12
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: '#e5e7eb',
    cursor: 'pointer'
  },
  checkbox: {
    width: 16,
    height: 16,
    cursor: 'pointer'
  },
  modalActions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 20
  }
};
