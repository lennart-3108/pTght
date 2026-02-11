#!/bin/bash
# Safe local deployment - password never leaves your machine

set -e

PROJECT_ROOT="$(cd "${0%/*}/.." && pwd)"
INSTANCE="${1:-test}"
LFTP_USER="rsftp_matchle"
LFTP_HOST="ssh.strato.de"

case "$INSTANCE" in
  test)
    REMOTE_PATH="/matchleague.org/test"
    ;;
  development)
    REMOTE_PATH="/matchleague.org/dev"
    ;;
  production)
    REMOTE_PATH="/matchleague.org/prod"
    ;;
  *)
    echo "❌ Unknown instance: $INSTANCE"
    exit 1
    ;;
esac

echo "=========================================="
echo "Match League - Safe Local Deployment"
echo "=========================================="
echo ""
echo "Instance: $INSTANCE"
echo "Remote: $REMOTE_PATH"
echo ""

# 1. Build Frontend
echo "1️⃣  Building frontend..."
cd "$PROJECT_ROOT/frontend"
REACT_APP_INSTANCE_TYPE="$INSTANCE" npm run build > /dev/null 2>&1
if [ ! -d build ]; then
  echo "❌ Frontend build failed"
  exit 1
fi
echo "✅ Frontend built ($(du -sh build | cut -f1))"

# 2. Get password
echo ""
echo "2️⃣  FTP Credentials"
echo ""
read -sp "FTP Password for $LFTP_USER@$LFTP_HOST: " FTP_PASSWORD
echo ""
echo ""

# 3. Deploy Frontend
echo "3️⃣  Uploading Frontend..."
lftp -u "$LFTP_USER,$FTP_PASSWORD" ftps://$LFTP_HOST << 'LFTP_FRONTEND'
set sftp:auto-confirm yes
set net:max-retries 2
cd /matchleague.org/test
lcd build
mirror -e -R --ignore-time ./ ./frontend/
quit
LFTP_FRONTEND
if [ $? -eq 0 ]; then
  echo "✅ Frontend uploaded"
else
  echo "❌ Frontend upload failed - check password"
  exit 1
fi

# 4. Deploy Backend
echo ""
echo "4️⃣  Uploading Backend..."
lftp -u "$LFTP_USER,$FTP_PASSWORD" ftps://$LFTP_HOST << 'LFTP_BACKEND'
set sftp:auto-confirm yes
set net:max-retries 2
cd /matchleague.org/test
lcd backend
mirror -e -R --ignore-time --newer --exclude="node_modules/" --exclude="*.db*" ./ ./backend/
quit
LFTP_BACKEND
if [ $? -eq 0 ]; then
  echo "✅ Backend uploaded"
else
  echo "⚠️  Backend upload skipped"
fi

# 5. Deploy Config
echo ""
echo "5️⃣  Uploading Configuration (.env)..."
lftp -u "$LFTP_USER,$FTP_PASSWORD" ftps://$LFTP_HOST << 'LFTP_CONFIG'
set sftp:auto-confirm yes
set net:max-retries 2
cd /matchleague.org/test/backend
put -O .env .env.test
quit
LFTP_CONFIG
echo "✅ Configuration uploaded"

# 6. Summary
echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "🌐 Instance: https://$(echo $INSTANCE | sed 's/production/matchleague/g').matchleague.org"
echo "📂 Backend path: $REMOTE_PATH/backend"
echo ""
echo "Next: SSH to server and run:"
echo "  cd $REMOTE_PATH/backend"
echo "  npm install --production"
echo "  npm start"
echo ""
