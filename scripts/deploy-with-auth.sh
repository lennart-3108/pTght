#!/bin/bash

# Interactive deployment script with SSH authentication

set -e

STRATO_USER="rsftp_matchle"
STRATO_HOST="ssh.strato.de"
PROJECT_ROOT="/Users/lennart/projects/match league"

echo "=========================================="
echo "Deploy Match League to Strato Server"
echo "=========================================="
echo ""

# Ask for authentication method
echo "Authentifizierungsmethode:"
echo "1. SSH-Key mit Passphrase"
echo "2. Passwort"
echo ""
read -p "Wähle (1 oder 2): " auth_method

if [ "$auth_method" = "1" ]; then
  echo ""
  echo "SSH-Key Passphrase eingeben:"
  read -sp "Passphrase: " passphrase
  echo ""
  
  # Extract SSH key path
  ssh_key_path="$HOME/.ssh/id_rsa"
  if [ ! -f "$ssh_key_path" ]; then
    echo "❌ SSH-Key nicht gefunden: $ssh_key_path"
    exit 1
  fi
  
  # Test connection with passphrase
  echo ""
  echo "✓ Teste SSH-Verbindung..."
  export SSH_PASSPHRASE="$passphrase"
  
  # Use SSH with the key
  ssh-add -t 300 "$ssh_key_path" <<< "$passphrase" 2>/dev/null || {
    echo "❌ Passphrase falsch oder SSH-Key nicht verwendbar"
    exit 1
  }
  
  # Try SSH connection
  if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$STRATO_USER@$STRATO_HOST" "echo 'SSH OK'" 2>&1 | grep -q "SSH OK"; then
    echo "✓ SSH-Verbindung erfolgreich!"
  else
    echo "❌ SSH-Verbindung fehlgeschlagen"
    exit 1
  fi
  
elif [ "$auth_method" = "2" ]; then
  echo ""
  echo "Strato-Passwort eingeben:"
  read -sp "Passwort: " password
  echo ""
  
  # Test connection with password using sshpass
  echo ""
  echo "✓ Teste SSH-Verbindung..."
  
  if ! command -v sshpass &> /dev/null; then
    echo "ℹ sshpass wird installiert..."
    brew install sshpass || {
      echo "❌ sshpass konnte nicht installiert werden"
      exit 1
    }
  fi
  
  if sshpass -p "$password" ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$STRATO_USER@$STRATO_HOST" "echo 'SSH OK'" 2>&1 | grep -q "SSH OK"; then
    echo "✓ SSH-Verbindung erfolgreich!"
  else
    echo "❌ SSH-Verbindung fehlgeschlagen - Passwort falsch?"
    exit 1
  fi
else
  echo "❌ Ungültige Wahl"
  exit 1
fi

echo ""
echo "=========================================="
echo "Instance-Typ wählen:"
echo "=========================================="
echo "1. Test-Instanz (test.matchleague.org)"
echo "2. Production-Instanz (matchleague.org)"
echo ""
read -p "Wähle (1 oder 2): " instance_type

if [ "$instance_type" = "1" ]; then
  instance_name="test"
  domain="test.matchleague.org"
  port=5002
elif [ "$instance_type" = "2" ]; then
  instance_name="production"
  domain="matchleague.org"
  port=5003
else
  echo "❌ Ungültige Wahl"
  exit 1
fi

echo ""
echo "=========================================="
echo "Deploying $instance_name instance..."
echo "Domain: $domain"
echo "Port: $port"
echo "=========================================="

# Build frontend
echo ""
echo "1️⃣ Frontend bauen..."
cd "$PROJECT_ROOT/frontend"
REACT_APP_INSTANCE_TYPE="$instance_name" npm run build > /dev/null 2>&1 || {
  echo "❌ Frontend build fehlgeschlagen"
  exit 1
}
echo "✓ Frontend gebaut"

# Prepare connection command
if [ "$auth_method" = "1" ]; then
  ssh_cmd="ssh -i $ssh_key_path"
  sftp_cmd="sftp -i $ssh_key_path"
else
  ssh_cmd="sshpass -p '$password' ssh"
  sftp_cmd="sshpass -p '$password' sftp"
fi

# Deploy
echo ""
echo "2️⃣ Dateien auf Server hochladen..."

# Create remote directories via SSH
$ssh_cmd -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$STRATO_USER@$STRATO_HOST" << EOF
mkdir -p /matchleague.org/$instance_name/{frontend,backend,scripts}
chmod 755 /matchleague.org/$instance_name
EOF

# Upload frontend build
echo "  → Frontend build..."
$sftp_cmd -r -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PROJECT_ROOT/frontend/build/" "$STRATO_USER@$STRATO_HOST:/matchleague.org/$instance_name/frontend/" > /dev/null 2>&1 || {
  echo "❌ Fehler beim Hochladen des Frontend"
  exit 1
}

# Upload backend
echo "  → Backend..."
$sftp_cmd -r -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PROJECT_ROOT/backend/" "$STRATO_USER@$STRATO_HOST:/matchleague.org/$instance_name/" > /dev/null 2>&1 || {
  echo "❌ Fehler beim Hochladen des Backend"
  exit 1
}

# Upload scripts
echo "  → Skripte..."
$sftp_cmd -r -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$PROJECT_ROOT/scripts/" "$STRATO_USER@$STRATO_HOST:/matchleague.org/$instance_name/" > /dev/null 2>&1 || {
  echo "❌ Fehler beim Hochladen der Skripte"
  exit 1
}

echo "✓ Dateien hochgeladen"

# Start services
echo ""
echo "3️⃣ Services starten..."
$ssh_cmd -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$STRATO_USER@$STRATO_HOST" << EOF
cd /matchleague.org/$instance_name/backend
npm install --production > /dev/null 2>&1
PORT=$port node server.js > /tmp/matchleague-$instance_name.log 2>&1 &
EOF

echo "✓ Services gestartet"

echo ""
echo "=========================================="
echo "✅ Deployment erfolgreich!"
echo "=========================================="
echo "Domain: https://$domain"
echo "Port: $port"
echo ""
echo "ℹ Geben Sie dem Server ~30 Sekunden Zeit, um vollständig hochzufahren."
echo ""
