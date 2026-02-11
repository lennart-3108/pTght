#!/bin/bash
# Robust LFTP deployment

PASS="Sursee.2026"
USER="rsftp_matchle"
HOST="ssh.strato.de"
PROJ="/Users/lennart/projects/match league"

cd "$PROJ"

echo "=========================================="
echo "Deploying TEST instance"
echo "=========================================="

# Create single LFTP session for all ops
lftp -u $USER,$PASS ftps://$HOST << 'LFTP_SESSION'
# Frontend
echo "📤 Frontend..."
cd /matchleague.org/test/frontend
lcd $PROJ/frontend/build
mirror -e -R -L ./ ./
cd /matchleague.org/test

# Backend
echo "📤 Backend..."
cd /matchleague.org/test/backend
lcd $PROJ/backend
mirror -e -R -L --exclude="node_modules" --exclude="*.db*" ./ ./
cd /matchleague.org/test

# Config
echo "📤 Config..."
cd /matchleague.org/test/backend
put -O .env $PROJ/backend/.env.test

echo "✅ All Done!"
quit
LFTP_SESSION

echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
