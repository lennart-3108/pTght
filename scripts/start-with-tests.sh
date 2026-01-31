#!/bin/bash
# Startup Script with Health Checks

set -e

echo "🚀 Starting Match League Platform..."
echo ""

# Backend starten
echo "📡 Starting Backend..."
cd /Users/A105227786/Documents/projects/sL/pTght/backend
pm2 restart backend || pm2 start server.js --name backend
sleep 3

# Frontend starten
echo "🌐 Starting Frontend..."
cd /Users/A105227786/Documents/projects/sL/pTght/frontend
pm2 restart frontend || pm2 start npm --name frontend -- start
sleep 5

# Health Checks ausführen
echo ""
echo "🔍 Running Health Checks..."
cd /Users/A105227786/Documents/projects/sL/pTght/backend
node scripts/health-check.js

# Exit mit Status vom Health Check
exit $?
