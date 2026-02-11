#!/bin/bash
# Deploy Script für test.matchleague.org
# Deployment der Test-Instanz mit eingeschränkten Features
set -e

echo "🚀 TEST INSTANCE DEPLOYMENT"
echo "============================"
echo "Target: test.matchleague.org"
echo "Port: 5002 (Backend)"
echo ""

# Check if on server
if [ ! -d "/matchleague.org" ]; then
  echo "❌ Error: Must run on server at /matchleague.org"
  exit 1
fi

ROOT_DIR="/matchleague.org"
cd "$ROOT_DIR"

# 1. Git Update
echo "📥 1/7 - Pulling latest code..."
git fetch origin
git checkout dev
git pull origin dev
echo "✅ Code updated"
echo ""

# 2. Backup current database
echo "💾 2/7 - Backing up test database..."
cd backend
if [ -f "sportsplatform-test.db" ]; then
  cp sportsplatform-test.db "sportsplatform-test.db.backup_$(date +%Y%m%d_%H%M%S)"
  echo "✅ Backup created"
else
  echo "ℹ️  No existing test database found"
fi
echo ""

# 3. Setup test environment
echo "⚙️  3/7 - Setting up test environment..."
if [ ! -f ".env" ]; then
  cp .env.test.example .env
  echo "⚠️  Created .env from template - PLEASE UPDATE SECRETS!"
  echo "   Edit: vi .env"
  exit 1
fi
echo "✅ Environment configured"
echo ""

# 4. Install backend dependencies
echo "📦 4/7 - Installing backend dependencies..."
npm install --production
echo "✅ Backend dependencies installed"
echo ""

# 5. Run migrations
echo "🔄 5/7 - Running database migrations..."
npm run migrate
echo "✅ Migrations complete"
echo ""

# 6. Build frontend with test config
echo "🏗️  6/7 - Building frontend for test instance..."
cd ../frontend

# Set environment for test instance
export REACT_APP_INSTANCE_TYPE=test
export REACT_APP_API_BASE=/api
export NODE_ENV=production

# Install and build
npm install --production
npm run build
echo "✅ Frontend built"
echo ""

# 7. Restart backend
echo "🔄 7/7 - Restarting backend..."
cd ../backend

# Stop existing process
pkill -f "node.*server.js.*5002" || echo "  (No existing process)"
sleep 2

# Start new process
PORT=5002 nohup node server.js > logs/test-server.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
echo ""

# Wait and health check
echo "⏳ Waiting for backend to start..."
sleep 5

if curl -s http://localhost:5002/api/health | grep -q '"ok":true'; then
  echo "✅ Backend health check passed"
else
  echo "⚠️  Backend health check failed - check logs:"
  echo "   tail -f $ROOT_DIR/backend/logs/test-server.log"
fi

echo ""
echo "============================"
echo "✅ TEST DEPLOYMENT COMPLETE"
echo ""
echo "📊 URLs:"
echo "   Frontend: https://test.matchleague.org"
echo "   Backend:  https://test.matchleague.org/api"
echo "   Health:   https://test.matchleague.org/api/health"
echo ""
echo "📝 Logs:"
echo "   tail -f $ROOT_DIR/backend/logs/test-server.log"
echo ""
echo "⚠️  REMINDER: Test instance has limited features:"
echo "   ✓ Registration & Login"
echo "   ✓ Match search & creation"
echo "   ✓ Match process & chat"
echo "   ✗ Leagues (coming soon)"
echo "   ✗ Competitions (coming soon)"
echo "   ✗ Bookings (coming soon)"
echo ""
