#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy-frontend-local.sh <FTP_USER> <FTP_HOST>
# You'll be prompted for the password interactively by lftp.

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <FTP_USER> <FTP_HOST>"
  exit 1
fi

USER=$1
HOST=$2

if ! command -v lftp >/dev/null 2>&1; then
  echo "lftp not found. Install via: brew install lftp (macOS) or apt-get install lftp"
  exit 1
fi

echo "Uploading frontend/build to ${HOST} (public_html) as ${USER}"
lftp -u "${USER}" "ftp://${HOST}" <<'LFTP_SCRIPT'
mirror -R build/ public_html/
bye
LFTP_SCRIPT

echo "Upload finished."
