import React, { useState } from 'react';
import UserSearch from './UserSearch';

function TeamForm({ onCreated }) {
  const [name, setName] = useState('');
  const [leagueId, setLeagueId] = useState('1');
  const [sportId, setSportId] = useState('1');
  const [members, setMembers] = useState([]);
  const [newMemberId, setNewMemberId] = useState('');

  const createTeam = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/teams', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ name, league_id: Number(leagueId), sport_id: Number(sportId) }) });
    if (!res.ok) return alert('Create failed');
    const body = await res.json();
    onCreated && onCreated(body.team);
    // persist created team id for subsequent actions
    if (body && body.team && body.team.id) setCreatedTeamId(body.team.id);
  };

  const [createdTeamId, setCreatedTeamId] = useState(null);

  const addMember = async (userIdParam) => {
    const uid = userIdParam || newMemberId;
    if (!uid) return;
    if (!createdTeamId) return alert('Create a team first');
    const token = localStorage.getItem('token');
    const res = await fetch(`/teams/${createdTeamId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ user_id: Number(uid) }) });
    if (!res.ok) {
      const t = await res.json().catch(() => ({}));
      return alert('Add member failed: ' + (t.error || 'unknown'));
    }
    // refresh members list (simple optimistic add)
    setMembers([...members, { user_id: Number(uid) }]);
    setNewMemberId('');
  };

  const submitRoster = async (teamIdParam) => {
    const teamId = teamIdParam || createdTeamId;
    if (!teamId) return alert('No team selected');
    const token = localStorage.getItem('token');
    // fetch sport size
    const sport = await fetch(`/sports/${sportId}`, { headers: { Accept: 'application/json' } }).then(r => r.json()).catch(() => null);
    const teamSize = sport && sport.team_size ? Number(sport.team_size) : 11;
    // simple roster: take first teamSize players as starters
    const players = members.map((m, i) => ({ user_id: m.user_id, role: i < teamSize ? 'starter' : 'sub' }));
  const res = await fetch(`/teams/${teamId}/roster`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ match_id: 1, players }) });
    if (!res.ok) {
      const t = await res.json().catch(() => ({}));
      return alert('Roster submit failed: ' + (t.error || 'unknown'));
    }
    alert('Roster submitted');
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label>Team name</label>
        <input value={name} onChange={e => setName(e.target.value)} />
        <label>League id</label>
        <input value={leagueId} onChange={e => setLeagueId(e.target.value)} style={{ width: 80, marginLeft: 8 }} />
        <label style={{ marginLeft: 8 }}>Sport id</label>
        <input value={sportId} onChange={e => setSportId(e.target.value)} style={{ width: 80, marginLeft: 8 }} />
        <button onClick={createTeam} style={{ marginLeft: 8 }}>Create</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <h4>Members</h4>
        <div>
          <UserSearch onSelect={u => addMember(u.id)} />
          <button onClick={() => addMember()} style={{ marginLeft: 8 }}>Add</button>
        </div>
        <ul>
          {members.map(m => <li key={m.user_id}>user:{m.user_id}</li>)}
        </ul>
        <div>
          <button onClick={() => submitRoster(17)}>Submit roster for team 17 (demo)</button>
        </div>
      </div>
    </div>
  );
}

export default TeamForm;
