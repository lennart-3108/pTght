#!/usr/bin/env bash
set -euo pipefail

# Verify runtime on the server (Strato/IONOS) after deploy.
# Checks:
# - PM2 processes (backend)
# - Backend health
# - Nginx config and HTTP response
# - Knex migration status and sqlite DB file

APP_PATH="${APP_PATH:-/opt/matchleague}"
BE_PORT="${BE_PORT:-5001}"
WEBROOT="${WEBROOT:-/var/www/dev.matchleague.org}"

cd "$APP_PATH/backend" 2>/dev/null || { echo "[verify] backend path not found: $APP_PATH/backend" >&2; exit 2; }

echo "--- PM2 status ---"
if command -v pm2 >/dev/null 2>&1; then
  pm2 status || true
  echo
  echo "--- PM2 last logs (ptght-backend) ---"
  pm2 logs ptght-backend --lines 50 --nostream || true
else
  echo "pm2 not found" >&2
fi

echo
echo "--- Backend health ---"
if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://127.0.0.1:${BE_PORT}/healthz" || echo "[verify] backend /healthz failed" >&2
else
  echo "curl not found" >&2
fi

echo
echo "--- Nginx config test ---"
if command -v nginx >/dev/null 2>&1; then
  nginx -t || true
else
  echo "nginx not found" >&2
fi

echo
echo "--- Webroot listing (${WEBROOT}) ---"
ls -la "$WEBROOT" | head -n 30 || true

echo
echo "--- HTTP localhost HEAD ---"
if command -v curl >/dev/null 2>&1; then
  curl -I -sS http://127.0.0.1/ | head -n 5 || true
fi

echo
echo "--- Knex migration status ---"
DB_FILE=""
for cand in "${SQLITE_FILE:-}" "${DB_FILE:-}" "$(pwd)/sportsplatform.db" "$(pwd)/sportplattform.db" "$(pwd)/database.sqlite"; do
  if [ -n "$cand" ] && [ -f "$cand" ]; then DB_FILE="$cand"; break; fi
done
echo "DB_FILE=${DB_FILE:-<not found>}"

if command -v npx >/dev/null 2>&1; then
  npx --yes knex --knexfile knexfile.js migrate:status || true
else
  if command -v knex >/dev/null 2>&1; then
    knex --knexfile knexfile.js migrate:status || true
  else
    echo "[verify] knex CLI not available" >&2
  fi
fi

if command -v sqlite3 >/dev/null 2>&1 && [ -n "$DB_FILE" ]; then
  echo "--- sqlite tables (excerpt) ---"
  sqlite3 "$DB_FILE" \
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('knex_migrations','knex_migrations_lock','users','leagues','matches','games') ORDER BY name;" || true
  echo "--- applied migrations (count) ---"
  sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM knex_migrations;" || true
fi

echo
echo "[verify] done."
