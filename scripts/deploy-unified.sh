#!/bin/bash
# Universal deployment script for all instances (dev, test, production)
# Supports SSH authentication with passphrase or password
# Usage: bash deploy-unified.sh [instance_type] [auth_method]
#   instance_type: 1=dev, 2=test, 3=prod (default: interactive)
#   auth_method: 1=ssh-key, 2=password (default: interactive)
# SICHER: Passphrases werden interaktiv eingegeben, nicht als Argumente

set -e

STRATO_USER="rsftp_matchle"
STRATO_HOST="ssh.strato.de"
PROJECT_ROOT="/Users/lennart/projects/match league"

echo "=========================================="
echo "Match League - Unified Deployment"
echo "=========================================="
echo ""

# 1. Ask for instance type (or use argument)
if [ -n "${1:-}" ]; then
  instance_choice="$1"
else
  echo "Wähle Instance-Typ:"
  echo "1. development (localhost, Port 5001)"
  echo "2. test (test.matchleague.org, Port 5002)"
  echo "3. production (matchleague.org, Port 5003)"
  echo ""
  read -p "Wähle (1-3): " instance_choice
fi

case $instance_choice in
  1)
    INSTANCE_TYPE="development"
    INSTANCE_PORT="5001"
    INSTANCE_PATH="/opt/matchleague-dev"
    REACT_APP_API_BASE="http://localhost:5001/api"
    ;;
  2)
    INSTANCE_TYPE="test"
    INSTANCE_PORT="5002"
    INSTANCE_PATH="/opt/matchleague-test"
    REACT_APP_API_BASE="https://test.matchleague.org/api"
    ;;
  3)
    INSTANCE_TYPE="production"
    INSTANCE_PORT="5003"
    INSTANCE_PATH="/opt/matchleague-prod"
    REACT_APP_API_BASE="https://matchleague.org/api"
    ;;
  *)
    echo "❌ Ungültige Wahl"
    exit 1
    ;;
esac

echo ""
echo "=========================================="
echo "Instance: $INSTANCE_TYPE"
echo "Port: $INSTANCE_PORT"
echo "=========================================="
echo ""

# 2. For development, deploy locally
if [ "$INSTANCE_TYPE" = "development" ]; then
  echo "ℹ Development wird lokal deployed (kein SSH nötig)"
  echo ""
  
  # Just start the local dev server
  cd "$PROJECT_ROOT"
  bash scripts/dev-start.sh
  exit 0
fi

# 3. For test/production, ask for authentication
echo "Authentifizierung für Strato Server:"
echo "1. SSH-Key mit Passphrase"
echo "2. Passwort"
echo ""

if [ -n "${2:-}" ]; then
  auth_method="$2"
else
  read -p "Wähle (1 oder 2): " auth_method
fi

if [ "$auth_method" = "1" ]; then
  echo ""
  echo "SSH-Key Passphrase eingeben:"
  read -sp "Passphrase: " SSH_PASSPHRASE
  echo ""
  
  # Try common SSH key locations
  if [ -f "$HOME/.ssh/id_ed25519" ]; then
    ssh_key_path="$HOME/.ssh/id_ed25519"
  elif [ -f "$HOME/.ssh/id_rsa" ]; then
    ssh_key_path="$HOME/.ssh/id_rsa"
  else
    echo "❌ SSH-Key nicht gefunden: ~/.ssh/id_rsa oder ~/.ssh/id_ed25519"
    exit 1
  fi
  
  # Add SSH key with passphrase
  eval "$(ssh-agent -s)" > /dev/null
  ssh-add -t 300 "$ssh_key_path" <<< "$SSH_PASSPHRASE" 2>/dev/null || {
    echo "❌ Passphrase falsch"
    exit 1
  }
  
  ssh_cmd="ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no"
  sftp_cmd="sftp -o ConnectTimeout=5 -o StrictHostKeyChecking=no"
  
