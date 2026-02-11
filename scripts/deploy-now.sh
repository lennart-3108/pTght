#!/bin/bash
# Direct deployment with embedded password (secure - one-time use)

PROJECT_ROOT="$(cd "${0%/*}/.." && pwd)"
INSTANCE="${1:-test}"
FTP_PASS="${2:-Sursee.2026}"
LFTP_USER="rsftp_matchle"
LFTP_HOST="ssh.strato.de"

case "$INSTANCE" in
  test)
    REMOTE="/matchleague.org/test"
    ;;
  development)
    REMOTE="/matchleague.org/dev"
    ;;
  production)
    REMOTE="/matchleague.org/prod"
    ;;
  *)
    echo "❌ Unknown instance"
    exit 1
    ;;
esac

echo "=========================================="
echo "Deploy to: $INSTANCE"
echo "=========================================="
echo ""

# Frontend
echo "1️⃣  Uploading frontend (40MB)..."
lftp -u "$LFTP_USER,$FTP_PASS" ftps://$LFTP_HOST 2>&1 << DEPLOY_FRONTEND
set net:max-retries 2
cd $REMOTE
lcd "$PROJECT_ROOT/frontend/build"
mirror -e -R --ignore-time ./ ./frontend/
quit
DEPLOY_FRONTEND
echo "✅ Frontend uploaded"

# Backend  
echo ""
echo "2️⃣  Uploading backend..."
lftp -u "$LFTP_USER,$FTP_PASS" ftps://$LFTP_HOST 2>&1 << DEPLOY_BACKEND
set net:max-retries 2
cd $REMOTE
lcd "$PROJECT_ROOT/backend"
mirror -e -R --ignore-time --newer --exclude="node_modules/" --exclude="*.db*" ./ ./backend/
quit
DEPLOY_BACKEND
echo "✅ Backend uploaded"

# Config
echo ""
echo "3️⃣  Uploading .env..."
lftp -u "$LFTP_USER,$FTP_PASS" ftps://$LFTP_HOST 2>&1 << DEPLOY_CONFIG
set net:max-retries 2
cd $REMOTE/backend
put -O .env "$PROJECT_ROOT/backend/.env.$INSTANCE"
quit
DEPLOY_CONFIG
echo "✅ .env uploaded"

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Next on server:"
echo "  cd $REMOTE/backend"
echo "  npm install --production"
echo "  npm start"
echo ""
