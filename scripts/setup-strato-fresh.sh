#!/bin/bash
# Fresh installation script for Strato VPS
# Run this as root after reinstalling the server

set -e

echo "🚀 Match League - Fresh Server Setup"
echo "===================================="

# 1. Update system
echo "📦 Updating system..."
apt update && apt upgrade -y

# 2. Install required packages
echo "📦 Installing Node.js, nginx, git..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx git build-essential sqlite3

# 3. Create directory structure
echo "📁 Creating directories..."
mkdir -p /matchleague.org/test/backend
mkdir -p /matchleague.org/test/frontend
mkdir -p /matchleague.org/prod/backend
mkdir -p /matchleague.org/prod/frontend

# 4. Clone repository
echo "📥 Cloning repository..."
cd /matchleague.org/test
git clone https://github.com/lennart-3108/pTght.git temp
mv temp/backend/* backend/
mv temp/frontend/* frontend/
rm -rf temp

# 5. Install backend dependencies
echo "📦 Installing backend dependencies..."
cd /matchleague.org/test/backend
npm install --production

# 6. Initialize database
echo "🗄️  Initializing database..."
npm run migrate

# 7. Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd /matchleague.org/test/frontend
npm install
npm run build

# 8. Configure nginx
echo "⚙️  Configuring nginx..."
cat > /etc/nginx/sites-available/matchleague-test <<'EOF'
server {
    listen 80;
    server_name test.matchleague.org;

    # Frontend
    location / {
        root /matchleague.org/test/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5002/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

ln -sf /etc/nginx/sites-available/matchleague-test /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# 9. Create systemd service
echo "⚙️  Creating systemd service..."
cat > /etc/systemd/system/matchleague-test.service <<'EOF'
[Unit]
Description=Match League Test Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/matchleague.org/test/backend
Environment="NODE_ENV=production"
Environment="PORT=5002"
Environment="INSTANCE_TYPE=test"
Environment="ENABLE_MATCHES=true"
Environment="ENABLE_CHAT=true"
Environment="CORS_ORIGIN=https://test.matchleague.org"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/matchleague.org/test/backend/logs/server.log
StandardError=append:/matchleague.org/test/backend/logs/error.log

[Install]
WantedBy=multi-user.target
EOF

# 10. Enable and start service
echo "🚀 Starting backend service..."
systemctl daemon-reload
systemctl enable matchleague-test.service
systemctl start matchleague-test.service

# 11. Install SSL certificate (Let's Encrypt)
echo "🔒 Installing SSL certificate..."
apt install -y certbot python3-certbot-nginx
certbot --nginx -d test.matchleague.org --non-interactive --agree-tos --email lennart.3108@icloud.com

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Status:"
systemctl status matchleague-test.service --no-pager
echo ""
echo "🌐 Test URL: https://test.matchleague.org"
echo ""
echo "📝 Useful commands:"
echo "  systemctl status matchleague-test    # Check status"
echo "  systemctl restart matchleague-test   # Restart backend"
echo "  journalctl -u matchleague-test -f    # View logs"
echo "  tail -f /matchleague.org/test/backend/logs/server.log"
