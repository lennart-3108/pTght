const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');

// Simple deploy webhook - pulls latest code and restarts server
router.post('/webhook/deploy', (req, res) => {
  const token = req.headers['x-deploy-token'] || req.query.token;
  const expectedToken = process.env.DEPLOY_TOKEN || 'dev-deploy-2026';
  
  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const projectRoot = path.resolve(__dirname, '../../../');
  const commands = [
    `cd ${projectRoot}`,
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

// Status endpoint to check deploy webhook
router.get('/webhook/deploy/status', (req, res) => {
  res.json({ 
    available: true,
    usage: 'POST /api/deploy/webhook/deploy with X-Deploy-Token header'
  });
});

// Simple restart endpoint - just restarts the server process
router.post('/webhook/restart', (req, res) => {
  const token = req.headers['x-deploy-token'] || req.query.token;
  const expectedToken = process.env.DEPLOY_TOKEN || 'dev-deploy-2026';
  
  if (token !== expectedToken) {
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
