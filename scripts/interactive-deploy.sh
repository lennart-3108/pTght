#!/bin/bash
# Interaktives Setup für test.matchleague.org
# Fragt nach allen Credentials und deployed automatisch

set -e

SERVER="ssh.strato.de"
USER="rsftp_matchle"

echo "🚀 Match League - Test Instance Setup"
echo "======================================"
echo ""
echo "Dieses Script fragt dich nach allen notwendigen Credentials"
echo "und deployed dann automatisch auf test.matchleague.org"
echo ""

# Collect credentials
echo "📧 Email-Konfiguration:"
echo ""
read -p "SMTP Host (z.B. smtp.gmail.com): " MAIL_HOST
read -p "SMTP Port (z.B. 587): " MAIL_PORT
read -p "Email-Adresse: " MAIL_USER
read -sp "Email-Passwort (App-Password): " MAIL_PASS
echo ""
echo ""

# Generate JWT secret
echo "🔐 Generiere JWT Secret..."
JWT_SECRET=$(openssl rand -hex 32)
echo "✅ JWT Secret generiert: ${JWT_SECRET:0:16}..."
echo ""

# Confirm
echo "📋 Zusammenfassung:"
echo "   Server: test.matchleague.org"
echo "   SMTP: $MAIL_HOST:$MAIL_PORT"
echo "   Email: $MAIL_USER"
echo "   JWT: ${JWT_SECRET:0:16}..."
echo ""
read -p "Alles korrekt? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Abgebrochen."
  exit 0
fi

echo ""
echo "🔌 Verbinde zum Server..."

# First: Copy SSH key if needed
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 $USER@$SERVER exit 2>/dev/null; then
  echo "📝 SSH-Key wird zum Server kopiert..."
  echo "   Du wirst nach deiner SSH-Passphrase gefragt."
  ssh-copy-id $USER@$SERVER
  echo "✅ SSH-Key installiert"
fi

# Deploy to server
ssh -t $USER@$SERVER bash << ENDSSH
set -e

echo ""
echo "✅ Verbunden mit Server!"
echo ""

# Check if project exists
if [ ! -d /matchleague.org ]; then
  echo "❌ Projekt-Verzeichnis /matchleague.org nicht gefunden!"
  echo ""
  echo "Bitte führe erst folgende Schritte aus:"
  echo "  1. ssh $USER@$SERVER"
  echo "  2. cd /matchleague.org"
  echo "  3. git clone <repo-url> ."
  exit 1
fi

cd /matchleague.org

# Git pull
echo "📥 Pulling latest code..."
git fetch origin
git checkout dev
git pull origin dev
echo "✅ Code aktualisiert"
echo ""

# Create .env file
cd backend
echo "⚙️  Erstelle .env Datei..."

cat > .env << 'EOF'
# Test Instance Environment
INSTANCE_TYPE=test
PORT=5002
DATABASE_FILE=sportsplatform-test.db
CORS_ORIGIN=https://test.matchleague.org

# JWT Secret
JWT_SECRET=$JWT_SECRET

# Email Configuration
MAIL_HOST=$MAIL_HOST
MAIL_PORT=$MAIL_PORT
MAIL_SECURE=true
MAIL_USER=$MAIL_USER
MAIL_PASS=$MAIL_PASS
MAIL_FROM=$MAIL_USER

# Base URL
BASE_URL=https://test.matchleague.org

# Features (disabled for test)
ENABLE_LEAGUES=false
ENABLE_COMPETITIONS=false
ENABLE_BOOKINGS=false
ENABLE_VENUES=false

# Test instance
TEST_INSTANCE=true
NODE_ENV=production
MAILER_VERIFY=0
ENABLE_LINK_TESTS=0
LOG_LEVEL=debug
EOF

# Replace variables
sed -i "s|\\\$JWT_SECRET|$JWT_SECRET|g" .env
sed -i "s|\\\$MAIL_HOST|$MAIL_HOST|g" .env
sed -i "s|\\\$MAIL_PORT|$MAIL_PORT|g" .env
sed -i "s|\\\$MAIL_USER|$MAIL_USER|g" .env
sed -i "s|\\\$MAIL_PASS|$MAIL_PASS|g" .env

echo "✅ .env erstellt"
echo ""

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install --production --legacy-peer-deps 2>&1 | tail -5
echo "✅ Backend dependencies installiert"
echo ""

# Migrations
echo "🔄 Running database migrations..."
npm run migrate
echo "✅ Migrations durchgeführt"
echo ""

# Build frontend
cd ../frontend
echo "🏗️  Building frontend (Test-Instanz)..."
export REACT_APP_INSTANCE_TYPE=test
export REACT_APP_API_BASE=/api
export NODE_ENV=production

npm install --production --legacy-peer-deps 2>&1 | tail -5
npm run build 2>&1 | tail -10
echo "✅ Frontend built"
echo ""

# Stop old backend
cd ../backend
echo "🛑 Stopping old backend..."
pkill -f "node.*server.js.*5002" 2>/dev/null || echo "   (Kein Prozess gefunden)"
sleep 2

# Create logs directory
mkdir -p logs

# Start backend
echo "🚀 Starting backend on port 5002..."
PORT=5002 nohup node server.js > logs/test-server.log 2>&1 &
PID=\$!
echo "✅ Backend gestartet (PID: \$PID)"
echo ""

# Wait for startup
echo "⏳ Warte 5 Sekunden auf Backend-Start..."
sleep 5

# Health check
echo "🏥 Health Check..."
if curl -s http://localhost:5002/api/health | grep -q '"ok":true'; then
  echo "✅ Backend läuft!"
else
  echo "⚠️  Health check fehlgeschlagen"
  echo "   Logs: tail -20 logs/test-server.log"
  tail -20 logs/test-server.log
fi

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT ABGESCHLOSSEN!"
echo ""
echo "Backend läuft auf Port 5002"
echo "Logs: tail -f /matchleague.org/backend/logs/test-server.log"
echo ""

ENDSSH

# Send env vars via heredoc
ssh -t $USER@$SERVER "export JWT_SECRET='$JWT_SECRET' MAIL_HOST='$MAIL_HOST' MAIL_PORT='$MAIL_PORT' MAIL_USER='$MAIL_USER' MAIL_PASS='$MAIL_PASS'"

echo ""
echo "🎉 Deployment abgeschlossen!"
echo ""
echo "📋 Nächste Schritte:"
echo ""
echo "1. SSL-Zertifikat holen (einmalig):"
echo "   ./scripts/setup-ssl-nginx.sh"
echo ""
echo "2. Dann teste:"
echo "   https://test.matchleague.org"
echo ""
echo "Backend-Logs ansehen:"
echo "   ssh $USER@$SERVER"
echo "   tail -f /matchleague.org/backend/logs/test-server.log"
echo ""
