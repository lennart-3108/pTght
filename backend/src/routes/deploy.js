const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const crypto = require('crypto');

function tokensEqual(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function quoteSh(value) {
  // POSIX-ish shell quoting for paths (handles spaces safely)
  const s = String(value ?? '');
  return `'${s.replace(/'/g, `'"'"'`)}'`;
}

function getDeployToken(req) {
  const headerToken = req.headers['x-deploy-token'];
  if (headerToken) return headerToken;

  // Backward-compatible, but disabled by default (query strings may be logged).
  if (String(process.env.ALLOW_DEPLOY_TOKEN_QUERY || '').toLowerCase() === 'true') {
    return req.query.token;
  }

  return undefined;
}

// Simple deploy webhook - pulls latest code and restarts server
router.post('/webhook/deploy', (req, res) => {
  const expectedToken = process.env.DEPLOY_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({ error: 'Deploy webhook disabled (DEPLOY_TOKEN not configured)' });
  }

  const token = getDeployToken(req);
  
  if (!tokensEqual(token, expectedToken)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const projectRoot = path.resolve(__dirname, '../../../');
  const commands = [
    `cd ${quoteSh(projectRoot)}`,
    'git fetch origin',
    'git checkout dev',
    'git pull origin dev',
    'cd backend && npm install --production',
    'pkill -f "node.*server.js" || true',
    'sleep 2',
    'cd backend && nohup node server.js > server.log 2>&1 &'
  ].join(' && ');

  exec(commands, { cwd: projectRoot }, (error, stdout, stderr) => {
    if (error) {
      console.error('Deploy error:', error);
      return res.status(500).json({ 
        error: 'Deploy failed', 
        details: error.message,
        stderr: stderr
      });
    }

    res.json({ 
      success: true, 
      message: 'Deployed successfully',
      output: stdout
    });
  });
});

// Status endpoint removed (security: revealed deploy API surface)

// Simple restart endpoint - just restarts the server process
router.post('/webhook/restart', (req, res) => {
  const expectedToken = process.env.DEPLOY_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({ error: 'Restart webhook disabled (DEPLOY_TOKEN not configured)' });
  }

  const token = getDeployToken(req);
  
  if (!tokensEqual(token, expectedToken)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[restart] Restarting server via webhook...');
  
  res.json({ 
    success: true, 
    message: 'Server restarting in 2 seconds...'
  });

  // Give response time to send, then restart
  setTimeout(() => {
    console.log('[restart] Exiting process for restart');
    process.exit(0);
  }, 2000);
});

module.exports = router;
