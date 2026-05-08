import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CommunityLeaguesPage.css';

const CommunityLeaguesPage = () => {
  const [communityLeagues, setCommunityLeagues] = useState([]);
  const [userMemberships, setUserMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load community leagues
      const leaguesResponse = await axios.get('/api/community-leagues');
      setCommunityLeagues(leaguesResponse.data.communityLeagues || []);

      // Load user's memberships (if authenticated)
      try {
        const membershipsResponse = await axios.get('/api/community-leagues/my');
        setUserMemberships(membershipsResponse.data.memberships || []);
      } catch (membershipError) {
        // User might not be authenticated, that's ok
        setUserMemberships([]);
      }

    } catch (err) {
      console.error('Error loading community leagues:', err);
      setError('Fehler beim Laden der Community Ligen');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (sportId, cityId, sportName, cityName) => {
    try {
      setJoining(`${sportId}-${cityId}`);
      setError(null);

      const response = await axios.post('/api/community-leagues/join', {
        sportId,
        cityId
      });

      // Reload data to show updated memberships
      await loadData();

      alert(`Erfolgreich der Community Liga ${sportName} - ${cityName} beigetreten!`);

    } catch (err) {
      console.error('Error joining community league:', err);
      if (err.response?.status === 409) {
        setError('Sie sind bereits Mitglied in einer Mini-Liga dieser Community Liga');
      } else {
        setError('Fehler beim Beitritt zur Community Liga');
      }
    } finally {
      setJoining(null);
    }
  };

  const isUserMember = (sportId, cityId) => {
    return userMemberships.some(membership =>
      membership.sport_name === communityLeagues.find(cl => cl.sport_id === sportId && cl.city_id === cityId)?.sport_name &&
      membership.city_name === communityLeagues.find(cl => cl.sport_id === sportId && cl.city_id === cityId)?.city_name
    );
  };

  if (loading) {
    return (
      <div className="community-leagues-page">
        <div className="loading">Lade Community Ligen...</div>
      </div>
    );
  }

  return (
    <div className="community-leagues-page">
      <div className="page-header">
        <h1>Community Ligen</h1>
        <p>
          Treten Sie kostenlosen Community Ligen bei und spielen Sie wöchentlich gegen andere Spieler:innen.
          Jede Liga hat maximal 10 Teilnehmer und bietet faire, automatische Paarungen.
        </p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="community-leagues-grid">
        {communityLeagues.map((league) => (
          <div key={`${league.sport_id}-${league.city_id}`} className="league-card">
            <div className="league-header">
              <h3>{league.sport_name}</h3>
              <span className="city-badge">{league.city_name}</span>
            </div>

            <div className="league-info">
              <div className="info-item">
                <span className="label">Sport:</span>
                <span className="value">{league.sport_name}</span>
              </div>
              <div className="info-item">
                <span className="label">Stadt:</span>
                <span className="value">{league.city_name}</span>
              </div>
              <div className="info-item">
                <span className="label">Saison:</span>
                <span className="value">6 Monate</span>
              </div>
              <div className="info-item">
                <span className="label">Spiele:</span>
                <span className="value">1x pro Woche</span>
              </div>
              <div className="info-item">
                <span className="label">Kosten:</span>
                <span className="value">Kostenlos</span>
              </div>
            </div>

            <div className="league-actions">
              {isUserMember(league.sport_id, league.city_id) ? (
                <div className="member-status">
                  <span className="member-badge">Mitglied</span>
                  <p>Sie sind bereits in einer Mini-Liga dieser Community Liga.</p>
                </div>
              ) : (
                <button
                  className="join-button"
                  onClick={() => handleJoin(league.sport_id, league.city_id, league.sport_name, league.city_name)}
                  disabled={joining === `${league.sport_id}-${league.city_id}`}
                >
                  {joining === `${league.sport_id}-${league.city_id}` ? 'Trete bei...' : 'Beitreten'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {communityLeagues.length === 0 && (
        <div className="no-leagues">
          <p>Derzeit sind keine Community Ligen verfügbar.</p>
        </div>
      )}
    </div>
  );
};

export default CommunityLeaguesPage;