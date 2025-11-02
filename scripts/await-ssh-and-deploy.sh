#!/usr/bin/env bash
set -euo pipefail

# Small helper that waits for SSH to be reachable and then runs the repo's deploy script.

HOST="${HOST:-82.165.134.166}"
USER="${USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/strato-dev_ed25519}"
INTERVAL="${INTERVAL:-20}"
MAX_TRIES="${MAX_TRIES:-0}"   # 0 = infinite

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_SCRIPT="$REPO_ROOT/deploy-to-server.sh"

if [ ! -f "$DEPLOY_SCRIPT" ]; then
  echo "[await-ssh] Deploy script not found at $DEPLOY_SCRIPT" >&2
  exit 2
fi

echo "[await-ssh] Waiting for SSH ${USER}@${HOST} (key: ${SSH_KEY}) ..."
echo "[await-ssh] Interval: ${INTERVAL}s, Max tries: ${MAX_TRIES:-infinite}" 

tries=0
while true; do
  if ssh -o BatchMode=yes -o ConnectTimeout=6 -i "$SSH_KEY" "${USER}@${HOST}" "echo ready" >/dev/null 2>&1; then
    echo "[await-ssh] SSH is reachable. Starting deployment..."
    break
  fi
  tries=$((tries+1))
  if [ "$MAX_TRIES" != "0" ] && [ "$tries" -ge "$MAX_TRIES" ]; then
    echo "[await-ssh] Reached max tries ($MAX_TRIES). Exiting." >&2
    exit 3
  fi
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date 2>/dev/null || echo now)"
  printf "[await-ssh] Not reachable yet (%s). Next try in %ss...\n" "$ts" "$INTERVAL"
  sleep "$INTERVAL"
done

"$DEPLOY_SCRIPT"

echo "[await-ssh] Deployment finished."
