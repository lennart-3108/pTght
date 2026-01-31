import React, { useState, useEffect } from 'react';
import './AdminPublishingNew.css';

function AdminPublishingNew() {
  const [hierarchy, setHierarchy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [selectedCountry, setSelectedCountry] = useState('');
  
  // UI state
  const [expandedCountries, setExpandedCountries] = useState(new Set());
  const [expandedCities, setExpandedCities] = useState(new Set());

  useEffect(() => {
    loadHierarchy();
  }, [selectedCountry]);

  const loadHierarchy = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (selectedCountry) params.append('country_id', selectedCountry);

      const res = await fetch(`/api/locations-hierarchy?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (data.success) {
        setHierarchy(data.data);
      } else {
        setError(data.error || 'Fehler beim Laden');
      }
    } catch (err) {
      setError('Fehler beim Laden der Hierarchie');
      console.error(err);
    }
    setLoading(false);
  };

  const toggleCountry = (countryId) => {
    const newExpanded = new Set(expandedCountries);
    if (newExpanded.has(countryId)) {
      newExpanded.delete(countryId);
    } else {
      newExpanded.add(countryId);
    }
    setExpandedCountries(newExpanded);
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

  const handleEnableCity = async (cityId, cityName) => {
    if (!window.confirm(`Community Ligen für "${cityName}" aktivieren?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/locations-hierarchy/${cityId}/enable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        alert('✓ ' + data.message);
        loadHierarchy();
      } else {
        alert(data.error || 'Fehler beim Aktivieren');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Aktivieren');
    }
  };

  const handleDisableCity = async (cityId, cityName) => {
    if (!window.confirm(`Community Ligen für "${cityName}" deaktivieren?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/locations-hierarchy/${cityId}/disable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        alert('✓ ' + data.message);
        loadHierarchy();
      } else {
        alert(data.error || 'Fehler beim Deaktivieren');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Deaktivieren');
    }
  };

  const countries = hierarchy.map(h => ({ id: h.id, name: h.name }));

  if (loading) return <div className="aph-loading">Lade Location-Hierarchie...</div>;
  if (error) return <div className="aph-error">{error}</div>;

  return (
    <div className="aph-container">
      <div className="aph-header">
        <h1>Community Ligen Verwaltung</h1>
        <p className="aph-subtitle">
          Erstelle und verwalte Community Ligen für Städte und Distrikte
        </p>
      </div>

      <div className="aph-filters">
        <div className="aph-filter-group">
          <label htmlFor="country-filter">Land:</label>
          <select
            id="country-filter"
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
          >
            <option value="">Alle Länder</option>
            {countries.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button className="aph-btn-refresh" onClick={() => loadHierarchy()}>
          🔄 Aktualisieren
        </button>
      </div>

      <div className="aph-hierarchy">
        {hierarchy.map(country => (
          <div key={country.id} className="aph-country">
            <div 
              className="aph-country-header"
              onClick={() => toggleCountry(country.id)}
            >
              <span className="aph-expand-icon">
                {expandedCountries.has(country.id) ? '▼' : '▶'}
              </span>
              <span className="aph-country-name">
                🌍 {country.name} ({country.code})
              </span>
              <span className="aph-count">
                {country.cities.length} Städte
              </span>
            </div>

            {expandedCountries.has(country.id) && (
              <div className="aph-country-content">
                {country.cities.map(city => (
                  <div key={city.id} className="aph-city">
                    <div 
                      className="aph-city-header"
                      onClick={() => toggleCity(city.id)}
                    >
                      <span className="aph-expand-icon">
                        {expandedCities.has(city.id) ? '▼' : '▶'}
                      </span>
                      <span className="aph-city-name">
                        🏙️ {city.name}
                      </span>
                      <span className="aph-count">
                        {city.locations.length} Locations, {city.community_leagues_count} Ligen
                      </span>
                      <button
                        className={`aph-btn-toggle ${city.leagues_enabled ? 'enabled' : 'disabled'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          city.leagues_enabled
                            ? handleDisableCity(city.id, city.name)
                            : handleEnableCity(city.id, city.name);
                        }}
                      >
                        {city.leagues_enabled ? '✓ Aktiviert' : 'Freischalten'}
                      </button>
                    </div>

                    {expandedCities.has(city.id) && (
                      <div className="aph-city-content">
                        {city.districts.length > 0 && (
                          <div className="aph-districts">
                            <h4>Distrikte:</h4>
                            {city.districts.map(district => (
                              <div key={district.id} className="aph-district">
                                <span>📌 {district.name}</span>
                                <button
                                  className={`aph-btn-toggle-small ${district.leagues_enabled ? 'enabled' : 'disabled'}`}
                                  onClick={() => 
                                    district.leagues_enabled
                                      ? handleDisableCity(district.id, district.name)
                                      : handleEnableCity(district.id, district.name)
                                  }
                                >
                                  {district.leagues_enabled ? '✓' : 'Freischalten'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {city.locations.length > 0 && (
                          <div className="aph-locations">
                            <h4>Locations:</h4>
                            {city.locations.map(location => (
                              <div key={location.id} className="aph-location">
                                <span className="aph-location-name">{location.name}</span>
                                <span className="aph-location-address">{location.address}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="aph-info">
        <h3>ℹ️ Community Ligen Management</h3>
        <ul>
          <li><strong>Stadt aktivieren:</strong> Erstellt Community Ligen für alle veröffentlichten Sportarten</li>
          <li><strong>Distrikt aktivieren:</strong> Aktiviert Community Ligen für einen bestimmten Stadtteil</li>
          <li><strong>Automatische Erstellung:</strong> Für alle Locations werden Ligen erstellt</li>
          <li><strong>Deaktivieren:</strong> Verbirgt die Ligen, löscht sie aber nicht</li>
        </ul>
      </div>
    </div>
  );
}

export default AdminPublishingNew;
