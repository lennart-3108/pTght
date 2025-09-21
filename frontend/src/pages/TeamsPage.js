import React, { useState, useEffect } from 'react';
// ...existing code... (TeamForm removed from this page; creation is done via /teams/create)
import { Link } from 'react-router-dom';

// helper: small select component
function SmallSelect({ label, value, onChange, children }) {
  return (
    <label style={{ marginRight: 12 }}>{label} <select value={value || ''} onChange={e => onChange && onChange(e.target.value)}>{children}</select></label>
  );
}

function TeamsPage() {
  const API_BASE = (process.env.REACT_APP_API_BASE || 'http://localhost:5001');
  const [teams, setTeams] = useState([]);
  const [sportFilter, setSportFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sports, setSports] = useState([]);
  const [cities, setCities] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [leagueFilter, setLeagueFilter] = useState('');

  useEffect(() => {
    // load selectable filters
    fetch(API_BASE + '/sports/list').then(r => r.ok ? r.json() : []).then(s => setSports(Array.isArray(s) ? s : [])).catch(() => setSports([]));
    fetch(API_BASE + '/cities/list').then(r => r.ok ? r.json() : []).then(c => setCities(Array.isArray(c) ? c : [])).catch(() => setCities([]));
    // leagues endpoint returns array of leagues
    fetch(API_BASE + '/leagues').then(r => r.ok ? r.json() : []).then(l => setLeagues(Array.isArray(l) ? l : [])).catch(() => setLeagues([]));
    loadTeams();
  }, []);

  const loadTeams = (opts = {}) => {
  const qs = [];
  if (opts.sport_id || sportFilter) qs.push('sport_id=' + encodeURIComponent(opts.sport_id || sportFilter));
  if (opts.city_id || cityFilter) qs.push('city_id=' + encodeURIComponent(opts.city_id || cityFilter));
  if (opts.league_id || leagueFilter) qs.push('league_id=' + encodeURIComponent(opts.league_id || leagueFilter));
  const url = API_BASE + '/teams' + (qs.length ? ('?' + qs.join('&')) : '');
  fetch(url).then(r => r.ok ? r.json() : []).then(data => {
      // backend returns either an array or { teams: [...] }
      if (Array.isArray(data)) return setTeams(data);
      if (data && Array.isArray(data.teams)) return setTeams(data.teams);
      return setTeams([]);
    }).catch(() => setTeams([]));
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Teams</h2>
      <div style={{ maxWidth: 960 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Teams</h3>
          <Link to="/teams/create"><button>Create team</button></Link>
        </div>

        <div style={{ marginTop: 12 }}>
          <SmallSelect label="Sport:" value={sportFilter} onChange={v => { setSportFilter(v); loadTeams({ sport_id: v }); }}>
            <option value="">— all —</option>
            {sports.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
          </SmallSelect>
          <SmallSelect label="League:" value={leagueFilter} onChange={v => { setLeagueFilter(v); loadTeams({ league_id: v }); }}>
            <option value="">— all —</option>
            {leagues.map(l => <option key={l.id} value={l.id}>{l.name || l.id}</option>)}
          </SmallSelect>
          <SmallSelect label="City:" value={cityFilter} onChange={v => { setCityFilter(v); loadTeams({ city_id: v }); }}>
            <option value="">— all —</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
          </SmallSelect>
        </div>

        {/* Creation handled on a separate page - keep this view focused on filters + list */}

        <div style={{ marginTop: 24 }}>
          <h3>Teams</h3>
          {teams.length === 0 && <div>No teams found</div>}
          <ul>
            {teams.map(t => (
              <li key={t.id}><Link to={`/teams/${t.id}`}>{t.name}</Link> — members: {t.memberCount}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TeamsPage;
