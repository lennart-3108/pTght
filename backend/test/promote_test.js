(async () => {
  const fetch = (await import('node-fetch')).default;
  try {
    const loginRes = await fetch('http://localhost:5001/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin267@example.com', password: 'test1234' }) });
    const loginBody = await loginRes.json();
    const token = loginBody.token;
    console.log('Logged in, token?', !!token);

    const teamRes = await fetch('http://localhost:5001/teams/17', { headers: { Authorization: `Bearer ${token}` } });
    const teamBody = await teamRes.json();
    const members = teamBody.members || (teamBody.team && teamBody.team.members) || [];
    console.log('Members length:', members.length);
    const memberId = members.length ? members[0].user_id : 1;
    console.log('Using memberId=', memberId);

    const promoteRes = await fetch(`http://localhost:5001/teams/17/members/${memberId}/promote`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    console.log('Promote status:', promoteRes.status, await promoteRes.text());

    const demoteRes = await fetch(`http://localhost:5001/teams/17/members/${memberId}/demote`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    console.log('Demote status:', demoteRes.status, await demoteRes.text());
  } catch (e) {
    console.error('Error', e && e.stack);
    process.exit(2);
  }
})();
