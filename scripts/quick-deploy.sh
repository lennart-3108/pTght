#!/bin/bash
# Quick Deploy - ohne Email-Config
# Email kann später in .env auf dem Server gesetzt werden

set -e

SERVER="ssh.strato.de"
USER="rsftp_matchle"

echo "🚀 Match League - Quick Deploy (ohne Email)"
echo "============================================="
echo ""
echo "Deployed test.matchleague.org"
echo "Email-Config kann später gesetzt werden"
echo ""

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)
echo "🔐 JWT Secret generiert"
echo ""

read -p "Fortfahren? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Abgebrochen."
  exit 0
fi

# Copy SSH key if needed
echo "🔌 Verbinde zum Server..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 $USER@$SERVER exit 2>/dev/null; then
  echo "📝 SSH-Key wird kopiert (Passphrase eingeben)..."
  ssh-copy-id $USER@$SERVER
fi

# Execute deployment on server
ssh -t $USER@$SERVER "JWT_SECRET='$JWT_SECRET'" 'bash -s' << 'ENDSSH'
set -e

JWT_SECRET="${JWT_SECRET}"

echo ""
echo "✅ Verbunden!"
echo ""

cd /matchleague.org || exit 1

# Git pull
echo "📥 Git pull..."
git fetch origin
git checkout dev  
git pull origin dev
echo "✅ Code aktualisiert"
echo ""

# Backend .env
cd backend
echo "⚙️  Erstelle .env..."

cat > .env << EOF
INSTANCE_TYPE=test
PORT=5002
DATABASE_FILE=sportsplatform-test.db
CORS_ORIGIN=https://test.matchleague.org

JWT_SECRET=${JWT_SECRET}

# Email (TODO: später konfigurieren)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=true
MAIL_USER=noreply@matchleague.org
MAIL_PASS=CHANGE_ME
MAIL_FROM=Match League <noreply@matchleague.org>

BASE_URL=https://test.matchleague.org

ENABLE_LEAGUES=false
ENABLE_COMPETITIONS=false
ENABLE_BOOKINGS=false
ENABLE_VENUES=false

TEST_INSTANCE=true
NODE_ENV=production
MAILER_VERIFY=0
ENABLE_LINK_TESTS=0
LOG_LEVEL=debug
EOF

echo "✅ .env erstellt (Email: TODO)"
echo ""

# Dependencies
echo "📦 Backend dependencies..."
npm install --production --legacy-peer-deps 2>&1 | tail -3
echo "✅ Backend deps OK"
echo ""

# Migrations
echo "🔄 Migrations..."
npm run migrate 2>&1 | tail -3
echo "✅ Migrations OK"
echo ""

# Frontend build
cd ../frontend
echo "🏗️  Frontend build..."
REACT_APP_INSTANCE_TYPE=test REACT_APP_API_BASE=/api NODE_ENV=production npm install --production --legacy-peer-deps 2>&1 | tail -3
REACT_APP_INSTANCE_TYPE=test REACT_APP_API_BASE=/api NODE_ENV=production npm run build 2>&1 | tail -5
echo "✅ Frontend built"
echo ""

# Restart backend
cd ../backend
echo "🛑 Stop old backend..."
pkill -f "node.*server.js.*5002" 2>/dev/null || true
sleep 2

mkdir -p logs

echo "🚀 Start backend..."
PORT=5002 nohup node server.js > logs/test-server.log 2>&1 &
echo "✅ Backend gestartet (PID: $!)"
echo ""

sleep 5

echo "🏥 Health check..."
if curl -s http://localhost:5002/api/health | grep -q '"ok":true'; then
  echo "✅ Backend läuft!"
else
  echo "⚠️  Health check failed - siehe logs"
  tail -10 logs/test-server.log
fi

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT FERTIG!"
echo ""
echo "📝 TODO: Email konfigurieren"
echo "   ssh $USER@$SERVER"
echo "   nano /matchleague.org/backend/.env"
echo "   # Setze MAIL_USER und MAIL_PASS"
echo "   # Dann: pkill -f 'node.*5002' && PORT=5002 nohup node server.js > logs/test-server.log 2>&1 &"
echo ""

ENDSSH

echo ""
echo "🎉 Backend läuft auf dem Server!"
echo ""
echo "📋 Nächste Schritte:"
echo ""
echo "1. SSL & Nginx Setup (einmalig):"
echo "   ./scripts/setup-ssl-nginx.sh"
echo ""
echo "2. Email konfigurieren:"
echo "   ssh $USER@$SERVER"
echo "   nano /matchleague.org/backend/.env"
echo "   # MAIL_USER und MAIL_PASS setzen"
echo ""
echo "3. Backend neu starten:"
echo "   pkill -f 'node.*5002'"  
echo "   cd /matchleague.org/backend"
echo "   PORT=5002 nohup node server.js > logs/test-server.log 2>&1 &"
echo ""
