#!/bin/bash
# Update .env auf dem Server mit Email-Config von Dev

echo "📧 Email-Config von Dev übernehmen"
echo "===================================="
echo ""
echo "Dieses Script kopiert die Email-Config von deinem"
echo "laufenden Dev-Server zu Test-Instanz"
echo ""
echo "Du musst dich gleich per SSH einloggen"
echo ""

read -p "Fortfahren? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  exit 0
fi

echo ""
echo "Verbinde zum Server..."
echo "Bitte SSH-Passphrase eingeben wenn gefragt:"
echo ""

ssh -t rsftp_matchle@ssh.strato.de << 'ENDSSH'
set -e

cd /matchleague.org/backend

echo ""
echo "✅ Auf Server eingeloggt"
echo ""

# Backup current .env
if [ -f .env ]; then
  cp .env .env.backup
  echo "📦 Backup erstellt: .env.backup"
fi

# Check if dev .env exists (assumption: same path)
if [ ! -f .env ]; then
  echo "❌ Keine .env gefunden"
  echo ""
  echo "Bitte erstelle eine .env Datei manuell:"
  echo "  nano .env"
  exit 1
fi

echo ""
echo "📋 Aktuelle Email-Config:"
grep -E "^MAIL_" .env || echo "  (Keine MAIL_ Variablen gefunden)"
echo ""

# Get current config
MAIL_HOST=$(grep "^MAIL_HOST=" .env | cut -d= -f2)
MAIL_PORT=$(grep "^MAIL_PORT=" .env | cut -d= -f2)
MAIL_USER=$(grep "^MAIL_USER=" .env | cut -d= -f2)
MAIL_PASS=$(grep "^MAIL_PASS=" .env | cut -d= -f2)

if [ -z "$MAIL_HOST" ]; then
  echo "⚠️  Email nicht konfiguriert in Dev"
  echo ""
  echo "Möchtest du die Werte jetzt eingeben?"
  read -p "SMTP Host: " MAIL_HOST
  read -p "SMTP Port: " MAIL_PORT  
  read -p "Email: " MAIL_USER
  read -sp "Passwort: " MAIL_PASS
  echo ""
fi

echo ""
echo "✅ Email-Config gefunden:"
echo "   Host: $MAIL_HOST"
echo "   Port: $MAIL_PORT"
echo "   User: $MAIL_USER"
echo ""

# Update .env with correct values for test instance
sed -i "s|^MAIL_HOST=.*|MAIL_HOST=$MAIL_HOST|" .env
sed -i "s|^MAIL_PORT=.*|MAIL_PORT=$MAIL_PORT|" .env
sed -i "s|^MAIL_USER=.*|MAIL_USER=$MAIL_USER|" .env
sed -i "s|^MAIL_PASS=.*|MAIL_PASS=$MAIL_PASS|" .env

# Also update other critical values for test
sed -i "s|^PORT=.*|PORT=5002|" .env
sed -i "s|^INSTANCE_TYPE=.*|INSTANCE_TYPE=test|" .env
sed -i "s|^BASE_URL=.*|BASE_URL=https://test.matchleague.org|" .env
sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://test.matchleague.org|" .env

echo "✅ .env aktualisiert für Test-Instanz"
echo ""

# Restart backend
echo "🔄 Starte Backend neu..."
pkill -f "node.*server.js.*5002" 2>/dev/null || echo "   (Kein Prozess lief)"
sleep 2

mkdir -p logs
PORT=5002 nohup node server.js > logs/test-server.log 2>&1 &
PID=$!

echo "✅ Backend gestartet (PID: $PID)"
echo ""

sleep 5

# Health check
if curl -s http://localhost:5002/api/health | grep -q '"ok":true'; then
  echo "✅ Backend läuft mit Email-Config!"
else
  echo "⚠️  Backend läuft nicht - siehe logs:"
  tail -20 logs/test-server.log
fi

echo ""
echo "=========================================="
echo "✅ Email-Config aktualisiert!"
echo ""
echo "Test Email-Versand mit:"
echo "  curl -X POST http://localhost:5002/api/test-email"
echo ""

ENDSSH

echo ""
echo "🎉 Fertig!"
echo ""
