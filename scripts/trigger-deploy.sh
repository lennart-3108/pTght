#!/bin/bash
# Trigger remote deploy webhook to pull latest code and restart

DEPLOY_TOKEN="dev-deploy-2026"
TEST_URL="https://test.matchleague.org"

echo "=== Triggering Deploy Webhook on Test Instance ==="
echo "This will:"
echo "- Pull latest code from GitHub (dev branch)"
echo "- Install dependencies"
echo "- Restart backend server"
echo ""

curl -k -X POST "${TEST_URL}/api/deploy/webhook/deploy" \
  -H "X-Deploy-Token: ${DEPLOY_TOKEN}" \
  -H "Content-Type: application/json" \
  -v 2>&1 | grep -E "(< HTTP|success|error|message)" | head -20

echo ""
echo "=== Deploy webhook triggered ==="
echo "Wait 30 seconds for server to restart, then test:"
echo "  curl -k ${TEST_URL}/api/health"