elif [ "$auth_method" = "2" ]; then
  echo ""
  echo "Strato-Passwort eingeben:"
  read -sp "Passwort: " STRATO_PASSWORD
  echo ""
  
  # Check if sshpass is available
  if ! command -v sshpass &> /dev/null; then
    echo "ℹ sshpass wird installiert..."
    brew install sshpass || {
      echo "❌ sshpass installation failed"
      exit 1
    }
  fi
  
  ssh_cmd="sshpass -p '$STRATO_PASSWORD' ssh"
  sftp_cmd="sshpass -p '$STRATO_PASSWORD' sftp"
else
  echo "❌ Ungültige Wahl"
  exit 1
fi

echo ""
echo "✓ Teste SSH-Verbindung..."

# Test connection
$ssh_cmd "$STRATO_USER@$STRATO_HOST" "echo 'OK'" > /dev/null 2>&1 || {
  echo "❌ SSH-Verbindung fehlgeschlagen"
  exit 1
}

echo "✓ SSH-Verbindung erfolgreich!"
echo ""

# 4. Build frontend
echo "1️⃣ Frontend bauen..."
cd "$PROJECT_ROOT/frontend"
REACT_APP_INSTANCE_TYPE="$INSTANCE_TYPE" \
  REACT_APP_API_BASE="$REACT_APP_API_BASE" \
  npm run build > /dev/null 2>&1 || {
  echo "❌ Frontend build fehlgeschlagen"
  exit 1
}
echo "✓ Frontend gebaut"

# 5. Deploy to remote server
echo ""
echo "2️⃣ Dateien zu Server hochladen..."

# Create remote directories
$ssh_cmd "$STRATO_USER@$STRATO_HOST" "mkdir -p $INSTANCE_PATH/{frontend,backend,scripts,data} && chmod 755 $INSTANCE_PATH" > /dev/null 2>&1 || {
  echo "❌ Fehler beim Erstellen von Remote-Verzeichnissen"
  exit 1
}

# Upload frontend build
echo "  → Frontend build..."
cd "$PROJECT_ROOT"
$sftp_cmd -r "$STRATO_USER@$STRATO_HOST:$INSTANCE_PATH/frontend/" > /dev/null 2>&1 << EOF
rm -rf *
quit
EOF

$sftp_cmd -r "$STRATO_USER@$STRATO_HOST:$INSTANCE_PATH/" > /dev/null 2>&1 << EOF
cd $INSTANCE_PATH
put -r frontend/build/* frontend/
quit
EOF

# Upload backend
echo "  → Backend..."
$sftp_cmd -r "$STRATO_USER@$STRATO_HOST:$INSTANCE_PATH/" > /dev/null 2>&1 << EOF
cd $INSTANCE_PATH
put -r backend/* backend/
quit
EOF

# Upload .env for this instance
echo "  → Konfiguration..."
$sftp_cmd "$STRATO_USER@$STRATO_HOST" > /dev/null 2>&1 << EOF
cd $INSTANCE_PATH/backend
put backend/.env.$INSTANCE_TYPE.example .env
quit
EOF

echo "✓ Dateien hochgeladen"

# 6. Start/restart services
echo ""
echo "3️⃣ Services starten..."

$ssh_cmd "$STRATO_USER@$STRATO_HOST" << EOF 2>&1 | grep -v "^\s*$" || true
# Kill old process if running
pkill -f "PORT=$INSTANCE_PORT" || true
sleep 1

# Install backend deps and start
cd $INSTANCE_PATH/backend
npm install --production > /dev/null 2>&1 || true
PORT=$INSTANCE_PORT node server.js > /tmp/matchleague-$INSTANCE_TYPE.log 2>&1 &

sleep 2
echo "✓ Backend gestartet auf Port $INSTANCE_PORT"
EOF

echo ""
echo "=========================================="
echo "✅ Deployment erfolgreich!"
echo "=========================================="
echo ""
echo "Instance: https://$INSTANCE_TYPE.matchleague.org"
echo "Port: $INSTANCE_PORT"
echo ""
echo "ℹ Geben Sie dem Server ~30 Sekunden Zeit zum Hochfahren."
echo ""
