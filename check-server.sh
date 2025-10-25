#!/bin/bash
# Quick check script für Server-Status

SERVER_IP="82.165.134.166"
SERVER_USER="root"

echo "🔍 Checking server status..."
echo "================================"

ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
echo "📊 Server Info:"
echo "  OS: $(lsb_release -d | cut -f2)"
echo "  Hostname: $(hostname)"
echo ""

echo "📂 App Directory:"
if [ -d "/opt/matchleague" ]; then
  echo "  ✅ /opt/matchleague exists"
  cd /opt/matchleague
  echo "  Current branch: $(git branch --show-current)"
  echo "  Last commit: $(git log -1 --oneline)"
else
  echo "  ❌ /opt/matchleague does not exist - needs initial setup!"
fi
echo ""

echo "🔧 Installed tools:"
echo "  Node: $(node --version 2>/dev/null || echo 'not installed')"
echo "  npm: $(npm --version 2>/dev/null || echo 'not installed')"
echo "  PM2: $(pm2 --version 2>/dev/null || echo 'not installed')"
echo "  Git: $(git --version 2>/dev/null || echo 'not installed')"
echo "  Nginx: $(nginx -v 2>&1 | head -1 || echo 'not installed')"
echo ""

echo "🏃 Running processes:"
pm2 list 2>/dev/null || echo "  PM2 not configured"
echo ""

echo "🌐 Nginx sites:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "  No nginx config"

ENDSSH

echo ""
echo "================================"
echo "Check complete!"
