#!/bin/bash
# Simple test deployment - upload only key backend files to test instance
# Skips node_modules - backend will install automatically via init.js

LFTP_USER="rsftp_matchle"
LFTP_PASS="Sursee.2026"
LFTP_HOST="82.165.134.166"
BACKEND_SRC="/Users/lennart/projects/match league/backend"

echo "=== Test Backend Deployment (excluding node_modules) ==="

# Create a file listing what to exclude
cat > /tmp/lftp_exclude.txt << 'EOF'
node_modules/
*.db
*.db.bak
*.sqlite
*.sqlite.bak
*.log
.DS_Store
.git/
EOF

echo "Files to exclude from upload:"
cat /tmp/lftp_exclude.txt

echo ""
echo "Deploying backend to test instance..."

lftp -u "$LFTP_USER,$LFTP_PASS" "ftp://$LFTP_HOST" <<LFTP_SCRIPT
set net:max-retries 2
set net:timeout 30

cd /matchleague.org/test

echo "Preparing backend directory..."
mkdir backend 2>/dev/null || true
cd backend

echo "Uploading backend source (excluding node_modules and databases)..."
mirror -e --reverse --exclude-glob node_modules/ --exclude-glob '*.db' --exclude-glob '*.sqlite' --exclude-glob '*.log' "$BACKEND_SRC/" .

echo "Configuring test .env..."
rm -f .env 2>/dev/null || true
mv .env.test .env 2>/dev/null || true

ls -la | head -20

echo "Test backend deployment complete!"
cd ..
bye
LFTP_SCRIPT

echo ""
echo "=== Deployment Complete ==="
echo "Backend source deployed (node_modules will be installed on first run)"
echo ""
echo "Next: Start backend on server"
echo "  cd /matchleague.org/test/backend"
echo "  PORT=5002 INSTANCE_TYPE=test node server.js"
echo ""
echo "Or use startup script:"
echo "  bash /matchleague.org/test/backend/start-backend-enhanced.sh test"
