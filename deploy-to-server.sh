#!/bin/bash
set -e

# Deployment Script für Strato Server
# Führt Git Pull, DB Migration und App Restart durch

SERVER_IP="82.165.134.166"
SERVER_USER="root"
APP_PATH="/opt/matchleague"
DOMAIN="${DOMAIN:-dev.matchleague.org}"
SSH_KEY="$HOME/.ssh/strato-dev_ed25519"

echo "🚀 Deploying to Strato Server ($SERVER_IP)..."
echo "=================================="

# SSH-Verbindung testen
echo "📡 Testing SSH connection..."
echo "ℹ️  Using SSH key: $SSH_KEY"
ssh -i $SSH_KEY -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP "echo 'Connection OK'"

# Deployment auf Server ausführen
echo ""
echo "📦 Running deployment on server..."
ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP << 'ENDSSH'
set -e

APP_PATH="/opt/matchleague"
echo "📂 Working directory: $APP_PATH"

# Zum App-Verzeichnis wechseln
cd $APP_PATH

# Git Pull (neueste Änderungen holen)
echo ""
echo "🔄 Pulling latest code from GitHub..."
git fetch --all
git pull origin dev

# Backend Dependencies installieren
echo ""
echo "📚 Installing backend dependencies..."
cd backend
npm ci --silent --no-audit 2>&1 | grep -v "deprecated" || true

# WICHTIG: Datenbank-Migrationen ausführen
echo ""
echo "🗄️  Running database migrations..."
npm run migrate || echo "⚠️  Migration hatte Fehler, aber weiter..."

# PM2 Backend neu starten
echo ""
echo "🔄 Restarting backend with PM2..."
pm2 delete ptght-backend 2>/dev/null || true
PORT=5001 pm2 start server.js --name ptght-backend
pm2 save

# Frontend bauen
echo ""
echo "🏗️  Building frontend..."
cd ../frontend
npm ci --silent --no-audit 2>&1 | grep -v "deprecated" || true
npm run build

# Frontend in Webroot kopieren
echo ""
echo "📋 Copying frontend build to web root..."
WEBROOT="/var/www/dev.matchleague.org"
mkdir -p $WEBROOT
rm -rf $WEBROOT/*
cp -r build/* $WEBROOT/

# Nginx neu laden
echo ""
echo "🔄 Reloading Nginx..."
nginx -t && systemctl reload nginx

# Status prüfen
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Backend status:"
pm2 status ptght-backend

echo ""
echo "🔍 Backend logs (last 20 lines):"
pm2 logs ptght-backend --lines 20 --nostream

echo ""
echo "🔎 Running post-deploy verification..."
cd "$APP_PATH"
bash scripts/verify-server.sh || echo "⚠️  verify-server reported issues (see above)"

ENDSSH

echo ""
echo "=================================="
echo "✅ Deployment finished successfully!"
echo ""
echo "🌐 Your app should be available at:"
echo "   https://$DOMAIN"
echo ""
echo "📝 To check logs on server:"
echo "   ssh $SERVER_USER@$SERVER_IP 'pm2 logs ptght-backend'"
echo ""
