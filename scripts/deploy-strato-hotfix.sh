#!/bin/bash
# Hotfix Deployment für Strato Server
# Fixes: 36k+ leagues auto-creation, missing DB columns, 502 errors

set -e

SERVER="ssh.strato.de"
USER="rsftp_matchle"
DEPLOY_PATH="/matchleague.org"

echo "🚀 Deploying hotfix to Strato Server..."
echo "=================================="

# 1. Pull latest code
echo ""
echo "📥 Step 1/6: Pulling latest code from dev branch..."
ssh ${USER}@${SERVER} << 'ENDSSH'
cd /matchleague.org
git fetch origin
git checkout dev
git pull origin dev
echo "✅ Code updated to latest dev"
ENDSSH

# 2. Backup current database
echo ""
echo "💾 Step 2/6: Backing up database..."
ssh ${USER}@${SERVER} << 'ENDSSH'
cd /matchleague.org/backend
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ -f sportsplatform.db ]; then
  cp sportsplatform.db "sportsplatform.db.backup_${TIMESTAMP}"
  echo "✅ Database backed up to sportsplatform.db.backup_${TIMESTAMP}"
else
  echo "⚠️  No database found - fresh install"
fi
ENDSSH

# 3. Add missing DB columns
echo ""
echo "🔧 Step 3/6: Fixing database schema..."
ssh ${USER}@${SERVER} << 'ENDSSH'
cd /matchleague.org/backend
sqlite3 sportsplatform.db << 'SQLEND'
-- Add missing columns if they don't exist
ALTER TABLE assets ADD COLUMN indoor BOOLEAN DEFAULT 0;
ALTER TABLE assets ADD COLUMN supported_sports TEXT;
ALTER TABLE assets ADD COLUMN equipment TEXT;
ALTER TABLE assets ADD COLUMN amenities TEXT;
ALTER TABLE assets ADD COLUMN photos TEXT;
ALTER TABLE slots ADD COLUMN visibility TEXT DEFAULT 'public';
.quit
SQLEND
echo "✅ Database schema updated"
ENDSSH

# 4. Clean up auto-generated leagues
echo ""
echo "🧹 Step 4/6: Cleaning up auto-generated leagues..."
ssh ${USER}@${SERVER} << 'ENDSSH'
cd /matchleague.org/backend
BEFORE=$(sqlite3 sportsplatform.db "SELECT COUNT(*) FROM leagues;")
echo "   Leagues before cleanup: ${BEFORE}"

sqlite3 sportsplatform.db << 'SQLEND'
DELETE FROM leagues WHERE name LIKE '%Liga%' OR name LIKE 'Community%';
VACUUM;
.quit
SQLEND

AFTER=$(sqlite3 sportsplatform.db "SELECT COUNT(*) FROM leagues;")
echo "   Leagues after cleanup: ${AFTER}"
echo "✅ Removed $(($BEFORE - $AFTER)) auto-generated leagues"
ENDSSH

# 5. Install dependencies
echo ""
echo "📦 Step 5/6: Installing dependencies..."
ssh ${USER}@${SERVER} << 'ENDSSH'
cd /matchleague.org/backend
npm install --production
cd /matchleague.org/frontend
npm install --production
echo "✅ Dependencies installed"
ENDSSH

# 6. Restart services
echo ""
echo "🔄 Step 6/6: Restarting services..."
ssh ${USER}@${SERVER} << 'ENDSSH'
# Stop backend
pkill -f "node.*server.js" 2>/dev/null || echo "   Backend was not running"
sleep 2

# Start backend
cd /matchleague.org/backend
nohup node server.js > server.log 2>&1 &
echo "   Backend started (PID: $!)"

# Frontend (if using pm2 or similar)
# pm2 restart frontend || echo "   Frontend restart skipped"

echo "✅ Services restarted"
ENDSSH

# 7. Verify deployment
echo ""
echo "🔍 Verifying deployment..."
sleep 3
ssh ${USER}@${SERVER} << 'ENDSSH'
cd /matchleague.org/backend
LEAGUE_COUNT=$(sqlite3 sportsplatform.db "SELECT COUNT(*) FROM leagues;")
echo "   Current league count: ${LEAGUE_COUNT}"

if pgrep -f "node.*server.js" > /dev/null; then
  echo "✅ Backend is running"
else
  echo "❌ Backend not running!"
  exit 1
fi
ENDSSH

echo ""
echo "=================================="
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Test: curl https://matchleague.org/api/leagues?limit=10"
echo "  2. Check logs: ssh ${USER}@${SERVER} 'tail -50 /matchleague.org/backend/server.log'"
echo "  3. Monitor: ssh ${USER}@${SERVER} 'cd /matchleague.org/backend && sqlite3 sportsplatform.db \"SELECT COUNT(*) FROM leagues;\"'"
