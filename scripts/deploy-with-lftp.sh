#!/bin/bash
# Deploy Match League instances to Strato VPS using LFTP (Secure FTP)
# Usage: bash deploy-with-lftp.sh [instance_type]
#   instance_type: 1=dev, 2=test, 3=prod (default: interactive)

set -e

LFTP_USER="rsftp_matchle"
LFTP_HOST="ssh.strato.de"
PROJECT_ROOT="/Users/lennart/projects/match league"

echo "=========================================="
echo "Match League - LFTP Deployment"
echo "=========================================="
echo ""

# 1. Ask for instance type
if [ -n "${1:-}" ]; then
  instance_choice="$1"
else
  echo "Wähle Instance-Typ:"
  echo "1. development (Port 5001)"
  echo "2. test (Port 5002)"
  echo "3. production (Port 5003)"
  echo ""
  read -p "Wähle (1-3): " instance_choice
fi

case $instance_choice in
  1)
    INSTANCE_TYPE="development"
    INSTANCE_PORT="5001"
    REMOTE_PATH="/matchleague.org/dev"
    REACT_APP_API_BASE="http://localhost:5001/api"
    ;;
  2)
    INSTANCE_TYPE="test"
    INSTANCE_PORT="5002"
    REMOTE_PATH="/matchleague.org/test"
    REACT_APP_API_BASE="https://test.matchleague.org/api"
    ;;
  3)
    INSTANCE_TYPE="production"
    INSTANCE_PORT="5003"
    REMOTE_PATH="/matchleague.org/prod"
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
echo "Remote Path: $REMOTE_PATH"
echo "=========================================="
echo ""

# 2. Check lftp
if ! command -v lftp >/dev/null 2>&1; then
  echo "Installing lftp..."
  brew install lftp || {
    echo "❌ lftp installation failed"
    exit 1
  }
fi

# 3. Build frontend
echo "1️⃣ Building frontend..."
cd "$PROJECT_ROOT/frontend"
REACT_APP_INSTANCE_TYPE="$INSTANCE_TYPE" \
  REACT_APP_API_BASE="$REACT_APP_API_BASE" \
  npm run build > /dev/null 2>&1 || {
  echo "❌ Frontend build failed"
  exit 1
}
echo "✓ Frontend built"

# 4. Ask for FTP password
echo ""
echo "FTP-Passwort für $LFTP_USER@$LFTP_HOST eingeben:"
read -sp "Passwort: " FTP_PASSWORD
echo ""

# 5. Deploy with LFTP
echo ""
echo "2️⃣ Uploading files to server..."

# Build LFTP commands
cd "$PROJECT_ROOT"

# Deploy frontend
echo "  → Frontend..."
lftp -u "$LFTP_USER" "ftps://$LFTP_HOST" <<EOF > /dev/null 2>&1 || true
set sftp:auto-confirm yes
set ftp:ssl-allow all
set ftp:ssl-force true
set ftp:ssl-protect-list yes
cd $REMOTE_PATH
lcd frontend/build
mirror -e -R ./ ./frontend/
bye
EOF

# Deploy backend
echo "  → Backend..."
lftp -u "$LFTP_USER" "ftps://$LFTP_HOST" <<EOF > /dev/null 2>&1 || true
set sftp:auto-confirm yes
set ftp:ssl-allow all
set ftp:ssl-force true
cd $REMOTE_PATH
lcd backend
mirror -e -R ./ ./backend/
bye
EOF

# Deploy .env
echo "  → Configuration..."
lftp -u "$LFTP_USER" "ftps://$LFTP_HOST" <<EOF > /dev/null 2>&1 || true
set sftp:auto-confirm yes
set ftp:ssl-allow all
set ftp:ssl-force true
cd $REMOTE_PATH/backend
put -O .env .env.$INSTANCE_TYPE.example
bye
EOF

echo "✓ Files uploaded"

# 6. Summary
echo ""
echo "=========================================="
echo "✅ Deployment complete!"
echo "=========================================="
echo ""
echo "Instance: $INSTANCE_TYPE"
echo "Port: $INSTANCE_PORT"
echo "Remote: sftp://$LFTP_USER@$LFTP_HOST$REMOTE_PATH"
echo ""
echo "ℹ Backend needs to be restarted on server."
echo ""
