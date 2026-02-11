#!/bin/bash
# Server setup script für Match League
# Läuft auf dem Strato VPS, um Backend vorzubereiten und zu starten

set -e

INSTANCE="${1:-test}"
REMOTE_PATH="/matchleague.org/${INSTANCE}"

echo "=========================================="
echo "Match League - Server Setup ($INSTANCE)"
echo "=========================================="
echo ""

cd "$REMOTE_PATH" 2>/dev/null || {
  echo "❌ Path not found: $REMOTE_PATH"
  exit 1
}

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js not installed"
  exit 1
fi

echo "✓ Node.js: $(node --version)"
echo "✓ npm: $(npm --version)"
echo ""

# Backend setup
echo "1️⃣  Preparing Backend..."
cd backend

if [ ! -f package.json ]; then
  echo "❌ package.json not found"
  exit 1
fi

# Install dependencies
if [ ! -d node_modules ] || [ $(find node_modules -type f | wc -l) -lt 10 ]; then
  echo "📦 Installing dependencies..."
  npm install --production >/dev/null 2>&1
  echo "✅ Dependencies installed"
else
  echo "✅ Dependencies already installed"
fi

# Check .env
if [ ! -f .env ]; then
  if [ -f ".env.$INSTANCE" ]; then
    cp ".env.$INSTANCE" .env
    echo "✅ .env created from .env.$INSTANCE"
  elif [ -f .env.test.example ]; then
    cp .env.test.example .env
    echo "⚠️  .env created from .env.test.example (update values!)"
  else
    echo "❌ No .env template found"
    exit 1
  fi
fi

# Database migrations
echo ""
echo "2️⃣  Database Setup..."
if [ -f knexfile.js ]; then
  npm run prestart 2>&1 | tail -5 || true
  echo "✅ Migrations done"
fi

# Summary
echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "To start the server:"
echo "  cd $REMOTE_PATH/backend"
echo "  PORT=${INSTANCE_PORT:-5002} npm start"
echo ""
echo "Or with PM2:"
echo "  pm2 start npm --name 'matchleague-$INSTANCE' -- start"
echo ""
