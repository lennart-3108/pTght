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

# Ensure .env exists for docker compose and app defaults
if [ ! -f .env ]; then
  cat > .env <<'EOF'
# Default ports
BACKEND_PORT=5000
FRONTEND_PORT=3000

# Backend default PORT (many servers read PORT)
PORT=5000

# SQLite default (if app supports it)
SQLITE_DB_PATH=/data/dev.sqlite

# Optional Postgres (uncomment if you use compose profile "db")
# POSTGRES_DB=matchleague
# POSTGRES_USER=matchleague
# POSTGRES_PASSWORD=matchleague
# POSTGRES_PORT=5432
# DATABASE_URL=postgres://matchleague:matchleague@postgres:5432/matchleague
EOF
  echo "[deploy-dev] Created .env with defaults."
fi

# Node/PM2 sicherstellen
if ! command -v npm >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null 2>&1 || npm i -g pm2

# Default-Ports
BACKEND_PORT="${BACKEND_PORT:-5000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# 1) Docker Compose bevorzugt
if [ -f docker-compose.yml ] || [ -f compose.yaml ] || [ -f compose.yml ]; then
  if ! command -v docker >/dev/null 2>&1; then
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu jammy stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
  fi
  docker compose pull || true
  docker compose up -d --build
  echo "Deployed with Docker Compose."
  pm2 delete all || true
  pm2 save || true
  exit 0
fi

# 2) Custom Start-Skript
if [ -f scripts/start.sh ]; then
  chmod +x scripts/start.sh
  # Ports ins Env exportieren, falls das Script sie nutzt
  export PORT="${BACKEND_PORT}"
  bash scripts/start.sh || true
fi

# 3) Node + PM2 Heuristik (Backend/Frontend)
# Backend
if [ -d backend ] && [ -f backend/package.json ]; then
  (
    cd backend
    # Port setzen, falls App PORT nutzt
    grep -q '^PORT=' .env 2>/dev/null || echo "PORT=${BACKEND_PORT}" >> .env || true
    export PORT="${BACKEND_PORT}"
    npm ci
    pm2 start npm --name "ptght-backend" -- start || pm2 start npm --name "ptght-backend" -- run dev || pm2 restart "ptght-backend"
  )
fi

# Frontend
if [ -d frontend ] && [ -f frontend/package.json ]; then
  (
    cd frontend
    # Viele Dev-Server lesen PORT; setzen, falls nicht vorhanden
    grep -q '^PORT=' .env 2>/dev/null || echo "PORT=${FRONTEND_PORT}" >> .env || true
    export PORT="${FRONTEND_PORT}"
    npm ci
    pm2 start npm --name "ptght-frontend" -- start || pm2 start npm --name "ptght-frontend" -- run dev || pm2 restart "ptght-frontend"
  )
fi

# Root-App fallback
if [ -f package.json ]; then
  export PORT="${BACKEND_PORT}"
  npm ci || true
  pm2 start npm --name "ptght" -- start || pm2 start npm --name "ptght" -- run dev || pm2 restart "ptght" || true
fi

pm2 save || true
echo "Deploy finished. Expected ports: backend ${BACKEND_PORT}, frontend ${FRONTEND_PORT}."
