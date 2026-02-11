#!/bin/bash
# Automatisches Deployment für test.matchleague.org
# Führt alle Schritte remote auf dem Strato-Server aus

set -e

SERVER="ssh.strato.de"
USER="rsftp_matchle"
PROJECT_DIR="/matchleague.org"

echo "🚀 Automatisches Test-Instance Deployment"
echo "=========================================="
echo ""
echo "Server: $USER@$SERVER"
echo "Target: test.matchleague.org"
echo ""

# Check if SSH key exists
if [ ! -f ~/.ssh/id_rsa ] && [ ! -f ~/.ssh/id_ed25519 ]; then
  echo "⚠️  Kein SSH-Key gefunden. Verbindung mit Passwort..."
fi

echo "Verbinde zum Server..."
echo ""

# Execute all commands on remote server
ssh -t $USER@$SERVER << 'ENDSSH'
set -e

echo "✅ Verbunden mit Server!"
echo ""

# Navigate to project
cd /matchleague.org || {
  echo "❌ Projekt-Verzeichnis nicht gefunden!"
  echo "   Erstelle /matchleague.org erst..."
  exit 1
}

# Git pull
echo "📥 Pulling latest code..."
git fetch origin
git checkout dev
git pull origin dev
echo "✅ Code aktualisiert"
echo ""

# Backend setup
cd backend

# Create .env if not exists
if [ ! -f .env ]; then
  echo "⚙️  Erstelle .env Datei..."
  cp .env.test.example .env
  
  # Generate JWT secret
  JWT_SECRET=$(openssl rand -hex 32)
  
  # Replace placeholders
  sed -i "s/your-jwt-secret-change-in-production/$JWT_SECRET/" .env
  
  echo "✅ .env erstellt"
  echo ""
  echo "⚠️  WICHTIG: Bitte diese Werte in .env manuell setzen:"
  echo "   - MAIL_USER (Email-Adresse)"
  echo "   - MAIL_PASS (Email-Passwort)"
  echo "   - MAIL_HOST (SMTP Server)"
  echo ""
  echo "Drücke ENTER wenn du das gemacht hast, oder CTRL+C zum Abbrechen"
  read -r
fi

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install --production
echo "✅ Backend dependencies installiert"
echo ""

# Run migrations
echo "🔄 Running database migrations..."
npm run migrate
echo "✅ Migrations durchgeführt"
echo ""

# Build frontend
cd ../frontend

echo "🏗️  Building frontend for test instance..."
export REACT_APP_INSTANCE_TYPE=test
export REACT_APP_API_BASE=/api
export NODE_ENV=production

npm install --production
npm run build
echo "✅ Frontend built"
echo ""

# Stop old backend
echo "🛑 Stopping old backend process..."
pkill -f "node.*server.js.*5002" || echo "   (Kein laufender Prozess gefunden)"
sleep 2

# Start backend
cd ../backend
echo "🚀 Starting backend on port 5002..."
PORT=5002 nohup node server.js > logs/test-server.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend gestartet (PID: $BACKEND_PID)"
echo ""

# Wait for backend to start
echo "⏳ Warte auf Backend-Start..."
sleep 5

# Health check
if curl -s http://localhost:5002/api/health | grep -q '"ok":true'; then
  echo "✅ Backend läuft!"
else
  echo "⚠️  Backend health check fehlgeschlagen"
  echo "   Logs: tail -f /matchleague.org/backend/logs/test-server.log"
fi

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT ABGESCHLOSSEN!"
echo ""
echo "🌐 URL: https://test.matchleague.org"
echo "📝 Logs: tail -f /matchleague.org/backend/logs/test-server.log"
echo ""
echo "⚠️  NÄCHSTER SCHRITT:"
echo "   1. Nginx-Config aktivieren (falls noch nicht geschehen)"
echo "   2. SSL-Zertifikat holen mit certbot"
echo ""

ENDSSH

echo ""
echo "🎉 Deployment-Script auf Server ausgeführt!"
echo ""
echo "📋 Was fehlt noch (einmalig):"
echo ""
echo "1. SSL-Zertifikat holen:"
echo "   ssh $USER@$SERVER"
echo "   sudo certbot --nginx -d test.matchleague.org"
echo ""
echo "2. Nginx-Config aktivieren:"
echo "   sudo cp /matchleague.org/nginx-multi-instance.conf /etc/nginx/sites-available/matchleague"
echo "   sudo ln -s /etc/nginx/sites-available/matchleague /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
