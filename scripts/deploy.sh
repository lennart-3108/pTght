#!/usr/bin/env bash
# Deploy script for Match League instances (runs ON the server)
# Usage: bash deploy.sh [development|test|production]

set -euo pipefail

INSTANCE_TYPE="${1:-development}"
BRANCH="${2:-dev}"
APP_PATH="${3:-/opt/matchleague-${INSTANCE_TYPE}}"

# Validate instance type
case "$INSTANCE_TYPE" in
  development|test|production) ;;
  *)
    echo "❌ Invalid instance type: $INSTANCE_TYPE"
    echo "Usage: bash deploy.sh [development|test|production]"
    exit 1
    ;;
esac

echo "=========================================="
echo "Deploying $INSTANCE_TYPE instance"
echo "App Path: $APP_PATH"
echo "Branch: $BRANCH"
echo "=========================================="
echo ""

export DEBIAN_FRONTEND=noninteractive

# 1. Ensure git is installed
if ! command -v git >/dev/null 2>&1; then
  echo "Installing git..."
  apt-get update -q
  apt-get install -y -q git
fi

# 2. Clone/update repository
if [ ! -d "$APP_PATH" ]; then
  echo "Cloning repository..."
  mkdir -p "$(dirname $APP_PATH)"
  cd "$(dirname $APP_PATH)"
  git clone https://github.com/lennart-3108/pTght.git matchleague-$INSTANCE_TYPE
else
  cd "$APP_PATH"
  echo "Fetching latest changes..."
  git fetch --all --prune
fi

cd "$APP_PATH"
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
git pull --ff-only origin "$BRANCH" || {
  echo "⚠ Git pull failed, attempting reset..."
  git reset --hard "origin/$BRANCH"
}

# 3. Setup environment
case "$INSTANCE_TYPE" in
  development)
    PORT=5001
    REACT_APP_API_BASE="http://localhost:5001/api"
    ;;
  test)
    PORT=5002
    REACT_APP_API_BASE="https://test.matchleague.org/api"
    ;;
  production)
    PORT=5003
    REACT_APP_API_BASE="https://matchleague.org/api"
    ;;
esac

echo "Configuring environment (Port: $PORT)..."

# 4. Create .env files if not present
if [ ! -f backend/.env ]; then
  if [ -f "backend/.env.$INSTANCE_TYPE.example" ]; then
    cp "backend/.env.$INSTANCE_TYPE.example" backend/.env
  else
    cat > backend/.env << EOF
PORT=$PORT
INSTANCE_TYPE=$INSTANCE_TYPE
REACT_APP_API_BASE=$REACT_APP_API_BASE
NODE_ENV=production
EOF
  fi
fi

# Set PORT in .env
if grep -q '^PORT=' backend/.env; then
  sed -i "s/^PORT=.*/PORT=$PORT/" backend/.env
else
  echo "PORT=$PORT" >> backend/.env
fi

# 5. Ensure Node.js is installed
if ! command -v npm >/dev/null 2>&1; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 6. Ensure PM2 is installed
if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing PM2..."
  npm install -g pm2
fi

# 7. Build & Deploy Frontend
echo ""
echo "Building frontend..."
cd frontend
REACT_APP_INSTANCE_TYPE="$INSTANCE_TYPE" \
  REACT_APP_API_BASE="$REACT_APP_API_BASE" \
  npm ci --production
npm run build > /dev/null 2>&1
cd ..

# Copy build to public
mkdir -p public
cp -r frontend/build/* public/

echo "✓ Frontend built"

# 8. Deploy Backend
echo "Starting backend..."
cd backend

# Install dependencies
npm ci --production

# Kill existing process for this instance
pkill -f "PORT=$PORT" || true
sleep 1

# Start with PM2
pm2 start node --name "matchleague-$INSTANCE_TYPE" -- server.js || \
  pm2 restart "matchleague-$INSTANCE_TYPE" || \
  pm2 start node --name "matchleague-$INSTANCE_TYPE" -- server.js

# Save PM2 startup
pm2 save

echo "✓ Backend started (PID: $(pgrep -f "PORT=$PORT" || echo 'n/a'))"

# 9. Summary
echo ""
echo "=========================================="
echo "✅ $INSTANCE_TYPE deployment complete!"
echo "=========================================="
echo ""
echo "Instance: $INSTANCE_TYPE"
echo "Port: $PORT"
echo "API Base: $REACT_APP_API_BASE"
echo ""
echo "Server is starting up... (wait ~30 seconds before testing)"
echo ""

# Show logs
echo "Recent logs:"
pm2 logs "matchleague-$INSTANCE_TYPE" --lines 10 || true
