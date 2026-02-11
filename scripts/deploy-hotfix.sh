#!/bin/bash
# Quick deployment of backend to test instance  
# Excludes node_modules - auto-installed on server

LFTP_USER="rsftp_matchle"
LFTP_PASS="Sursee.2026"
LFTP_HOST="82.165.134.166"

echo "=== Quick Backend Deploy to Test Instance ==="

lftp -u "$LFTP_USER,$LFTP_PASS" "ftp://$LFTP_HOST" <<'LFTP_SCRIPT'
set net:max-retries 2
set net:timeout 30

cd /matchleague.org/test/backend

echo "Uploading auth.js..."
put -O src/routes /Users/lennart/projects/match\ league/backend/src/routes/auth.js

echo "Deployment complete - restart backend to apply changes"
bye
LFTP_SCRIPT

echo ""
echo "✓ Backend auth.js updated on test instance"
echo "Next: Restart backend on server (if not auto-restarting)"
