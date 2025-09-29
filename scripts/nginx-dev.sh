#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:?Usage: nginx-dev.sh <domain> <backend_port> [frontend_port]}"
BACKEND_PORT="${2:?Usage: nginx-dev.sh <domain> <backend_port> [frontend_port]}"
FRONTEND_PORT="${3:-}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx
systemctl enable --now nginx

ufw allow 'Nginx Full' >/dev/null 2>&1 || true

SITE="/etc/nginx/sites-available/${DOMAIN}"

if [ -n "${FRONTEND_PORT}" ]; then
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

echo "Nginx ready: http://${DOMAIN} -> backend:127.0.0.1:${BACKEND_PORT}${FRONTEND_PORT:+ and frontend:127.0.0.1:${FRONTEND_PORT}}"
echo "Optional SSL: apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d ${DOMAIN}"
