#!/bin/bash
# Complete deployment with LFTP (Frontend + Backend + Config)
# Usage: bash deploy-complete.sh [instance_type]
# Example: bash deploy-complete.sh test

set -e

PROJECT_ROOT="$(cd "${0%/*}/.." && pwd)"
LFTP_USER="rsftp_matchle"
LFTP_HOST="ssh.strato.de"

echo "=========================================="
echo "Match League - Complete Deployment"
echo "=========================================="
echo ""

# Get instance type
if [ -n "${1:-}" ]; then
  INSTANCE="$1"
else
  echo "🎯 Wähle Instance zum Deployen:"
  echo "  1 = development (5001)"
  echo "  2 = test (5002)"
  echo "  3 = production (5003)"
  read -p "Wahl: " choice
  case $choice in
    1) INSTANCE="development" ;;
    2) INSTANCE="test" ;;
    3) INSTANCE="production" ;;
    *) echo "❌ Ungültig"; exit 1 ;;
  esac
fi

# Configuration for each instance
case "$INSTANCE" in
  development)
    PORT="5001"
    INSTANCE_SHORT="dev"
    ;;
  test)
    PORT="5002"
    INSTANCE_SHORT="test"
    ;;
  production)
    PORT="5003"
    INSTANCE_SHORT="prod"
    ;;
  *)
    echo "❌ Ungültige Instance"
    exit 1
    ;;
esac

REMOTE_PATH="/matchleague.org/$INSTANCE_SHORT"

echo "📦 Instance: $INSTANCE"
echo "🔌 Port: $PORT"
echo "📍 Remote: $REMOTE_PATH"
echo ""

# Check lftp
if ! command -v lftp >/dev/null 2>&1; then
  echo "📥 Installing lftp..."
  brew install lftp >/dev/null 2>&1 || {
    echo "❌ Failed to install lftp"
    exit 1
  }
fi

# Get FTP password
echo ""
if [ -n "${FTP_PASSWORD:-}" ]; then
  echo "✓ Using FTP password from environment"
else
  echo "🔐 FTP-Passwort eingeben:"
  read -sp "Passwort: " FTP_PASSWORD
  echo ""
fi

# 1. Build Frontend
echo ""
echo "1️⃣  Building Frontend..."
cd "$PROJECT_ROOT/frontend"
REACT_APP_INSTANCE_TYPE="$INSTANCE" npm run build > /dev/null 2>&1 || {
  echo "❌ Frontend build failed"
  exit 1
}
BUILD_SIZE=$(du -sh build | cut -f1)
echo "✅ Frontend built ($BUILD_SIZE)"

# 2. Deploy Frontend
echo ""
echo "2️⃣  Deploying Frontend to $REMOTE_PATH..."
lftp -u "$LFTP_USER,$FTP_PASSWORD" ftps://$LFTP_HOST <<EOF 2>&1 | head -30
set sftp:auto-confirm yes
set ftp:ssl-allow all
set ftp:ssl-force true
set net:max-retries 2
cd $REMOTE_PATH
lcd "$PROJECT_ROOT/frontend/build"
mirror -e -R --ignore-time --newer ./ ./frontend/
quit
EOF
echo "✅ Frontend deployed"

# 3. Deploy Backend code
echo ""
echo "3️⃣  Deploying Backend code..."
lftp -u "$LFTP_USER,$FTP_PASSWORD" ftps://$LFTP_HOST <<EOF 2>&1 | head -30
set sftp:auto-confirm yes
set ftp:ssl-allow all
set ftp:ssl-force true
set net:max-retries 2
cd $REMOTE_PATH
lcd "$PROJECT_ROOT/backend"
mirror -e -R --ignore-time --newer --exclude="node_modules/" --exclude="*.db*" --exclude="logs/" --exclude="uploads/" ./ ./backend/
quit
EOF
echo "✅ Backend code deployed"

# 4. Deploy configuration
echo ""
echo "4️⃣  Deploying Configuration..."
ENV_FILE="$PROJECT_ROOT/backend/.env.$INSTANCE"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env.$INSTANCE not found at $ENV_FILE"
  exit 1
fi

lftp -u "$LFTP_USER,$FTP_PASSWORD" ftps://$LFTP_HOST <<EOF 2>&1 | head -30
set sftp:auto-confirm yes
set ftp:ssl-allow all
set ftp:ssl-force true
set net:max-retries 2
cd $REMOTE_PATH/backend
put -O .env "$ENV_FILE"
quit
EOF
echo "✅ Configuration deployed (.env)"

# 5. Summary
echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "📍 Instance: $INSTANCE"
echo "🌐 URL: https://$INSTANCE_SHORT.matchleague.org"
echo "🔌 Backend Port: $PORT"
echo "📂 Remote Path: $REMOTE_PATH"
echo ""
echo "⏭️  Next Steps:"
echo ""
echo "On server, run:"
echo "  cd $REMOTE_PATH/backend"
echo "  npm install --production"
echo "  npm start"
echo ""
echo "Or use PM2 for production:"
echo "  pm2 start npm --name matchleague-$INSTANCE -- start"
echo "  pm2 save && pm2 startup"
echo ""
