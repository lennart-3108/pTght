#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-dev}"
APP_PATH="${2:-/opt/matchleague}"

export DEBIAN_FRONTEND=noninteractive
command -v git >/dev/null 2>&1 || { apt-get update -y && apt-get install -y git; }

cd "$APP_PATH"
git fetch --all --prune
git checkout "$BRANCH" || git checkout -b "$BRANCH" "origin/$BRANCH" || true
git pull --ff-only origin "$BRANCH" || true

# Eigene Dev-Umgebung/DB
mkdir -p "$APP_PATH/data"
if [ ! -f .env.dev ]; then
  cat > .env.dev <<'EOF'
NODE_ENV=development
# Eigene SQLite-DB für dev:
SQLITE_DB_PATH=/opt/matchleague/data/dev.sqlite
# Beispiel-Port:
PORT=5000
EOF
fi
# Env exportieren, damit Kinder (pm2/npm) sie erben
set -a
[ -f .env.dev ] && . ./.env.dev
set +a

# 1) Docker Compose bevorzugt
if [ -f docker-compose.yml ] || [ -f compose.yaml ] || [ -f compose.yml ]; then
  if ! command -v docker >/dev/null 2>&1; then
    apt-get install -y docker.io docker-compose-plugin
    systemctl enable --now docker
  fi
  docker compose pull || true
  docker compose up -d --build
  echo "Deployed with Docker Compose."
  exit 0
fi

# 2) Custom Start-Skript
if [ -f scripts/start.sh ]; then
  chmod +x scripts/start.sh
  bash scripts/start.sh || true
fi

# 3) Node + PM2 Heuristik
command -v pm2 >/dev/null 2>&1 || npm i -g pm2

if [ -d backend ] && [ -f backend/package.json ]; then
  (cd backend && npm ci && (pm2 start npm --name "ptght-backend" -- start || pm2 restart "ptght-backend"))
fi

if [ -d frontend ] && [ -f frontend/package.json ]; then
  (cd frontend && npm ci && (pm2 start npm --name "ptght-frontend" -- start || pm2 restart "ptght-frontend"))
fi

if [ -f package.json ]; then
  npm ci || true
  (pm2 start npm --name "ptght" -- start || pm2 restart "ptght") || true
fi

pm2 save || true
echo "Deploy finished."
