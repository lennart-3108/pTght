#!/bin/bash
# Deploy Script für matchleague.org (PRODUCTION)
# Deployment der Production-Instanz mit "Coming Soon" Landing Page
set -e

echo "🚀 PRODUCTION INSTANCE DEPLOYMENT"
echo "=================================="
echo "Target: matchleague.org"
echo "Port: 5003 (Backend)"
echo ""
echo "⚠️  WARNING: This deploys to PRODUCTION!"
echo "   Only the landing page will be shown."
echo ""

read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

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
git checkout main  # Use main branch for production!
git pull origin main
echo "✅ Code updated"
echo ""

# 2. Backup current database
echo "💾 2/7 - Backing up prod database..."
cd backend
if [ -f "sportsplatform-prod.db" ]; then
  cp sportsplatform-prod.db "sportsplatform-prod.db.backup_$(date +%Y%m%d_%H%M%S)"
  echo "✅ Backup created"
else
  echo "ℹ️  No existing prod database found (first deployment)"
fi
echo ""

# 3. Setup production environment
echo "⚙️  3/7 - Setting up production environment..."
if [ ! -f ".env" ]; then
  cp .env.prod.example .env
  echo "❌ ERROR: Created .env from template"
  echo "   You MUST update these values before continuing:"
  echo "   - JWT_SECRET (strong random string)"
  echo "   - MAIL_PASS (email password)"
  echo "   - Database credentials (if using PostgreSQL)"
  echo ""
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

# 6. Build frontend with production config
echo "🏗️  6/7 - Building frontend for production (landing page only)..."
cd ../frontend

# Set environment for production instance
export REACT_APP_INSTANCE_TYPE=production
export REACT_APP_API_BASE=/api
export NODE_ENV=production

# Install and build
npm install --production
npm run build
echo "✅ Frontend built (landing page)"
echo ""

# 7. Restart backend
echo "🔄 7/7 - Restarting production backend..."
cd ../backend

# Stop existing process
pkill -f "node.*server.js.*5003" || echo "  (No existing process)"
sleep 2

# Start new process
PORT=5003 nohup node server.js > logs/prod-server.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
echo ""

# Wait and health check
echo "⏳ Waiting for backend to start..."
sleep 5

if curl -s http://localhost:5003/api/health | grep -q '"ok":true'; then
  echo "✅ Backend health check passed"
else
  echo "⚠️  Backend health check failed - check logs:"
  echo "   tail -f $ROOT_DIR/backend/logs/prod-server.log"
fi

echo ""
echo "===================================="
echo "✅ PRODUCTION DEPLOYMENT COMPLETE"
echo ""
echo "📊 URLs:"
echo "   Frontend: https://matchleague.org"
echo "   Backend:  https://matchleague.org/api"
echo "   Health:   https://matchleague.org/api/health"
echo ""
echo "📝 Logs:"
echo "   tail -f $ROOT_DIR/backend/logs/prod-server.log"
echo ""
echo "ℹ️  PRODUCTION MODE:"
echo "   Only the 'Coming Soon' landing page is shown."
echo "   Users are redirected to test.matchleague.org to try the app."
echo ""
