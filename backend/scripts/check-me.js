#!/usr/bin/env node
const fetch = global.fetch || require('node-fetch');
const base = process.env.API_BASE || 'http://localhost:5001';

async function run() {
  try {
    console.log('Logging in as admin1@example.com ...');
    const resp = await fetch(base + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin1@example.com', password: 'test1234' })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.token) {
      console.error('Login failed', resp.status, await resp.text());
      process.exit(1);
    }
    const token = data.token;
    console.log('Received token (masked):', token.slice(0,6) + '...' + token.slice(-6));

    const endpoints = ['/me', '/me/leagues', '/me/games'];
    for (const ep of endpoints) {
      const r = await fetch(base + ep, { headers: { Authorization: 'Bearer ' + token } });
      const body = await r.text();
      console.log(`
Endpoint: ${ep}
Status: ${r.status}
Body: ${body.substring(0, 1000)}`);
    }
  } catch (e) {
    console.error('Error:', e && (e.stack || e.message || e));
    process.exit(2);
  }
}

run();
