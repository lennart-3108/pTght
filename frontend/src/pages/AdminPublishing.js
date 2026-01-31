import React, { useState, useEffect } from 'react';
import './AdminPublishing.css';

function AdminPublishing() {
  const [cities, setCities] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCities, setExpandedCities] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const res = await fetch('/api/publishing/community-leagues', { headers });
      const data = await res.json();
      
      if (data.success) {
        setCities(data.data.cities);
        setSports(data.data.sports);
      } else {
        setError(data.error || 'Fehler beim Laden');
      }
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error(err);
    }
    setLoading(false);
  };

  const toggleCity = (cityId) => {
    const newExpanded = new Set(expandedCities);
    if (newExpanded.has(cityId)) {
      newExpanded.delete(cityId);
    } else {
      newExpanded.add(cityId);
    }
    setExpandedCities(newExpanded);
  };

  const handleEnableCommunityForCity = async (cityId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/publishing/cities/${cityId}/enable-community`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || 'Fehler beim Aktivieren');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Aktivieren');
    }
  };

  const handleDisableCommunityForCity = async (cityId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/publishing/cities/${cityId}/disable-community`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || 'Fehler beim Deaktivieren');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Deaktivieren');
    }
  };

  const handleEnableCommunityForLocation = async (locationId) => {
    if (!window.confirm('Community Ligen für alle Sportarten für diese Location erstellen?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/publishing/locations/${locationId}/enable-community`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sports: sports.map(s => s.id) })
      });

      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || 'Fehler beim Aktivieren');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Aktivieren');
    }
  };

  const handleDisableCommunityForLocation = async (locationId) => {
    if (!window.confirm('Community Ligen für diese Location deaktivieren?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/publishing/locations/${locationId}/disable-community`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || 'Fehler beim Deaktivieren');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Deaktivieren');
    }
  };

  const handleDeleteLeague = async (leagueId) => {
    if (!window.confirm('Liga wirklich löschen?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/publishing/leagues/${leagueId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || 'Fehler beim Löschen');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Löschen');
    }
  };

  if (loading) return <div className="loading">Lade Community Ligen...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="admin-publishing-container">
      <div className="admin-publishing-header">
        <h1>Community Ligen Management</h1>
        <p className="subtitle">Aktiviere Community Ligen für Locations - automatische Liga-Erstellung für alle Sportarten</p>
      </div>

      <div className="cities-grid">
        {cities.map(city => (
          <div key={city.id} className="city-card">
            <div className="city-header" onClick={() => toggleCity(city.id)}>
              <div className="city-info">
                <h3 className="city-name">
                  {expandedCities.has(city.id) ? '▼' : '▶'} {city.name}
                </h3>
                <span className="city-meta">
                  {city.country} • {city.locations.length} Locations
                </span>
              </div>
              <div className="city-status">
                {city.community_leagues_enabled ? (
                  <span className="status-badge enabled">✓ Community Ligen aktiviert</span>
                ) : (
                  <span className="status-badge disabled">✕ Deaktiviert</span>
                )}
              </div>
            </div>

            {expandedCities.has(city.id) && (
              <div className="locations-list">
                {city.locations.map(location => (
                  <div 
                    key={location.id} 
                    className={`location-item ${location.community_leagues_enabled ? 'enabled' : 'disabled'}`}
                  >
                    <div className="location-info">
                      <h4 className="location-name">{location.name}</h4>
                      <p className="location-address">{location.address}</p>
                      {location.leagues.length > 0 && (
                        <div className="leagues-info">
                          {location.leagues.length} Community Ligen aktiv
                        </div>
                      )}
                    </div>

                    <div className="location-actions">
                      {location.community_leagues_enabled ? (
                        <button
                          className="btn-disable"
                          onClick={() => handleDisableCommunityForLocation(location.id)}
                        >
                          Deaktivieren
                        </button>
                      ) : (
                        <button
                          className="btn-enable"
                          onClick={() => handleEnableCommunityForLocation(location.id)}
                        >
                          Community Ligen aktivieren
                        </button>
                      )}
                    </div>

                    {location.leagues.length > 0 && (
                      <div className="leagues-list">
                        <h5>Aktive Ligen:</h5>
                        {location.leagues.map(league => (
                          <div key={league.id} className="league-item">
                            <span className="league-name">{league.name}</span>
                            <button
                              className="btn-delete-small"
                              onClick={() => handleDeleteLeague(league.id)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="info-box">
        <h3>ℹ️ Wie funktioniert es?</h3>
        <ul>
          <li><strong>Location aktivieren:</strong> Erstellt automatisch Community Ligen für alle {sports.length} veröffentlichten Sportarten</li>
          <li><strong>Teilnahme:</strong> User können den aktivierten Community Ligen beitreten</li>
          <li><strong>Engine:</strong> Die Community League Engine läuft automatisch für aktivierte Locations</li>
          <li><strong>Deaktivieren:</strong> Verbirgt die Ligen, löscht sie aber nicht</li>
        </ul>
      </div>
    </div>
  );
}

export default AdminPublishing;
