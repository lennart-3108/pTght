import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import TournamentConfigurator from '../components/TournamentConfigurator';
import { CompetitionsFeature } from '../components/FeatureWrapper';

const DEFAULT_LIMIT = 200;

const TYPE_OPTIONS = [
  { value: '', label: 'Alle Typen' },
  { value: 'community_league', label: 'Community League' },
  { value: 'league', label: 'League' },
  { value: 'tournament', label: 'Tournament' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Alle Status' },
  { value: 'active', label: 'Aktiv' },
  { value: 'registration', label: 'Anmeldung offen' },
  { value: 'in_progress', label: 'Läuft' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'draft', label: 'Entwurf' },
  { value: 'cancelled', label: 'Abgesagt' },
];

const MODE_OPTIONS = [
  { value: '', label: 'Alle Modi' },
  { value: 'knockout', label: 'K.O.-System' },
  { value: 'round_robin', label: 'Jeder gegen Jeden' },
  { value: 'groups_knockout', label: 'Gruppen + K.O.' },
  { value: 'swiss', label: 'Schweizer System' },
];

export default function TournamentsPage() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [sports, setSports] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    sport_id: '',
    city_id: '',
    status: '',
    tournament_mode: '',
    search: ''
  });

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadCompetitions = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');

      const tournamentParams = new URLSearchParams();
      tournamentParams.set('limit', String(DEFAULT_LIMIT));
      tournamentParams.set('offset', '0');
      if (filters.sport_id) tournamentParams.set('sport_id', filters.sport_id);
      if (filters.city_id) tournamentParams.set('city_id', filters.city_id);
      if (filters.status) tournamentParams.set('status', filters.status);
      if (filters.tournament_mode) tournamentParams.set('tournament_mode', filters.tournament_mode);

      const leagueParams = new URLSearchParams();
      leagueParams.set('limit', String(DEFAULT_LIMIT));
      leagueParams.set('offset', '0');
      if (filters.sport_id) leagueParams.set('sportId', filters.sport_id);
      if (filters.city_id) leagueParams.set('cityId', filters.city_id);
      if (filters.search?.trim()) leagueParams.set('search', filters.search.trim());

      const [tournamentRes, leaguesRes] = await Promise.all([
        fetch(`${API_BASE}/tournaments?${tournamentParams.toString()}`),
        fetch(`${API_BASE}/leagues?${leagueParams.toString()}`),
      ]);

      let tournamentRows = [];
      let leagueRows = [];

      if (tournamentRes.ok) {
        const tournamentsJson = await tournamentRes.json().catch(() => ({}));
        tournamentRows = Array.isArray(tournamentsJson?.data) ? tournamentsJson.data : [];
      }

      if (leaguesRes.ok) {
        const leaguesJson = await leaguesRes.json().catch(() => ({}));
        leagueRows = Array.isArray(leaguesJson?.data) ? leaguesJson.data : [];
      }

      setTournaments(tournamentRows);
      setLeagues(leagueRows);
    } catch (err) {
      console.error('Error loading competitions:', err);
      setLoadError('Competitions konnten nicht geladen werden.');
      setTournaments([]);
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadCompetitions();
  }, [loadCompetitions]);

  const loadFilterOptions = async () => {
    try {
      setLoadingFilters(true);
      const [sportsRes, citiesRes] = await Promise.all([
        fetch(`${API_BASE}/sports/list`),
        fetch(`${API_BASE}/cities/list`),
      ]);

      if (sportsRes.ok) {
        const sportsJson = await sportsRes.json().catch(() => []);
        setSports(Array.isArray(sportsJson) ? sportsJson : []);
      } else {
        setSports([]);
      }

      if (citiesRes.ok) {
        const citiesJson = await citiesRes.json().catch(() => []);
        setCities(Array.isArray(citiesJson) ? citiesJson : []);
      } else {
        setCities([]);
      }
    } catch (err) {
      console.error('Error loading competition filters:', err);
      setSports([]);
      setCities([]);
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleTournamentCreated = (tournament) => {
    setShowConfigurator(false);
    loadCompetitions();
    navigate(`/tournaments/${tournament.id}`);
  };

  const classifyLeagueType = (league) => {
    const level = String(league?.level || '').toLowerCase();
    const publicState = String(league?.publicState || '').toLowerCase();
    const isCommunityFlag = Number(league?.is_community || 0) === 1;
    const name = String(league?.name || '').toLowerCase();

    if (level === 'community' || publicState === 'community' || isCommunityFlag || name.includes('community league')) {
      return 'community_league';
    }
    return 'league';
  };

  const typeLabel = (type) => {
    if (type === 'community_league') return 'Community League';
    if (type === 'league') return 'League';
    if (type === 'tournament') return 'Tournament';
    return 'Competition';
  };

  const typeColor = (type) => {
    if (type === 'community_league') return { bg: '#debc7c', text: '#102820' };
    if (type === 'league') return { bg: 'rgba(127, 188, 164, 0.22)', text: '#9ddfc4' };
    if (type === 'tournament') return { bg: 'rgba(72, 186, 170, 0.2)', text: '#48baaa' };
    return { bg: 'rgba(255,255,255,0.12)', text: '#d5dbe0' };
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
      active: '#48baaa',
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
      active: 'Aktiv',
      draft: 'Entwurf',
      registration: 'Anmeldung offen',
      in_progress: 'Läuft',
      completed: 'Abgeschlossen',
      cancelled: 'Abgesagt'
    };
    return labels[status] || status;
  };

  const mergedCompetitions = useMemo(() => {
    const leagueItems = leagues.map((league) => ({
      key: `league-${league.id}`,
      id: league.id,
      type: classifyLeagueType(league),
      name: league.name,
      sport_name: league.sport,
      sport_id: league.sportId,
      city_name: league.city,
      city_id: league.cityId,
      status: league.status || 'active',
      route: `/league/${league.id}`,
      organizer_name: null,
      tournament_mode: null,
      participant_count: null,
      max_participants: null,
      start_date: null,
    }));

    const tournamentItems = tournaments.map((tournament) => ({
      key: `tournament-${tournament.id}`,
      id: tournament.id,
      type: 'tournament',
      name: tournament.name,
      sport_name: tournament.sport_name,
      sport_id: tournament.sport_id,
      city_name: tournament.city_name,
      city_id: tournament.city_id,
      status: tournament.status,
      route: `/tournaments/${tournament.id}`,
      organizer_name: tournament.organizer_name,
      tournament_mode: tournament.tournament_mode,
      participant_count: tournament.participant_count,
      max_participants: tournament.max_participants,
      start_date: tournament.start_date,
    }));

    let list = [...leagueItems, ...tournamentItems];

    if (filters.type) {
      list = list.filter((row) => row.type === filters.type);
    }

    if (filters.status) {
      list = list.filter((row) => String(row.status || '').toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.tournament_mode) {
      list = list.filter((row) => row.type === 'tournament' && row.tournament_mode === filters.tournament_mode);
    }

    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter((row) => {
        return String(row.name || '').toLowerCase().includes(q)
          || String(row.sport_name || '').toLowerCase().includes(q)
          || String(row.city_name || '').toLowerCase().includes(q)
          || String(row.organizer_name || '').toLowerCase().includes(q)
          || String(typeLabel(row.type)).toLowerCase().includes(q);
      });
    }

    return list.sort((a, b) => {
      const aTs = a.start_date ? new Date(a.start_date).getTime() : 0;
      const bTs = b.start_date ? new Date(b.start_date).getTime() : 0;
      if (aTs !== bTs) return bTs - aTs;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [leagues, tournaments, filters]);

  const communityCount = mergedCompetitions.filter((row) => row.type === 'community_league').length;
  const leagueCount = mergedCompetitions.filter((row) => row.type === 'league').length;
  const tournamentCount = mergedCompetitions.filter((row) => row.type === 'tournament').length;

  return (
    <CompetitionsFeature>
    <div className="ml-page-shell" style={{ padding: '80px 20px 40px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 32
        }}>
          <div>
            <h1 className="ml-title-gold" style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>
              Competitions
            </h1>
            <p style={{ color: '#aaa', fontSize: 16 }}>
              Alle Competitions in einer Liste – inkl. Community Leagues
            </p>
          </div>

          <button
            onClick={() => setShowConfigurator(!showConfigurator)}
            className={showConfigurator ? 'ml-btn-ghost-gold' : 'ml-btn-gold'}
            style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {showConfigurator ? '✕ Abbrechen' : '+ Competition erstellen'}
          </button>
        </div>

        {/* Configurator */}
        {showConfigurator && (
          <div style={{ marginBottom: 32 }}>
            <TournamentConfigurator onCreated={handleTournamentCreated} />
          </div>
        )}

        {/* Filters */}
        <div className="ml-panel" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 16,
          marginBottom: 32,
          padding: 20
        }}>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            placeholder="Suchen: Name, Ort, Sport, Creator"
            className="ml-input"
            style={{
              gridColumn: 'span 2',
              minHeight: 42
            }}
          />

          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            className="ml-select"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filters.sport_id}
            onChange={(e) => setFilters(prev => ({ ...prev, sport_id: e.target.value }))}
            className="ml-select"
            disabled={loadingFilters}
          >
            <option value="">Alle Sportarten</option>
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>{sport.name}</option>
            ))}
          </select>

          <select
            value={filters.city_id}
            onChange={(e) => setFilters(prev => ({ ...prev, city_id: e.target.value }))}
            className="ml-select"
            disabled={loadingFilters}
          >
            <option value="">Alle Orte</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="ml-select"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filters.tournament_mode}
            onChange={(e) => setFilters(prev => ({ ...prev, tournament_mode: e.target.value }))}
            className="ml-select"
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: 20
        }}>
          <div className="ml-kpi-card">
            <div style={{ color: '#9ab', fontSize: 12 }}>Gesamt</div>
            <div style={{ color: '#debc7c', fontSize: 24, fontWeight: 700 }}>{mergedCompetitions.length}</div>
          </div>
          <div className="ml-kpi-card">
            <div style={{ color: '#9ab', fontSize: 12 }}>Community Leagues</div>
            <div style={{ color: '#debc7c', fontSize: 24, fontWeight: 700 }}>{communityCount}</div>
          </div>
          <div className="ml-kpi-card">
            <div style={{ color: '#9ab', fontSize: 12 }}>Leagues</div>
            <div style={{ color: '#debc7c', fontSize: 24, fontWeight: 700 }}>{leagueCount}</div>
          </div>
          <div className="ml-kpi-card">
            <div style={{ color: '#9ab', fontSize: 12 }}>Tournaments</div>
            <div style={{ color: '#debc7c', fontSize: 24, fontWeight: 700 }}>{tournamentCount}</div>
          </div>
        </div>

        {loadError && (
          <div style={{
            marginBottom: 16,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid rgba(244,67,54,0.45)',
            background: 'rgba(244,67,54,0.12)',
            color: '#ff9b9b'
          }}>
            {loadError}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
            Lade Competitions...
          </div>
        ) : mergedCompetitions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#aaa', background: 'rgba(8,28,25,0.65)', border: '1px solid #debc7c22', borderRadius: 12 }}>
            Keine Competitions gefunden
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20
          }}>
            {mergedCompetitions.map((item) => {
              const tColor = typeColor(item.type);
              return (
                <div
                  key={item.key}
                  onClick={() => navigate(item.route)}
                  className="ml-panel"
                  style={{
                    padding: 22,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      background: tColor.bg,
                      color: tColor.text
                    }}>
                      {typeLabel(item.type)}
                    </div>
                    {item.status && (
                      <div style={{
                        fontSize: 11,
                        color: getStatusColor(item.status),
                        background: `${getStatusColor(item.status)}22`,
                        borderRadius: 10,
                        padding: '3px 8px'
                      }}>
                        {getStatusLabel(item.status)}
                      </div>
                    )}
                  </div>

                  <h3 style={{
                    color: '#debc7c',
                    fontSize: 20,
                    fontWeight: 700,
                    marginBottom: 8,
                    marginTop: 0
                  }}>
                    {item.name}
                  </h3>

                  <div style={{ color: '#d9e1de', fontSize: 13, marginBottom: 4 }}>
                    🏅 {item.sport_name || 'Sportart unbekannt'}
                  </div>
                  <div style={{ color: '#9ab', fontSize: 13, marginBottom: 4 }}>
                    📍 {item.city_name || 'Ort unbekannt'}
                  </div>

                  {item.type === 'tournament' && (
                    <>
                      <div style={{ color: '#9ab', fontSize: 13, marginBottom: 4 }}>
                        👤 {item.organizer_name || 'Competition Creator'}
                      </div>
                      <div style={{ color: '#9ab', fontSize: 13, marginBottom: 4 }}>
                        {getModeIcon(item.tournament_mode)} {MODE_OPTIONS.find((m) => m.value === item.tournament_mode)?.label || 'Modus'}
                      </div>
                      <div style={{ color: '#9ab', fontSize: 13, marginBottom: 8 }}>
                        📅 {item.start_date ? new Date(item.start_date).toLocaleDateString('de-DE') : 'Datum offen'}
                      </div>
                    </>
                  )}

                  <div style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid #debc7c22',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ color: '#debc7c', fontSize: 13, fontWeight: 600 }}>
                      {item.type === 'tournament'
                        ? `${item.participant_count || 0} / ${item.max_participants || '∞'} Teilnehmer`
                        : 'Liga-Details'}
                    </div>
                    <div style={{ color: '#debc7c', fontSize: 13, fontWeight: 600 }}>
                      Öffnen →
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </CompetitionsFeature>
  );
}
