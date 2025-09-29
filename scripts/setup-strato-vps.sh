#!/usr/bin/env bash
set -euo pipefail

# setup-strato-vps.sh
# Usage: sudo bash setup-strato-vps.sh <DOMAIN> <GIT_REPO_URL>
# Example: sudo bash setup-strato-vps.sh dev.matchleague.org https://github.com/lennart-3108/pTght.git
#
# What this does:
# - system update
# - installs git, curl, build-essential, nginx, certbot
# - installs Node.js LTS
# - creates a service user 'matchleague' (if missing)
# - clones the repository into /opt/matchleague (or pulls if exists)
# - installs backend deps and starts backend with pm2
# - builds frontend and copies build to /var/www/<DOMAIN>
# - creates a basic nginx site with SPA rewrite and /api proxy
# - prints final hints (run certbot manually or let script run it)

if [ "$#" -lt 2 ]; then
  echo "Usage: sudo $0 <DOMAIN> <GIT_REPO_URL>"
  exit 1
fi

DOMAIN=$1
REPO=$2
BRANCH="${3:-dev}"
APP_PATH="${4:-/opt/matchleague}"
SERVICE_USER="${5:-deploy}"

WEBROOT="/var/www/${DOMAIN}"
APP_DIR="/opt/matchleague"

if [ "$EUID" -ne 0 ]; then
  echo "This script must be run as root. Use: sudo bash $0 ..."
  exit 1
fi

echo "=== Basic system update and package install ==="
apt update && apt upgrade -y
apt install -y git curl build-essential nginx certbot python3-certbot-nginx

echo "=== Install Node.js LTS (NodeSource) ==="
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs

echo "node: $(node -v)  npm: $(npm -v)"

echo "=== Ensure service user exists ==="
if ! id -u ${SERVICE_USER} >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" ${SERVICE_USER}
  usermod -aG sudo ${SERVICE_USER}
  echo "Created user ${SERVICE_USER}"
else
  echo "User ${SERVICE_USER} already exists"
fi

echo "=== Prepare application directory ==="
mkdir -p ${APP_DIR}
chown ${SERVICE_USER}:${SERVICE_USER} ${APP_DIR}

# Repo klonen/aktualisieren
if [ -d "$APP_PATH/.git" ]; then
  sudo -u "$SERVICE_USER" git -C "$APP_PATH" remote set-url origin "$REPO" || true
  sudo -u "$SERVICE_USER" git -C "$APP_PATH" fetch --all --prune
else
  sudo -u "$SERVICE_USER" git clone "$REPO" "$APP_PATH"
fi

# Branch auschecken
sudo -u "$SERVICE_USER" git -C "$APP_PATH" checkout "$BRANCH" || \
sudo -u "$SERVICE_USER" git -C "$APP_PATH" checkout -b "$BRANCH" "origin/$BRANCH" || true
sudo -u "$SERVICE_USER" git -C "$APP_PATH" pull --ff-only origin "$BRANCH" || true

echo "=== Backend: install deps and start with pm2 ==="
cd ${APP_DIR}/backend
sudo -u ${SERVICE_USER} npm install --no-audit --no-fund

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

# Start backend via pm2 (uses "npm run start")
sudo -u ${SERVICE_USER} pm2 start npm --name p-tght-backend -- run start || true
pm2 save || true

echo "=== Frontend: build and deploy to webroot ==="
mkdir -p ${WEBROOT}
chown -R ${SERVICE_USER}:www-data ${WEBROOT}

if [ -d "${APP_DIR}/frontend" ]; then
  cd ${APP_DIR}/frontend
  sudo -u ${SERVICE_USER} npm install --no-audit --no-fund
  sudo -u ${SERVICE_USER} npm run build
  rsync -a --delete build/ ${WEBROOT}/
  chown -R www-data:www-data ${WEBROOT}
else
  echo "No frontend folder found in repo; skip frontend build. If you built locally, copy build/ into ${WEBROOT}"
fi

echo "=== nginx configuration ==="
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
cat > ${NGINX_CONF} <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    root ${WEBROOT};
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5001/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/${DOMAIN}
nginx -t && systemctl reload nginx

echo "=== Optional: obtain TLS certificate with certbot ==="
echo "If DNS for ${DOMAIN} already points to this server, you can run:\n  certbot --nginx -d ${DOMAIN}"

echo "=== Done ==="
echo "Next steps:"
echo " - Ensure DNS A record for ${DOMAIN} points to this VPS IP"
echo " - If you want certbot to automatically configure HTTPS, run: certbot --nginx -d ${DOMAIN}"
echo " - To view pm2 status: pm2 status"
echo " - To view logs: pm2 logs p-tght-backend"

DOMAIN="${1:-dev.example.com}"
REPO_URL="${2:-https://github.com/lennart-3108/pTght.git}"
BRANCH="${3:-dev}"
APP_PATH="${4:-/opt/matchleague}"
APP_USER="${5:-deploy}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl ca-certificates

# Node.js + PM2
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
if ! command -v pm2 >/dev/null 2>&1; then
  npm i -g pm2
fi

# App-User
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$APP_USER"
fi
mkdir -p "$APP_PATH"
chown -R "$APP_USER:$APP_USER" "$APP_PATH"

# Repo holen/aktualisieren
if [ -d "$APP_PATH/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_PATH" remote set-url origin "$REPO_URL" || true
  sudo -u "$APP_USER" git -C "$APP_PATH" fetch --all --prune
else
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_PATH"
fi

# Branch auschecken
sudo -u "$APP_USER" git -C "$APP_PATH" checkout "$BRANCH" || \
sudo -u "$APP_USER" git -C "$APP_PATH" checkout -b "$BRANCH" "origin/$BRANCH" || true
sudo -u "$APP_USER" git -C "$APP_PATH" pull --ff-only origin "$BRANCH" || true

# Erster Deploy
sudo -u "$APP_USER" bash "$APP_PATH/scripts/deploy-dev.sh" "$BRANCH" "$APP_PATH" || true

# PM2 Autostart
USER_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
sudo -u "$APP_USER" pm2 save || true
pm2 startup systemd -u "$APP_USER" --hp "$USER_HOME" >/tmp/pm2-startup.txt || true
bash /tmp/pm2-startup.txt || true

echo "Setup complete for $DOMAIN"
