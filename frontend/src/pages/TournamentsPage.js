import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import TournamentConfigurator from '../components/TournamentConfigurator';
import { CompetitionsFeature } from '../components/FeatureWrapper';

export default function TournamentsPage() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [filters, setFilters] = useState({
    sport_id: '',
    city_id: '',
    status: '',
    tournament_mode: ''
  });

  useEffect(() => {
    loadTournaments();
  }, [filters]);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.sport_id) params.set('sport_id', filters.sport_id);
      if (filters.city_id) params.set('city_id', filters.city_id);
      if (filters.status) params.set('status', filters.status);
      if (filters.tournament_mode) params.set('tournament_mode', filters.tournament_mode);

      const res = await fetch(`${API_BASE}/tournaments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTournaments(data.data || []);
      }
    } catch (err) {
      console.error('Error loading tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTournamentCreated = (tournament) => {
    setShowConfigurator(false);
    loadTournaments();
    navigate(`/tournaments/${tournament.id}`);
  };

  const getModeIcon = (mode) => {
    const icons = {
      knockout: '🏆',
      round_robin: '🔄',
      groups_knockout: '⚽',
      swiss: '🇨🇭'
    };
    return icons[mode] || '🎯';
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#888',
      registration: '#4a9eff',
      in_progress: '#debc7c',
      completed: '#4caf50',
      cancelled: '#f44336'
    };
    return colors[status] || '#888';
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Entwurf',
      registration: 'Anmeldung offen',
      in_progress: 'Läuft',
      completed: 'Abgeschlossen',
      cancelled: 'Abgesagt'
    };
    return labels[status] || status;
  };

  return (
    <CompetitionsFeature>
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #081c19 0%, #102820 100%)',
      padding: '80px 20px 40px'
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 32
        }}>
          <div>
            <h1 style={{ 
              color: '#debc7c', 
              fontSize: 36,
              fontWeight: 700,
              marginBottom: 8
            }}>
              Turniere
            </h1>
            <p style={{ color: '#aaa', fontSize: 16 }}>
              Finde Turniere oder erstelle dein eigenes
            </p>
          </div>

          <button
            onClick={() => setShowConfigurator(!showConfigurator)}
            style={{
              padding: '12px 24px',
              background: showConfigurator ? 'transparent' : '#debc7c',
              color: showConfigurator ? '#debc7c' : '#102820',
              border: showConfigurator ? '1px solid #debc7c' : 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {showConfigurator ? '✕ Abbrechen' : '+ Turnier erstellen'}
          </button>
        </div>

        {/* Configurator */}
        {showConfigurator && (
          <div style={{ marginBottom: 32 }}>
            <TournamentConfigurator onCreated={handleTournamentCreated} />
          </div>
        )}

        {/* Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
          padding: 20,
          background: 'rgba(8, 28, 25, 0.8)',
          borderRadius: 12,
          border: '1px solid #debc7c22'
        }}>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            style={{
              padding: 10,
              background: '#102820',
              border: '1px solid #debc7c44',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14
            }}
          >
            <option value="">Alle Status</option>
            <option value="registration">Anmeldung offen</option>
            <option value="in_progress">Läuft</option>
            <option value="completed">Abgeschlossen</option>
          </select>

          <select
            value={filters.tournament_mode}
            onChange={(e) => setFilters(prev => ({ ...prev, tournament_mode: e.target.value }))}
            style={{
              padding: 10,
              background: '#102820',
              border: '1px solid #debc7c44',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14
            }}
          >
            <option value="">Alle Modi</option>
            <option value="knockout">K.O.-System</option>
            <option value="round_robin">Jeder gegen Jeden</option>
            <option value="groups_knockout">Gruppen + K.O.</option>
            <option value="swiss">Schweizer System</option>
          </select>
        </div>

        {/* Tournaments List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
            Lade Turniere...
          </div>
        ) : tournaments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
            Keine Turniere gefunden
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20
          }}>
            {tournaments.map(tournament => (
              <div
                key={tournament.id}
                onClick={() => navigate(`/tournaments/${tournament.id}`)}
                style={{
                  padding: 24,
                  background: 'rgba(8, 28, 25, 0.95)',
                  border: '1px solid #debc7c33',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  ':hover': {
                    transform: 'translateY(-4px)',
                    border: '1px solid #debc7c'
                  }
                }}
              >
                {/* Status Badge */}
                <div style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  background: getStatusColor(tournament.status) + '22',
                  color: getStatusColor(tournament.status),
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 12
                }}>
                  {getStatusLabel(tournament.status)}
                </div>

                {/* Tournament Name */}
                <h3 style={{
                  color: '#debc7c',
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 8
                }}>
                  {tournament.name}
                </h3>

                {/* Sport & Mode */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12
                }}>
                  <span style={{ fontSize: 24 }}>
                    {getModeIcon(tournament.tournament_mode)}
                  </span>
                  <div>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                      {tournament.sport_name}
                    </div>
                    <div style={{ color: '#888', fontSize: 12 }}>
                      {tournament.tournament_mode === 'knockout' && 'K.O.-System'}
                      {tournament.tournament_mode === 'round_robin' && 'Jeder gegen Jeden'}
                      {tournament.tournament_mode === 'groups_knockout' && 'Gruppen + K.O.'}
                      {tournament.tournament_mode === 'swiss' && 'Schweizer System'}
                    </div>
                  </div>
                </div>

                {/* Location & Date */}
                <div style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>
                  📍 {tournament.city_name || 'Standort wird bekannt gegeben'}
                </div>
                <div style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>
                  📅 {tournament.start_date ? new Date(tournament.start_date).toLocaleDateString('de-DE') : 'Datum wird bekannt gegeben'}
                </div>

                {/* Participants */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 12,
                  borderTop: '1px solid #debc7c22'
                }}>
                  <div style={{ color: '#debc7c', fontSize: 14, fontWeight: 600 }}>
                    {tournament.participant_count || 0} / {tournament.max_participants || '∞'} Teilnehmer
                  </div>
                  <div style={{
                    color: '#debc7c',
                    fontSize: 13,
                    fontWeight: 600
                  }}>
                    Details →
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </CompetitionsFeature>
  );
}
