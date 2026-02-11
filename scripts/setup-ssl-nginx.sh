#!/bin/bash
# SSL & Nginx Setup für test.matchleague.org
# Muss einmalig als root/sudo ausgeführt werden

set -e

SERVER="ssh.strato.de"
USER="rsftp_matchle"

echo "🔒 SSL & Nginx Setup"
echo "===================="
echo ""
echo "Dieser Schritt benötigt sudo-Rechte auf dem Server"
echo ""

ssh -t $USER@$SERVER << 'ENDSSH'
set -e

# Install certbot if not exists
if ! command -v certbot &> /dev/null; then
  echo "📦 Installing certbot..."
  sudo apt-get update
  sudo apt-get install -y certbot python3-certbot-nginx
  echo "✅ Certbot installiert"
else
  echo "✅ Certbot bereits installiert"
fi
echo ""

# Get SSL certificate
echo "🔒 Hole SSL-Zertifikat für test.matchleague.org..."
echo ""
echo "Du wirst nach deiner Email gefragt und musst den"
echo "Terms of Service zustimmen."
echo ""

sudo certbot --nginx -d test.matchleague.org

echo ""
echo "✅ SSL-Zertifikat installiert"
echo ""

# Copy nginx config
echo "⚙️  Aktiviere Nginx-Konfiguration..."

# Backup existing config if exists
if [ -f /etc/nginx/sites-enabled/matchleague ]; then
  echo "   Backup existing config..."
  sudo cp /etc/nginx/sites-enabled/matchleague /etc/nginx/sites-enabled/matchleague.backup
fi

# Copy new config
sudo cp /matchleague.org/nginx-multi-instance.conf /etc/nginx/sites-available/matchleague

# Enable site
sudo ln -sf /etc/nginx/sites-available/matchleague /etc/nginx/sites-enabled/matchleague

# Test config
echo "   Testing nginx config..."
if sudo nginx -t; then
  echo "✅ Nginx config valid"
  
  # Reload nginx
  echo "   Reloading nginx..."
  sudo systemctl reload nginx
  echo "✅ Nginx reloaded"
else
  echo "❌ Nginx config invalid!"
  echo "   Restoring backup..."
  if [ -f /etc/nginx/sites-enabled/matchleague.backup ]; then
    sudo cp /etc/nginx/sites-enabled/matchleague.backup /etc/nginx/sites-enabled/matchleague
    sudo systemctl reload nginx
  fi
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ SSL & NGINX SETUP ABGESCHLOSSEN!"
echo ""
echo "🌐 Test: https://test.matchleague.org"
echo ""
echo "🔄 Auto-Renewal:"
echo "   Certbot erneuert das Zertifikat automatisch"
echo "   Test: sudo certbot renew --dry-run"
echo ""

ENDSSH

echo ""
echo "🎉 Setup abgeschlossen!"
echo ""
