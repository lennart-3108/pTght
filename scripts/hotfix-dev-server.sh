#!/bin/bash
# Quick Hotfix für Dev Server (82.165.134.166)
# Fixes: 341k leagues, missing users route

set -e

HOST="${HOST:-82.165.134.166}"
USER="${USER:-root}"
APP_PATH="${APP_PATH:-/opt/matchleague}"

echo "🚀 Deploying hotfix to Dev Server ($HOST)..."
echo "================================================"

# Test SSH connection
if ! ssh -o ConnectTimeout=5 ${USER}@${HOST} "echo 'SSH OK'" 2>/dev/null; then
  echo "❌ Cannot connect to ${USER}@${HOST}"
  echo "Try: ssh ${USER}@${HOST}"
  exit 1
fi

# 1. Pull latest code
echo ""
echo "📥 Step 1/5: Pulling latest code..."
ssh ${USER}@${HOST} << ENDSSH
cd ${APP_PATH}
git fetch origin
git checkout dev
git pull origin dev
echo "✅ Code updated (commit: \$(git log -1 --oneline))"
ENDSSH

# 2. Backup database
echo ""
echo "💾 Step 2/5: Backing up database..."
ssh ${USER}@${HOST} << ENDSSH
cd ${APP_PATH}/backend
if [ -f sportsplatform.db ]; then
  cp sportsplatform.db "sportsplatform.db.backup_\$(date +%Y%m%d_%H%M%S)"
  echo "✅ Database backed up"
fi
ENDSSH

# 3. Fix database schema
echo ""
echo "🔧 Step 3/5: Fixing database schema..."
ssh ${USER}@${HOST} << 'ENDSSH'
cd /opt/matchleague/backend
sqlite3 sportsplatform.db << 'SQL'
ALTER TABLE assets ADD COLUMN indoor BOOLEAN DEFAULT 0;
ALTER TABLE assets ADD COLUMN supported_sports TEXT;
ALTER TABLE assets ADD COLUMN equipment TEXT;
ALTER TABLE assets ADD COLUMN amenities TEXT;
ALTER TABLE assets ADD COLUMN photos TEXT;
ALTER TABLE slots ADD COLUMN visibility TEXT DEFAULT 'public';
.quit
SQL
echo "✅ Schema updated (ignore 'duplicate column' errors if any)"
ENDSSH

# 4. Clean up leagues
echo ""
echo "🧹 Step 4/5: Cleaning up auto-generated leagues..."
ssh ${USER}@${HOST} << 'ENDSSH'
cd /opt/matchleague/backend
BEFORE=$(sqlite3 sportsplatform.db "SELECT COUNT(*) FROM leagues;" 2>/dev/null || echo "0")
echo "   Leagues before: ${BEFORE}"

sqlite3 sportsplatform.db << 'SQL'
DELETE FROM leagues WHERE name LIKE '%Liga%' OR name LIKE 'Community%';
VACUUM;
SQL

AFTER=$(sqlite3 sportsplatform.db "SELECT COUNT(*) FROM leagues;" 2>/dev/null || echo "0")
echo "   Leagues after: ${AFTER}"
echo "✅ Cleaned up $((BEFORE - AFTER)) leagues"
ENDSSH

# 5. Restart backend
echo ""
echo "🔄 Step 5/5: Restarting backend..."
ssh ${USER}@${HOST} << 'ENDSSH'
cd /opt/matchleague

# Check if using PM2
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart backend || pm2 start backend/server.js --name backend
  echo "✅ Backend restarted via PM2"
# Check if using Docker
elif command -v docker >/dev/null 2>&1 && docker ps | grep -q matchleague; then
  docker-compose restart backend || docker restart matchleague-backend
  echo "✅ Backend restarted via Docker"
# Fallback: kill and restart manually
else
  pkill -f "node.*server.js" 2>/dev/null || true
  cd backend
  nohup node server.js > server.log 2>&1 &
  echo "✅ Backend restarted manually"
fi

sleep 2
# Verify process is running
if pgrep -f "node.*server.js" > /dev/null || pm2 list 2>/dev/null | grep -q backend; then
  echo "✅ Backend is running"
else
  echo "⚠️  Could not verify backend process"
fi
ENDSSH

# 6. Verify
echo ""
echo "🔍 Verifying deployment..."
ssh ${USER}@${HOST} << 'ENDSSH'
cd /opt/matchleague/backend
LEAGUE_COUNT=$(sqlite3 sportsplatform.db "SELECT COUNT(*) FROM leagues;" 2>/dev/null || echo "unknown")
echo "   League count: ${LEAGUE_COUNT}"
ENDSSH

echo ""
echo "================================================"
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Test: curl https://dev.matchleague.org/api/leagues?limit=10"
echo "  2. Check logs: ssh ${USER}@${HOST} 'tail -50 ${APP_PATH}/backend/server.log'"
echo "  3. Open: https://dev.matchleague.org/leagues"
echo ""
echo "If leagues count increases again, check backend/server.js for:"
echo "  - ensureCommunityLeagues() should be commented out"
echo "  - ensureTestLocation() should be commented out"
