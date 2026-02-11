#!/bin/bash
# Comprehensive deployment script for Match League
# Deploys frontend and backend to test and production instances via LFTP

set -e

LFTP_USER="rsftp_matchle"
LFTP_PASS="Sursee.2026"
LFTP_HOST="82.165.134.166"

FRONTEND_BUILD="/Users/lennart/projects/match league/frontend/build"
BACKEND_SRC="/Users/lennart/projects/match league/backend"

echo "=== Match League Full Deployment ==="
echo "Frontend: $FRONTEND_BUILD"
echo "Backend: $BACKEND_SRC"
echo ""

# Function to run LFTP commands
run_lftp() {
  local commands="$1"
  echo "$commands" | lftp -u "$LFTP_USER,$LFTP_PASS" ftp://"$LFTP_HOST"
}

# Deploy to a specific instance
deploy_instance() {
  local INSTANCE=$1  # test or prod
  local INSTANCE_PATH="/matchleague.org/$INSTANCE"
  
  echo ""
  echo "========== Deploying to $INSTANCE instance =========="
  
  # Create LFTP commands for this instance
  local LFTP_CMDS="
set net:max-retries 3
set net:timeout 30
set xfer:clobber yes

cd $INSTANCE_PATH

echo '=== Deploying Frontend ===' 
rm -rf frontend-old 2>/dev/null || true
mv frontend frontend-old 2>/dev/null || true
mkdir frontend
mirror -e --reverse $FRONTEND_BUILD/ frontend/
echo 'Frontend deployed'

echo '=== Deploying Backend ===' 
rm -rf backend-old 2>/dev/null || true
mv backend backend-old 2>/dev/null || true
mkdir backend
mirror -e --reverse $BACKEND_SRC/ backend/
echo 'Backend deployed'

echo '=== Setting up .env file ===' 
cd backend"
"
  
  echo "$LFTP_CMDS" | lftp -u "$LFTP_USER,$LFTP_PASS" ftp://"$LFTP_HOST" 2>&1 | tee "/tmp/deploy-${INSTANCE}.log"
  
  echo "Deployment to $INSTANCE completed. Check /tmp/deploy-${INSTANCE}.log for details"
}

# Deploy to both instances
deploy_instance "test"
deploy_instance "prod"

echo ""
echo "=== Deployment Summary ==="
echo "✓ Frontend deployed to both instances"
echo "✓ Backend code deployed to both instances"
echo ""
echo "Next steps (manual):"
echo "1. SSH into the server or use server admin panel"
echo "2. Run: bash /matchleague.org/test/backend/start-backend-enhanced.sh test"
echo "3. Run: bash /matchleague.org/prod/backend/start-backend-enhanced.sh prod"
echo "4. Or wait for server auto-start if configured"
echo ""
echo "Check status:"
echo "curl http://test.matchleague.org/api/health"
echo "curl http://matchleague.org/api/health"
