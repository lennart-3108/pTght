import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function TeamDetailPage() {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [rosters, setRosters] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedPlayers, setSelectedPlayers] = useState({}); // user_id -> role
  const [currentUser, setCurrentUser] = useState(null);
  const [sportInfo, setSportInfo] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetch(`/teams/${id}`).then(r => r.json()).catch(() => null),
      fetch(`/teams/${id}/rosters`).then(r => r.json()).catch(() => []),
      // also try to fetch upcoming matches for the team's league (if available)
      fetch(`/leagues/${(team && team.team && team.team.league_id) || ''}/games`).then(r => r.json()).catch(() => [])
    ]).then(([t, rs]) => {
      setTeam(t && t.team ? t.team : (t || null));
      setRosters(Array.isArray(rs) ? rs : []);
      // matches will be filled by a second fetch once team is set
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // fetch current user to enable promote/demote UI and quick permission checks
  useEffect(() => {
    fetch('/me').then(r => r.ok ? r.json() : null).then(u => setCurrentUser(u && u.user ? u.user : null)).catch(() => setCurrentUser(null));
  }, []);

  // When team is loaded, fetch matches for its league
  useEffect(() => {
    if (!team || !team.league_id) return;
    fetch(`/leagues/${team.league_id}/games`).then(r => r.json()).then(data => {
      // assume the API returns an array of games
      setMatches(Array.isArray(data) ? data : []);
    }).catch(() => setMatches([]));
    // fetch sport info if available
    if (team && team.sport_id) {
      fetch(`/sports/${team.sport_id}`).then(r => r.ok ? r.json() : null).then(s => setSportInfo(s)).catch(() => setSportInfo(null));
    } else setSportInfo(null);
  }, [team]);

  // helper to set or unset a role for a member
  const setPlayerRole = (userId, role, checked) => {
    setSelectedPlayers(prev => {
      const next = { ...prev };
      if (!checked) {
        // uncheck -> remove role
        delete next[userId];
      } else {
        // mutual exclusion: setting a role removes any other role for this user
        next[userId] = role;
      }
      return next;
    });
  };

  const submitRoster = async () => {
    setValidationError(null);
    if (!selectedMatch) return setValidationError('Select a match first');
    // load sport info to validate counts (we fetched team earlier but not sport details)
    let teamSize = null;
    let substitutes = null;
    try {
      // try to fetch sport via team.sport_id -> /sports/:id if available, otherwise rely on team.sport_id being present on team
      if (team && team.sport_id) {
        const sp = await fetch(`/sports/${team.sport_id}`).then(r => r.ok ? r.json() : null).catch(() => null);
        if (sp && sp.team_size) teamSize = Number(sp.team_size);
        if (sp && typeof sp.substitutes !== 'undefined') substitutes = Number(sp.substitutes);
      }
    } catch (e) {
      // ignore - we'll fall back to server-side validation
    }

    const players = Object.keys(selectedPlayers).map(uid => ({ user_id: Number(uid), role: selectedPlayers[uid] }));
    // client-side validation when sport/team size known
    if (teamSize) {
      const starters = players.filter(p => p.role === 'starter').length;
      const total = players.length;
      const subsAllowed = (typeof substitutes === 'number' && Number.isFinite(substitutes)) ? substitutes : (teamSize ? 7 : 0);
      if (starters > teamSize) return setValidationError(`Too many starters: ${starters} (allowed ${teamSize})`);
      if (total > teamSize + subsAllowed) return setValidationError(`Too many players: ${total} (allowed ${teamSize + subsAllowed})`);
    }
    const token = localStorage.getItem('token');
    const res = await fetch(`/teams/${id}/roster`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ match_id: Number(selectedMatch), players }) });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      return setValidationError('Roster submit failed: ' + (b.error || 'unknown'));
    }
    setValidationError(null);
    alert('Roster submitted');
    // refresh rosters
    const rs = await fetch(`/teams/${id}/rosters`).then(r => r.json()).catch(() => []);
    setRosters(Array.isArray(rs) ? rs : []);
    setSelectedPlayers({});
  };

  if (!id) return <div style={{ padding: 16 }}>Kein Team ausgewählt</div>;
  if (loading) return <div style={{ padding: 16 }}>Lade...</div>;
  if (!team) return <div style={{ padding: 16 }}>Team nicht gefunden</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>{team.name} (ID: {team.id})</h2>
      <div style={{ marginTop: 12 }}>
        <h3>Members</h3>
        <ul>
          {(team.members || []).map(m => (
            <li key={m.user_id}>{m.display_name} {m.is_captain ? '(captain)' : ''}</li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Submit roster</h3>
        {matches.length === 0 && <div>No matches found for this team's league</div>}
        {matches.length > 0 && (
          <div>
            <label>Select match</label>
            <select value={selectedMatch || ''} onChange={e => setSelectedMatch(e.target.value)}>
              <option value="">-- choose --</option>
              {matches.map(g => (
                <option key={g.id} value={g.id}>{g.kickoff_at ? `${g.kickoff_at} | ${g.home} vs ${g.away}` : `Match ${g.id}`}</option>
              ))}
            </select>

            <div style={{ marginTop: 8 }}>
              <div>Select starters and substitutes using the checkboxes below. Starters are required up to the sport/team size.</div>
              {validationError && <div style={{ color: 'red', marginTop: 8 }}>{validationError}</div>}
              {/* dynamic counters: starters / total vs allowed */}
              <div style={{ marginTop: 8 }}>
                {(() => {
                  const starters = Object.values(selectedPlayers).filter(r => r === 'starter').length;
                  const total = Object.keys(selectedPlayers).length;
                  const teamSize = sportInfo && sportInfo.team_size ? Number(sportInfo.team_size) : null;
                  const substitutes = sportInfo && typeof sportInfo.substitutes !== 'undefined' ? Number(sportInfo.substitutes) : (teamSize ? 7 : 0);
                  return (
                    <div>
                      Starters: {starters}{teamSize ? ` / ${teamSize}` : ''} — Total: {total}{(teamSize || substitutes) ? ` / ${teamSize || '??'} + ${substitutes || 0} subs` : ''}
                    </div>
                  );
                })()}
              </div>
              <table style={{ marginTop: 8, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 6 }}>Member</th>
                    <th style={{ padding: 6 }}>Starter</th>
                    <th style={{ padding: 6 }}>Sub</th>
                    <th style={{ padding: 6 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(team.members || []).map(m => (
                    <tr key={m.user_id} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ padding: 6 }}>{m.display_name} {m.is_captain ? '(captain)' : ''}</td>
                      <td style={{ padding: 6 }}>
                        <input type="checkbox" checked={selectedPlayers[m.user_id] === 'starter'} onChange={e => setPlayerRole(m.user_id, 'starter', e.target.checked)} />
                      </td>
                      <td style={{ padding: 6 }}>
                        <input type="checkbox" checked={selectedPlayers[m.user_id] === 'sub'} onChange={e => setPlayerRole(m.user_id, 'sub', e.target.checked)} />
                      </td>
                      <td style={{ padding: 6 }}>
                        {/* Promote / demote UI: only show to primary captain or admin */}
                        {(currentUser && (currentUser.id === team.captain_user_id || currentUser.is_admin)) && (
                          <div>
                            {m.user_id !== team.captain_user_id && (
                              <>
                                {m.is_captain ? (
                                  <button onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    const res = await fetch(`/teams/${team.id}/members/${m.user_id}/demote`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' } });
                                    if (res.ok) {
                                      // update local team.members
                                      setTeam(prev => ({ ...prev, members: (prev.members || []).map(mm => mm.user_id === m.user_id ? { ...mm, is_captain: false } : mm) }));
                                    } else {
                                      alert('Demote failed');
                                    }
                                  }}>Demote</button>
                                ) : (
                                  <button onClick={async () => {
                                    const token = localStorage.getItem('token');
                                    const res = await fetch(`/teams/${team.id}/members/${m.user_id}/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' } });
                                    if (res.ok) {
                                      setTeam(prev => ({ ...prev, members: (prev.members || []).map(mm => mm.user_id === m.user_id ? { ...mm, is_captain: true } : mm) }));
                                    } else {
                                      alert('Promote failed');
                                    }
                                  }}>Promote</button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 8 }}>
                <button onClick={submitRoster}>Submit roster</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Rosters</h3>
        {rosters.length === 0 && <div>No rosters yet</div>}
        {rosters.map(r => (
          <div key={r.id} style={{ border: '1px solid #ddd', padding: 8, marginBottom: 8 }}>
            <div><strong>Match:</strong> {r.match_id}</div>
            <div><strong>Submitted:</strong> {r.created_at}</div>
            <div>
              <strong>Players:</strong>
              <ul>
                {(r.players || []).map(p => <li key={p.user_id}>{p.display_name} — {p.role}{p.shirt_number ? ` (#${p.shirt_number})` : ''}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
