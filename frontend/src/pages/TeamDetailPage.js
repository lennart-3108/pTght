import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE } from "../config";
import Avatar from "../components/Avatar";

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
      fetch(`${API_BASE}/teams/${id}`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/teams/${id}/rosters`).then(r => r.json()).catch(() => []),
      // also try to fetch upcoming matches for the team's league (if available)
      fetch(`${API_BASE}/leagues/${(team && team.team && team.team.league_id) || ''}/games`).then(r => r.json()).catch(() => [])
    ]).then(([t, rs]) => {
      setTeam(t && t.team ? t.team : (t || null));
      setRosters(Array.isArray(rs) ? rs : []);
      // matches will be filled by a second fetch once team is set
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // fetch current user to enable promote/demote UI and quick permission checks
  useEffect(() => {
  fetch(`${API_BASE}/me`).then(r => r.ok ? r.json() : null).then(u => setCurrentUser(u && u.user ? u.user : null)).catch(() => setCurrentUser(null));
  }, []);

  // When team is loaded, fetch matches for its league
  useEffect(() => {
    if (!team || !team.league_id) return;
  fetch(`${API_BASE}/leagues/${team.league_id}/games`).then(r => r.json()).then(data => {
      // assume the API returns an array of games
      setMatches(Array.isArray(data) ? data : []);
    }).catch(() => setMatches([]));
    // fetch sport info if available
    if (team && team.sport_id) {
  fetch(`${API_BASE}/sports/${team.sport_id}`).then(r => r.ok ? r.json() : null).then(s => setSportInfo(s)).catch(() => setSportInfo(null));
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
  const res = await fetch(`${API_BASE}/teams/${id}/roster`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ match_id: Number(selectedMatch), players }) });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      return setValidationError('Roster submit failed: ' + (b.error || 'unknown'));
    }
    setValidationError(null);
    alert('Roster submitted');
    // refresh rosters
  const rs = await fetch(`${API_BASE}/teams/${id}/rosters`).then(r => r.json()).catch(() => []);
    setRosters(Array.isArray(rs) ? rs : []);
    setSelectedPlayers({});
  };

  if (!id) return <div style={{ padding: 16 }}>Kein Team ausgewählt</div>;
  if (loading) return <div style={{ padding: 16 }}>Lade...</div>;
  if (!team) return <div style={{ padding: 16 }}>Team nicht gefunden</div>;

  // Styling helpers
  const wrap = { padding: 16, color: '#e8efe8', fontFamily: 'Inter, system-ui, sans-serif' };
  const card = { background: '#0f2a20', borderRadius: 16, boxShadow: '0 14px 36px rgba(0,0,0,0.5)' };
  const pad = { padding: 16 };
  const pill = { display: 'inline-block', padding: '6px 12px', borderRadius: 999, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' };
  const small = { fontSize: 12, color: '#a6bfb3' };

  return (
    <div style={wrap}>
      {/* Header */}
      <div style={{ ...card }}>
        <div style={{ ...pad }}>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{team.name}</div>
          <div style={small}>Team ID: {team.id}</div>
        </div>
      </div>

      {/* Members */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...pad, paddingBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Teammitglieder</div>
        </div>
        <div style={{ ...pad, paddingTop: 8 }}>
          {(team.members || []).length === 0 ? (
            <div style={small}>Keine Mitglieder.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {(team.members || []).map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0b1e19', borderRadius: 12, padding: 12 }}>
                  <Avatar userId={m.user_id} name={m.display_name} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{m.display_name}</div>
                    {m.is_captain && <div style={small}>Captain</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Roster form */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...pad, paddingBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Aufstellung einreichen</div>
        </div>
        <div style={{ ...pad, paddingTop: 8 }}>
          {matches.length === 0 && <div style={small}>Keine Spiele im Liga‑Kalender gefunden.</div>}
          {matches.length > 0 && (
            <div>
              <label style={{ display: 'grid', gap: 4 }}>
                Match wählen
                <select value={selectedMatch || ''} onChange={e => setSelectedMatch(e.target.value)}>
                  <option value="">-- wählen --</option>
                  {matches.map(g => (
                    <option key={g.id} value={g.id}>{g.kickoff_at ? `${new Date(g.kickoff_at).toLocaleString('de-DE')} | ${g.home} vs ${g.away}` : `Match ${g.id}`}</option>
                  ))}
                </select>
              </label>

              <div style={{ marginTop: 8 }}>
                <div>Starter und Auswechselspieler auswählen. Starter maximal bis Teamgröße.</div>
                {validationError && <div style={{ color: 'crimson', marginTop: 8 }}>{validationError}</div>}
                <div style={{ marginTop: 8 }}>
                  {(() => {
                    const starters = Object.values(selectedPlayers).filter(r => r === 'starter').length;
                    const total = Object.keys(selectedPlayers).length;
                    const teamSize = sportInfo && sportInfo.team_size ? Number(sportInfo.team_size) : null;
                    const substitutes = sportInfo && typeof sportInfo.substitutes !== 'undefined' ? Number(sportInfo.substitutes) : (teamSize ? 7 : 0);
                    return (
                      <div>
                        Starters: {starters}{teamSize ? ` / ${teamSize}` : ''} — Gesamt: {total}{(teamSize || substitutes) ? ` / ${teamSize || '??'} + ${substitutes || 0} Ausw.` : ''}
                      </div>
                    );
                  })()}
                </div>
                <table style={{ marginTop: 8, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #234' }}>
                      <th style={{ padding: 6 }}>Mitglied</th>
                      <th style={{ padding: 6 }}>Starter</th>
                      <th style={{ padding: 6 }}>Ausw.</th>
                      <th style={{ padding: 6 }}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(team.members || []).map(m => (
                      <tr key={m.user_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: 6 }}>{m.display_name} {m.is_captain ? '(Captain)' : ''}</td>
                        <td style={{ padding: 6 }}>
                          <input type="checkbox" checked={selectedPlayers[m.user_id] === 'starter'} onChange={e => setPlayerRole(m.user_id, 'starter', e.target.checked)} />
                        </td>
                        <td style={{ padding: 6 }}>
                          <input type="checkbox" checked={selectedPlayers[m.user_id] === 'sub'} onChange={e => setPlayerRole(m.user_id, 'sub', e.target.checked)} />
                        </td>
                        <td style={{ padding: 6 }}>
                          {(currentUser && (currentUser.id === team.captain_user_id || currentUser.is_admin)) && (
                            <div>
                              {m.user_id !== team.captain_user_id && (
                                <>
                                  {m.is_captain ? (
                                    <button style={pill} onClick={async () => {
                                      const token = localStorage.getItem('token');
                                      const res = await fetch(`${API_BASE}/teams/${team.id}/members/${m.user_id}/demote`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' } });
                                      if (res.ok) {
                                        setTeam(prev => ({ ...prev, members: (prev.members || []).map(mm => mm.user_id === m.user_id ? { ...mm, is_captain: false } : mm) }));
                                      } else {
                                        alert('Demote failed');
                                      }
                                    }}>Demote</button>
                                  ) : (
                                    <button style={pill} onClick={async () => {
                                      const token = localStorage.getItem('token');
                                      const res = await fetch(`${API_BASE}/teams/${team.id}/members/${m.user_id}/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' } });
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
                  <button style={pill} onClick={submitRoster}>Aufstellung senden</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rosters list */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...pad, paddingBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Aufstellungen</div>
        </div>
        <div style={{ ...pad, paddingTop: 8 }}>
          {rosters.length === 0 && <div style={small}>Noch keine Aufstellungen</div>}
          {rosters.map(r => (
            <div key={r.id} style={{ background: '#0b1e19', borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <div><strong>Match:</strong> {r.match_id}</div>
              <div><strong>Erstellt:</strong> {r.created_at}</div>
              <div style={{ marginTop: 6 }}>
                <strong>Spieler:</strong>
                <ul>
                  {(r.players || []).map(p => <li key={p.user_id}>{p.display_name} — {p.role}{p.shirt_number ? ` (#${p.shirt_number})` : ''}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
