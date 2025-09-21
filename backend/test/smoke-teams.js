#!/usr/bin/env node
// Simple Node smoke test for teams: login, create team, add member, submit roster
// Usage: node backend/test/smoke-teams.js --email admin@example.com --password secret

const API = process.env.API_BASE || 'http://localhost:5001';
// very small argv parser to avoid extra deps
const rawArgs = process.argv.slice(2);
let email = null;
let password = 'password';
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--email' || a === '-e') { email = rawArgs[i+1]; i++; }
  else if (a === '--password' || a === '-p') { password = rawArgs[i+1]; i++; }
}

if (!email) {
  console.error('Provide --email admin@example.com');
  process.exit(2);
}

async function main() {
  const fetch = global.fetch || (await import('node-fetch')).default;

  // login
  const loginRes = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!loginRes.ok) {
    console.error('Login failed', await loginRes.text());
    process.exit(3);
  }
  const loginBody = await loginRes.json();
  const token = loginBody.token;
  if (!token) {
    console.error('No token in login response', loginBody);
    process.exit(4);
  }
  console.log('Logged in, token length', token.length);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // create team
  const createRes = await fetch(`${API}/teams`, { method: 'POST', headers, body: JSON.stringify({ name: 'SmokeTeam', league_id: 1, sport_id: 1 }) });
  if (!createRes.ok) {
    console.error('Create team failed', await createRes.text());
    process.exit(5);
  }
  const createBody = await createRes.json();
  const teamId = createBody && createBody.team && createBody.team.id;
  console.log('Created team', teamId);

  // add member (try user 1)
  const addRes = await fetch(`${API}/teams/${teamId}/members`, { method: 'POST', headers, body: JSON.stringify({ user_id: 1 }) });
  const addBody = await addRes.json();
  console.log('Add member response', addBody);

  // submit roster: simple single starter
  const roster = { match_id: 1, players: [{ user_id: 1, role: 'starter' }] };
  const rosterRes = await fetch(`${API}/teams/${teamId}/roster`, { method: 'POST', headers, body: JSON.stringify(roster) });
  const rosterBody = await rosterRes.json();
  console.log('Roster response', rosterBody);

  if (rosterRes.ok && rosterBody && rosterBody.success) {
    console.log('Smoke test passed');
    process.exit(0);
  }
  console.error('Smoke test failed');
  process.exit(6);
}

main().catch(err => { console.error(err); process.exit(99); });
