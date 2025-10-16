#!/usr/bin/env bash
# Smoke test for dev/staging deployments
# Checks:
# - Backend health (/healthz)
# - API via proxy (FRONTEND_URL/api/healthz) if FRONTEND_URL is set
# - Optional login with SMOKE_EMAIL/SMOKE_PASSWORD
# - SPA fallback on FRONTEND_URL (/start)

set -euo pipefail

# Config (can be provided via env)
BACKEND_URL="${BACKEND_URL:-}"
FRONTEND_URL="${FRONTEND_URL:-}"
SMOKE_EMAIL="${SMOKE_EMAIL:-}"
SMOKE_PASSWORD="${SMOKE_PASSWORD:-}"
RETRIES=${RETRIES:-30}
SLEEP=${SLEEP:-1}

color() { local c="$1"; shift; case "$c" in green) echo -e "\033[32m$*\033[0m";; red) echo -e "\033[31m$*\033[0m";; yellow) echo -e "\033[33m$*\033[0m";; blue) echo -e "\033[34m$*\033[0m";; *) echo "$*";; esac; }

trim() { awk '{$1=$1;print}'; }

join_url() {
  # join base and path with single slash
  local base="$1"; local path="$2"
  base="${base%%/}"; path="${path#/}"
  echo "$base/$path"
}

http_code() {
  # returns status code; prints body to /dev/null
  local url="$1"
  curl -fsS -o /dev/null -w '%{http_code}' "$url" || true
}

get_body() {
  local url="$1"
  curl -fsS "$url" || true
}

post_json() {
  local url="$1"; local data="$2"
  curl -fsS -H 'Content-Type: application/json' -d "$data" -w '\n%{http_code}' "$url" || true
}

wait_ready() {
  local name="$1"; local url="$2"; local tries=$RETRIES
  for ((i=1;i<=tries;i++)); do
    local code
    code=$(http_code "$url")
    if [[ "$code" =~ ^2|3[0-9]{2}$ ]] || [[ "$code" == "200" ]]; then
      color green "[OK] $name is up ($code) at $url"
      return 0
    fi
    color yellow "[$i/$tries] waiting for $name at $url (got $code)" >&2
    sleep "$SLEEP"
  done
  color red "[FAIL] $name not ready at $url after $RETRIES tries"
  return 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { color red "[ERR] required command '$1' not found"; exit 97; }
}

require_cmd curl

# Infer sensible defaults if not provided
if [ -z "$BACKEND_URL" ]; then
  # prefer env PORT/BACKEND_PORT patterns; fallback 5001
  if [ -n "${BACKEND_PORT:-}" ]; then
    BACKEND_URL="http://localhost:${BACKEND_PORT}"
  elif [ -n "${PORT:-}" ]; then
    BACKEND_URL="http://localhost:${PORT}"
  else
    BACKEND_URL="http://localhost:5001"
  fi
fi

# Frontend is optional; try common defaults if not set
if [ -z "$FRONTEND_URL" ]; then
  if [ -n "${FRONTEND_PORT:-}" ]; then
    FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
  else
    FRONTEND_URL=""
  fi
fi

echo "--- Smoke config ---"
echo "BACKEND_URL = ${BACKEND_URL}"
echo "FRONTEND_URL = ${FRONTEND_URL:-<unset>}"
echo "SMOKE_EMAIL = ${SMOKE_EMAIL:-<unset>}"
echo "RETRIES = ${RETRIES}, SLEEP = ${SLEEP}s"
echo "---------------------"

FAILURES=0

# 1) Backend health
BE_HEALTH="$(join_url "$BACKEND_URL" "/healthz")"
if wait_ready "backend" "$BE_HEALTH"; then
  body=$(get_body "$BE_HEALTH" | tr -d '\n' | trim)
  echo "Backend /healthz response: $body"
else
  FAILURES=$((FAILURES+1))
fi

# 2) API via proxy (optional, only if FRONTEND_URL set)
if [ -n "$FRONTEND_URL" ]; then
  API_HEALTH="$(join_url "$FRONTEND_URL" "/api/healthz")"
  code=$(http_code "$API_HEALTH")
  if [ "$code" = "200" ]; then
    color green "[OK] proxy API /api/healthz -> 200"
  else
    color yellow "[WARN] proxy API /api/healthz returned $code"
  fi
fi

# 3) Optional login check
if [ -n "$SMOKE_EMAIL" ] && [ -n "$SMOKE_PASSWORD" ]; then
  LOGIN_URL="$(join_url "$BACKEND_URL" "/auth/login")"
  payload=$(printf '{"email":"%s","password":"%s"}' "$SMOKE_EMAIL" "$SMOKE_PASSWORD")
  resp=$(post_json "$LOGIN_URL" "$payload")
  code=$(echo "$resp" | tail -n1)
  json=$(echo "$resp" | sed '$d')
  if [ "$code" = "200" ] && echo "$json" | grep -q '"token"'; then
    color green "[OK] login succeeded for $SMOKE_EMAIL"
  else
    color red "[FAIL] login failed ($code). Response: $json"
    FAILURES=$((FAILURES+1))
  fi

  # Also try via proxy if FRONTEND_URL present
  if [ -n "$FRONTEND_URL" ]; then
    PLOGIN_URL="$(join_url "$FRONTEND_URL" "/api/auth/login")"
    presp=$(post_json "$PLOGIN_URL" "$payload")
    pcode=$(echo "$presp" | tail -n1)
    pjson=$(echo "$presp" | sed '$d')
    if [ "$pcode" = "200" ] && echo "$pjson" | grep -q '"token"'; then
      color green "[OK] proxy login succeeded"
    else
      color yellow "[WARN] proxy login failed ($pcode). Response: $pjson"
    fi
  fi
else
  color yellow "[SKIP] login: SMOKE_EMAIL/SMOKE_PASSWORD not provided"
fi

# 4) SPA fallback (optional – only if FRONTEND_URL set)
if [ -n "$FRONTEND_URL" ]; then
  START_URL="$(join_url "$FRONTEND_URL" "/start")"
  code=$(http_code "$START_URL")
  if [ "$code" = "200" ]; then
    body=$(get_body "$START_URL" | head -c 256 || true)
    if echo "$body" | grep -qi '<!doctype html\|<div[^>]*id="root"\|<html'; then
      color green "[OK] SPA fallback returns HTML at /start"
    else
      color yellow "[WARN] /start 200 but body doesn't look like HTML"
    fi
  else
    color yellow "[WARN] /start returned $code"
  fi
else
  color yellow "[SKIP] SPA check: FRONTEND_URL not set"
fi

echo
if [ "$FAILURES" -gt 0 ]; then
  color red "Smoke failed with $FAILURES failure(s)."
  exit 1
else
  color green "All critical smoke checks passed."
fi
