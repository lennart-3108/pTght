#!/bin/bash
# Deploy fixed backend files to test instance

BACKEND_SRC="/Users/lennart/projects/match league/backend"

echo "=== Deploying Backend Fixes to Test Instance ==="

lftp -u rsftp_matchle,Sursee.2026 ftp://82.165.134.166 <<'LFTP'
set net:max-retries 2
set net:timeout 30

cd /matchleague.org/test/backend

echo "Uploading src/config.js..."
put -O src /Users/lennart/projects/match\ league/backend/src/config.js

echo "Uploading src/routes/auth.js..."
put -O src/routes /Users/lennart/projects/match\ league/backend/src/routes/auth.js

echo "Files uploaded successfully!"
ls -la src/config.js
ls -la src/routes/auth.js

bye
LFTP

echo ""
echo "✓ Backend fixes uploaded to test instance"
echo ""
echo "⚠️  WICHTIG: Backend muss neu gestartet werden!"
echo "Der Server muss neugestartet werden, damit die Änderungen wirksam werden."
echo ""
echo "Falls du Server-Zugriff hast:"
echo "  ssh rsftp_matchle@ssh.strato.de"
echo "  cd /matchleague.org/test/backend"
echo "  pkill -f 'node server.js'"
echo "  PORT=5002 INSTANCE_TYPE=test node server.js &"
echo ""
echo "ODER: Server-Neustart via Strato Admin Panel"
