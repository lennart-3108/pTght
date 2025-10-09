#!/usr/bin/env bash
set -euo pipefail

# Start backend and frontend locally for development.
# - Backend: http://localhost:5001
# - Frontend: http://localhost:3000
# Logs go to backend/backend-start.log and frontend/frontend-start.log
# PID files: backend/backend.pid and frontend/frontend.pid

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

start_backend() {
  echo "[dev] Starting backend on :5001 ..."
  cd "$ROOT_DIR/backend"
  export NODE_ENV=development
  export ENABLE_LINK_TESTS=0
  export MAILER_VERIFY=0
  # Ensure deps
  if [ ! -d node_modules ]; then
    echo "[dev] Installing backend dependencies..."
    npm ci
  fi
  # Start (PORT is set inside package.json start script)
  nohup npm start > backend-start.log 2>&1 &
  echo $! > backend.pid
  echo "[dev] Backend PID $(cat backend.pid) -> http://localhost:5001"
}

start_frontend() {
  echo "[dev] Starting frontend on :3000 ..."
  cd "$ROOT_DIR/frontend"
  export BROWSER=none
  export HOST=localhost
  export PORT=3000
  # Ensure deps
  if [ ! -d node_modules ]; then
    echo "[dev] Installing frontend dependencies..."
    npm ci
  fi
  nohup npm start > frontend-start.log 2>&1 &
  echo $! > frontend.pid
  echo "[dev] Frontend PID $(cat frontend.pid) -> http://localhost:3000"
}

start_backend
start_frontend

echo "[dev] All set. Open http://localhost:3000"
