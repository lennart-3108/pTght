#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   nginx-dev.sh <domain> <backend_port> [frontend_port] [mode]
#
# Modes (when a FRONTEND_PORT is provided):
#   dual (default) - Host Nginx proxies /api → backend and everything else → frontend
#   spa            - Host Nginx proxies ALL traffic → frontend; the frontend (e.g. Nginx in container)
#                    is responsible for proxying /api to the backend. Recommended when a reverse proxy
#                    like Caddy is already in front and you want one place to define /api.

DOMAIN="${1:?Usage: nginx-dev.sh <domain> <backend_port> [frontend_port] [mode(spa|dual)]}"
BACKEND_PORT="${2:?Usage: nginx-dev.sh <domain> <backend_port> [frontend_port] [mode(spa|dual)]}"
FRONTEND_PORT="${3:-}"
MODE="${4:-dual}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx
systemctl enable --now nginx

ufw allow 'Nginx Full' >/dev/null 2>&1 || true

SITE="/etc/nginx/sites-available/${DOMAIN}"

# If a FRONTEND_PORT is provided, choose between 'dual' and 'spa' modes
if [ -n "${FRONTEND_PORT}" ]; then
  if [ "${MODE}" = "spa" ]; then
    # SPA mode: Everything goes to the frontend. The frontend is expected to proxy /api.
    cat > "$SITE" <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN};

  location / {
    proxy_pass http://127.0.0.1:${FRONTEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF
  else
    # Dual mode: /api → backend, everything else → frontend
    cat > "$SITE" <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN};

  # API → Backend
  location /api/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  # alles andere → Frontend
  location / {
    proxy_pass http://127.0.0.1:${FRONTEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF
  fi
else
  # Nur Backend wie vorher (Root → Backend)
  cat > "$SITE" <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN};

  location / {
    proxy_pass http://127.0.0.1:${BACKEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
EOF
fi

rm -f /etc/nginx/sites-enabled/default || true
ln -sf "$SITE" "/etc/nginx/sites-enabled/${DOMAIN}"
nginx -t
systemctl reload nginx

if [ -n "${FRONTEND_PORT}" ]; then
  echo "Nginx ready (${MODE}): http://${DOMAIN} -> frontend:127.0.0.1:${FRONTEND_PORT}${MODE:+; /api via ${MODE}}"
  [ "${MODE}" = "dual" ] && echo "  /api -> backend:127.0.0.1:${BACKEND_PORT}"
else
  echo "Nginx ready: http://${DOMAIN} -> backend:127.0.0.1:${BACKEND_PORT}"
fi
echo "Optional SSL: apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d ${DOMAIN}"
