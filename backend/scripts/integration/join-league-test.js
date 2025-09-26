async function run() {
  const BASE = process.env.BASE || 'http://localhost:5001';
  const email = process.env.TEST_EMAIL || 'admin5@example.com';
  const password = process.env.TEST_PASSWORD || 'test1234';
  try {
    console.log('Logging in...');
    const loginRes = await fetch(BASE + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const loginJson = await loginRes.json();
    if (!loginJson.token) throw new Error('Login failed: ' + JSON.stringify(loginJson));
    const token = loginJson.token;

    console.log('Joining league 1...');
    const joinRes = await fetch(BASE + '/leagues/1/join', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } });
    const joinJson = await joinRes.json();
    console.log('Join response:', joinJson);

    console.log('Fetching members...');
    const membersRes = await fetch(BASE + '/leagues/1/members');
    const members = await membersRes.json();
    console.log('Members:', members);

    const me = members.find(m => m.firstname === 'admin5' || m.email === email);
    if (!me) {
      console.error('Test failed: member not found in members list');
      process.exitCode = 2;
      return;
    }
    console.log('Test passed: member present with id', me.id);
    process.exitCode = 0;
  } catch (e) {
    console.error('Test failed', e);
    process.exitCode = 1;
  }
}

run();
