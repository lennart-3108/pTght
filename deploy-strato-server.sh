#!/bin/bash
# Quick Deploy Script für Strato Dev-Server
# Verwendung: Dieses Script manuell auf dem Server ausführen

set -e

echo "🚀 STRATO DEV SERVER DEPLOYMENT"
echo "================================"
echo ""

# Check if we're on the server
if [ ! -d "/matchleague.org" ]; then
  echo "❌ Fehler: Dieses Script muss auf dem Strato-Server ausgeführt werden!"
  echo "   Pfad /matchleague.org nicht gefunden"
  exit 1
fi

cd /matchleague.org

echo "📥 1/5 - Code aktualisieren..."
git fetch origin
git checkout dev
git pull origin dev
echo "✅ Code aktualisiert"
echo ""

echo "📦 2/5 - Backend Dependencies installieren..."
cd backend
npm install --production --silent
echo "✅ Backend Dependencies installiert"
echo ""

echo "📦 3/5 - Frontend Dependencies installieren..."
cd ../frontend
npm install --production --silent  
echo "✅ Frontend Dependencies installiert"
echo ""

echo "🔄 4/5 - Backend neu starten..."
cd /matchleague.org/backend
pkill -f "node.*server.js" 2>/dev/null || echo "   (Backend lief nicht)"
sleep 3
nohup node server.js > server.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend gestartet (PID: $BACKEND_PID)"
echo ""

echo "⏳ 5/5 - Warte auf Backend-Start..."
sleep 5

# Test backend health
if curl -s http://localhost:5001/api/health | grep -q '"ok":true'; then
  echo "✅ Backend läuft und antwortet"
else
  echo "⚠️  Backend antwortet nicht - prüfe Logs:"
  echo "   tail -f /matchleague.org/backend/server.log"
fi

echo ""
echo "================================"
echo "✅ DEPLOYMENT ABGESCHLOSSEN"
echo ""
echo "📊 Status-Check:"
echo "   Frontend: https://dev.matchleague.org"
echo "   Backend Health: https://dev.matchleague.org/api/health"
echo ""
echo "📝 Logs anzeigen:"
echo "   tail -f /matchleague.org/backend/server.log"
echo ""
