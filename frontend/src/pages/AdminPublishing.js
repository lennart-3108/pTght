import React, { useState, useEffect } from 'react';
import './AdminPublishing.css';

function AdminPublishing() {
  const [activeTab, setActiveTab] = useState('sports');
  const [sports, setSports] = useState({});
  const [locations, setLocations] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (activeTab === 'sports') {
        const res = await fetch('/api/publishing/sports', { headers });
        const data = await res.json();
        if (data.success) setSports(data.data);
      } else if (activeTab === 'locations') {
        const res = await fetch('/api/publishing/locations', { headers });
        const data = await res.json();
        if (data.success) setLocations(data.data);
      } else if (activeTab === 'leagues') {
        const res = await fetch('/api/publishing/leagues', { headers });
        const data = await res.json();
        if (data.success) setLeagues(data.data);
      }
    } catch (err) {
      setError('Fehler beim Laden der Daten');
      console.error(err);
    }
    setLoading(false);
  };

  const handlePublish = async (type, id, isHierarchy = false) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = isHierarchy
        ? `/api/publishing/${type}/${id}/publish-hierarchy`
        : `/api/publishing/${type}/${id}/publish`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || 'Fehler beim Veröffentlichen');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Veröffentlichen');
    }
  };

  const handleUnpublish = async (type, id, isHierarchy = false) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = isHierarchy
        ? `/api/publishing/${type}/${id}/unpublish-hierarchy`
        : `/api/publishing/${type}/${id}/unpublish`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || 'Fehler beim Verbergen');
      }
    } catch (err) {
      console.error(err);
      alert('Fehler beim Verbergen');
    }
  };

  const handleDeleteLeague = async (id) => {
    if (!window.confirm('Liga wirklich löschen? Dies kann nicht rückgängig gemacht werden!')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/publishing/leagues/${id}`, {
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

  const renderSportsTab = () => {
    if (loading) return <div className="loading">Lade Sportarten...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
      <div className="sports-grid">
        {Object.entries(sports).map(([category, data]) => (
          <div key={category} className="category-section">
            <h3 className="category-title">{category}</h3>

            {/* Parent Sports */}
            {data.parents.map(sport => {
              const childCount = data.children.filter(c => c.parent_id === sport.id).length;
              return (
                <div key={sport.id} className={`sport-card ${sport.published ? 'published' : 'unpublished'}`}>
                  <div className="sport-info">
                    <span className="sport-name">{sport.name}</span>
                    <span className="sport-meta">
                      {sport.result_type_name}
                      {childCount > 0 && <span className="child-count"> • {childCount} Disziplinen</span>}
                    </span>
                  </div>

                  <div className="sport-actions">
                    {sport.published ? (
                      <>
                        <button
                          className="btn-unpublish"
                          onClick={() => handleUnpublish('sports', sport.id)}
                        >
                          Verbergen
                        </button>
                        {childCount > 0 && (
                          <button
                            className="btn-unpublish-hierarchy"
                            onClick={() => handleUnpublish('sports', sport.id, true)}
                          >
                            + Disziplinen
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-publish"
                          onClick={() => handlePublish('sports', sport.id)}
                        >
                          Veröffentlichen
                        </button>
                        {childCount > 0 && (
                          <button
                            className="btn-publish-hierarchy"
                            onClick={() => handlePublish('sports', sport.id, true)}
                          >
                            + Disziplinen
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Child Sports (Disciplines) */}
                  {childCount > 0 && (
                    <div className="disciplines">
                      {data.children
                        .filter(c => c.parent_id === sport.id)
                        .map(discipline => (
                          <div
                            key={discipline.id}
                            className={`discipline-card ${discipline.published ? 'published' : 'unpublished'}`}
                          >
                            <span className="discipline-name">↳ {discipline.name}</span>
                            {discipline.published ? (
                              <button
                                className="btn-unpublish-small"
                                onClick={() => handleUnpublish('sports', discipline.id)}
                              >
                                ✕
                              </button>
                            ) : (
                              <button
                                className="btn-publish-small"
                                onClick={() => handlePublish('sports', discipline.id)}
                              >
                                ✓
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderLocationsTab = () => {
    if (loading) return <div className="loading">Lade Locations...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
      <div className="locations-grid">
        {locations.map(location => (
          <div key={location.id} className={`location-card ${location.published ? 'published' : 'unpublished'}`}>
            <div className="location-info">
              <span className="location-name">{location.name}</span>
              {location.children.length > 0 && (
                <span className="child-count">{location.children.length} Unterlocations</span>
              )}
            </div>

            <div className="location-actions">
              {location.published ? (
                <>
                  <button
                    className="btn-unpublish"
                    onClick={() => handleUnpublish('locations', location.id)}
                  >
                    Verbergen
                  </button>
                  {location.children.length > 0 && (
                    <button
                      className="btn-unpublish-hierarchy"
                      onClick={() => handleUnpublish('locations', location.id, true)}
                    >
                      + Hierarchie
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    className="btn-publish"
                    onClick={() => handlePublish('locations', location.id)}
                  >
                    Veröffentlichen
                  </button>
                  {location.children.length > 0 && (
                    <button
                      className="btn-publish-hierarchy"
                      onClick={() => handlePublish('locations', location.id, true)}
                    >
                      + Hierarchie
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Child Locations */}
            {location.children.length > 0 && (
              <div className="sublocations">
                {location.children.map(child => (
                  <div
                    key={child.id}
                    className={`sublocation-card ${child.published ? 'published' : 'unpublished'}`}
                  >
                    <span className="sublocation-name">↳ {child.name}</span>
                    {child.published ? (
                      <button
                        className="btn-unpublish-small"
                        onClick={() => handleUnpublish('locations', child.id)}
                      >
                        ✕
                      </button>
                    ) : (
                      <button
                        className="btn-publish-small"
                        onClick={() => handlePublish('locations', child.id)}
                      >
                        ✓
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderLeaguesTab = () => {
    if (loading) return <div className="loading">Lade Community Ligen...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
      <div className="leagues-grid">
        {leagues.map(league => (
          <div key={league.id} className={`league-card ${league.published ? 'published' : 'unpublished'}`}>
            <div className="league-header">
              <h4 className="league-name">{league.name}</h4>
              <div className="league-meta">
                <span>🏆 {league.sport_name}</span>
                <span>📍 {league.location_name}</span>
                <span>👤 {league.creator_name || league.creator_email}</span>
              </div>
            </div>

            <div className="league-actions">
              {league.published ? (
                <button
                  className="btn-unpublish"
                  onClick={() => handleUnpublish('leagues', league.id)}
                >
                  Verbergen
                </button>
              ) : (
                <button
                  className="btn-publish"
                  onClick={() => handlePublish('leagues', league.id)}
                >
                  Veröffentlichen
                </button>
              )}
              <button
                className="btn-delete"
                onClick={() => handleDeleteLeague(league.id)}
              >
                Löschen
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="admin-publishing-container">
      <div className="admin-publishing-header">
        <h1>Inhalte Veröffentlichen</h1>
        <p className="subtitle">Manuelle Prüfung und Freigabe von Sportarten, Locations und Community-Ligen</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'sports' ? 'active' : ''}`}
          onClick={() => setActiveTab('sports')}
        >
          🎾 Sportarten
        </button>
        <button
          className={`tab ${activeTab === 'locations' ? 'active' : ''}`}
          onClick={() => setActiveTab('locations')}
        >
          📍 Locations
        </button>
        <button
          className={`tab ${activeTab === 'leagues' ? 'active' : ''}`}
          onClick={() => setActiveTab('leagues')}
        >
          🏆 Community Ligen
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'sports' && renderSportsTab()}
        {activeTab === 'locations' && renderLocationsTab()}
        {activeTab === 'leagues' && renderLeaguesTab()}
      </div>
    </div>
  );
}

export default AdminPublishing;
