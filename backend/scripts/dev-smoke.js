#!/usr/bin/env node
const path = require('path');

(async () => {
  // Start server by requiring it once. server.js auto-listens on PORT env (defaults 5001).
  const { server } = require(path.join(__dirname, '..', 'server'));
  const base = `http://localhost:${process.env.PORT || 5001}`;

  function toJsonSafe(text) {
    try {
      return text.length ? JSON.parse(text) : null;
    } catch (err) {
      return text;
    }
  }

  async function request(pathname, options = {}) {
    const headers = Object.assign({}, options.headers);
    if (!headers['Content-Type'] && options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(base + pathname, Object.assign({}, options, { headers }));
    const text = await res.text();
    return {
      url: base + pathname,
      status: res.status,
      ok: res.ok,
      data: toJsonSafe(text)
    };
  }

  const results = [];
  try {
    // Allow server a brief moment to finish startup side-effects (mailer verify etc.).
    await new Promise((resolve) => setTimeout(resolve, 500));

    results.push(await request('/healthz'));
    results.push(await request('/api/public/stats'));

    const debugUsers = await request('/debug/users');
    results.push(debugUsers);

    let adminEmail = null;
    if (debugUsers.ok && debugUsers.data && Array.isArray(debugUsers.data.users)) {
      const adminUser = debugUsers.data.users.find((u) => typeof u.email === 'string' && /admin\d+@example\.com/i.test(u.email));
      if (adminUser) adminEmail = adminUser.email;
    }

    if (!adminEmail) {
      throw new Error('No auto-generated admin user found in /debug/users response.');
    }

    const login = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: 'test1234' })
    });
    results.push(login);

    if (!login.ok || !login.data || !login.data.token) {
      throw new Error('Admin login failed – token missing.');
    }

    const authHeaders = { Authorization: `Bearer ${login.data.token}` };

    results.push(await request('/api/admin/stats', { headers: authHeaders }));
    results.push(await request('/api/news', { headers: authHeaders }));

    const cities = await request('/api/cities/list');
    results.push(cities);

    // Print compact summary
    console.log('dev-smoke summary');
    for (const entry of results) {
      const label = entry.url.replace(base, '');
      if (entry.ok) {
        if (entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data)) {
          const keys = Object.keys(entry.data);
          console.log(`${label}: ${entry.status} OK (${keys.slice(0, 4).join(', ')})`);
        } else if (Array.isArray(entry.data)) {
          console.log(`${label}: ${entry.status} OK (${entry.data.length} items)`);
        } else {
          console.log(`${label}: ${entry.status} OK`);
        }
      } else {
        console.error(`${label}: ${entry.status} ERROR`, entry.data);
      }
    }
    console.log('\nDetailed results:', JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('dev-smoke failed:', err && (err.stack || err.message || err));
    process.exitCode = 1;
  } finally {
    try {
      await new Promise((resolve) => server.close(resolve));
    } catch (err) {
      console.error('Failed to close server cleanly:', err && (err.message || err));
    }
  }
})();
