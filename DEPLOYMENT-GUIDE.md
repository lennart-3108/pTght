# Multi-Instance Deployment Guide

Deployment-Anleitung für die drei Match League Instanzen auf dem Strato Server.

## 📋 Übersicht

| Instance | Domain | Port | Features | Datenbank |
|----------|--------|------|----------|-----------|
| **Production** | matchleague.org | 5003 | Nur Landing Page | sportsplatform-prod.db |
| **Test** | test.matchleague.org | 5002 | Matches + Chat (Tennis Singles) | sportsplatform-test.db |
| **Development** | dev.matchleague.org | 5001 | Alle Features | sportsplatform.db |

## 🎯 Feature Matrix

| Feature | Production | Test | Development |
|---------|-----------|------|-------------|
| Landing Page | ✅ | ❌ | ❌ |
| Registration | ❌ | ✅ (Tennis only) | ✅ (all sports) |
| Login | ❌ | ✅ | ✅ |
| Match Search | ❌ | ✅ | ✅ |
| Match Creation | ❌ | ✅ | ✅ |
| Match Process | ❌ | ✅ | ✅ |
| Chat | ❌ | ✅ | ✅ |
| Leagues | ❌ | 🔜 (coming soon) | ✅ |
| Competitions | ❌ | 🔜 (coming soon) | ✅ |
| Bookings | ❌ | 🔜 (coming soon) | ✅ |
| Venues | ❌ | 🔜 (coming soon) | ✅ |

## 🚀 Initial Server Setup

### 1. DNS Konfiguration

Richte folgende DNS A-Records bei deinem Domain-Provider ein:

```
matchleague.org      → Server IP (z.B. 81.169.xxx.xxx)
test.matchleague.org → Server IP
dev.matchleague.org  → Server IP (optional)
```

### 2. SSH Zugang

```bash
ssh rsftp_matchle@ssh.strato.de
```

### 3. Repository Setup

```bash
cd /matchleague.org
git clone <repository-url> .
git checkout dev  # Initial setup on dev branch
```

### 4. Node.js & Dependencies

```bash
# Check Node version
node --version  # Should be 20.x

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 5. SSL Zertifikate (Let's Encrypt)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Get certificates for all domains
sudo certbot --nginx -d matchleague.org -d www.matchleague.org
sudo certbot --nginx -d test.matchleague.org
sudo certbot --nginx -d dev.matchleague.org

# Auto-renewal is configured automatically
```

### 6. Nginx Konfiguration

```bash
# Copy config
sudo cp /matchleague.org/nginx-multi-instance.conf /etc/nginx/sites-available/matchleague

# Enable site
sudo ln -s /etc/nginx/sites-available/matchleague /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

## 📦 Environment Setup

### Test Instance (.env.test)

```bash
cd /matchleague.org/backend
cp .env.test.example .env

# Edit .env and set:
vi .env
```

Wichtige Variablen:
```env
PORT=5002
NODE_ENV=production
INSTANCE_TYPE=test
DATABASE_FILE=sportsplatform-test.db
JWT_SECRET=<generate-strong-secret>
MAIL_USER=<email>
MAIL_PASS=<password>
CORS_ORIGIN=https://test.matchleague.org
```

### Production Instance (.env.prod)

```bash
cd /matchleague.org/backend
cp .env.prod.example .env.prod

vi .env.prod
```

Wichtige Variablen:
```env
PORT=5003
NODE_ENV=production
INSTANCE_TYPE=production
DATABASE_FILE=sportsplatform-prod.db
JWT_SECRET=<different-strong-secret>
MAIL_USER=<email>
MAIL_PASS=<password>
CORS_ORIGIN=https://matchleague.org
```

## 🚀 Deployment

### Test Instance Deployment

```bash
cd /matchleague.org
./scripts/deploy-test-instance.sh
```

Das Skript:
1. ✅ Pullt neuesten Code von dev branch
2. ✅ Backup der Test-Datenbank
3. ✅ Setup .env (falls nicht vorhanden)
4. ✅ Installiert Backend Dependencies
5. ✅ Führt DB Migrations aus
6. ✅ Baut Frontend mit REACT_APP_INSTANCE_TYPE=test
7. ✅ Startet Backend auf Port 5002

### Production Instance Deployment

```bash
cd /matchleague.org
./scripts/deploy-prod-instance.sh
```

⚠️ **WICHTIG**: Production verwendet den `main` branch!

Das Skript:
1. ✅ Fragt nach Bestätigung
2. ✅ Pullt von main branch
3. ✅ Backup der Production-Datenbank
4. ✅ Setup .env.prod
5. ✅ Installiert Dependencies
6. ✅ Migrations
7. ✅ Baut Frontend mit REACT_APP_INSTANCE_TYPE=production
8. ✅ Startet Backend auf Port 5003

## 🔍 Monitoring & Debugging

### Health Checks

```bash
# Test Instance
curl https://test.matchleague.org/api/health

# Production Instance
curl https://matchleague.org/api/health
```

Expected Response:
```json
{
  "ok": true,
  "timestamp": "2025-01-24T10:30:00.000Z",
  "instance": "test"
}
```

### Log Files

```bash
# Test Instance Logs
tail -f /matchleague.org/backend/logs/test-server.log

# Production Logs
tail -f /matchleague.org/backend/logs/prod-server.log

# Nginx Logs
sudo tail -f /var/log/nginx/matchleague-test-access.log
sudo tail -f /var/log/nginx/matchleague-prod-access.log
```

### Process Management

```bash
# Check running processes
ps aux | grep "node.*server.js"

# Should see:
# node server.js (port 5002) - Test
# node server.js (port 5003) - Production

# Kill specific instance
pkill -f "node.*server.js.*5002"  # Test
pkill -f "node.*server.js.*5003"  # Prod

# Restart
cd /matchleague.org
./scripts/deploy-test-instance.sh    # oder
./scripts/deploy-prod-instance.sh
```

## 🗄️ Database Management

### Backup Strategy

Automatische Backups bei jedem Deployment:
```
sportsplatform-test.db.backup_20250124_103000
sportsplatform-prod.db.backup_20250124_110000
```

### Manual Backup

```bash
cd /matchleague.org/backend

# Test DB
cp sportsplatform-test.db "backups/test-$(date +%Y%m%d_%H%M%S).db"

# Prod DB
cp sportsplatform-prod.db "backups/prod-$(date +%Y%m%d_%H%M%S).db"
```

### Migration from Test to Prod

⚠️ **NUR wenn Production Features aktiviert werden!**

```bash
cd /matchleague.org/backend

# 1. Backup current prod
cp sportsplatform-prod.db sportsplatform-prod.db.backup_before_migration

# 2. Copy test data to prod
cp sportsplatform-test.db sportsplatform-prod.db

# 3. Run any prod-specific migrations
NODE_ENV=production npm run migrate

# 4. Restart prod
pkill -f "node.*server.js.*5003"
PORT=5003 nohup node server.js > logs/prod-server.log 2>&1 &
```

## 🧪 Testing

### Frontend Instance Detection

Test ob die richtige Instanz geladen wird:

```bash
# Test Instance
curl -s https://test.matchleague.org | grep "REACT_APP_INSTANCE_TYPE"

# Production Instance
curl -s https://matchleague.org | grep "REACT_APP_INSTANCE_TYPE"
```

### Registration Test (Test Instance)

1. Gehe zu https://test.matchleague.org
2. Klicke auf "Registrieren"
3. **Erwarte**: Disclaimer-Modal erscheint
4. **Erwarte**: Nur "Tennis (Einzel)" als Sportart verfügbar
5. Akzeptiere Disclaimer
6. Registriere Test-Account

### Coming Soon Overlays (Test Instance)

1. Login auf Test-Instanz
2. Navigiere zu "Ligen"
3. **Erwarte**: "Coming Soon" Overlay über der Seite
4. Navigiere zu "Turniere"
5. **Erwarte**: "Coming Soon" Overlay
6. Navigiere zu "Matches"
7. **Erwarte**: KEIN Overlay, volle Funktionalität

### Production Landing Page

1. Besuche https://matchleague.org
2. **Erwarte**: Landing Page mit "Coming Soon"
3. **Erwarte**: Link zu https://test.matchleague.org
4. **Erwarte**: KEINE Navigation zu anderen Seiten

## 🔄 Update Workflow

### Test Instance Update

```bash
cd /matchleague.org
git fetch origin
git checkout dev
git pull origin dev
./scripts/deploy-test-instance.sh
```

### Production Update (z.B. bei Bug-Fix)

```bash
cd /matchleague.org

# Merge dev → main (via GitHub/GitLab PR empfohlen)
# ODER lokal:
git checkout main
git pull origin main
git merge dev
git push origin main

# Deploy
./scripts/deploy-prod-instance.sh
```

## 🛠️ Troubleshooting

### "Backend nicht erreichbar"

```bash
# Check if backend running
ps aux | grep "node.*server"

# Check logs
tail -50 /matchleague.org/backend/logs/test-server.log

# Restart
cd /matchleague.org
./scripts/deploy-test-instance.sh
```

### "White Screen" im Frontend

```bash
# Check nginx error log
sudo tail -50 /var/log/nginx/matchleague-test-error.log

# Check if build exists
ls -la /matchleague.org/frontend/build/

# Rebuild frontend
cd /matchleague.org/frontend
REACT_APP_INSTANCE_TYPE=test npm run build
```

### SSL Zertifikat abgelaufen

```bash
# Check status
sudo certbot certificates

# Renew manually
sudo certbot renew

# Reload nginx
sudo systemctl reload nginx
```

### Port bereits belegt

```bash
# Find what's using the port
sudo lsof -i :5002

# Kill process
pkill -f "node.*5002"

# Restart
./scripts/deploy-test-instance.sh
```

## 📊 Performance Monitoring

### Resource Usage

```bash
# RAM & CPU
htop

# Disk space
df -h

# Database size
ls -lh /matchleague.org/backend/*.db
```

### Response Times

```bash
# Test API response time
time curl https://test.matchleague.org/api/health

# Should be < 200ms
```

## 🔐 Security Checklist

- [x] SSL certificates installed (Let's Encrypt)
- [x] HTTPS enforced (HTTP → HTTPS redirect)
- [x] Strong JWT_SECRET in .env files
- [x] Rate limiting configured (nginx)
- [x] CORS properly configured per instance
- [x] Security headers set (HSTS, X-Frame-Options, etc.)
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] SSH key-only authentication
- [ ] Regular security updates (apt-get update)

## 📝 Changelog

When deploying, document changes:

```bash
# In /matchleague.org/CHANGELOG.md
## 2025-01-24 - Test Instance v1.0
- ✅ Initial deployment
- ✅ Match creation/search enabled
- ✅ Chat functionality
- ✅ Coming soon overlays for leagues/competitions
```

## 🆘 Emergency Rollback

Wenn ein Deployment fehlschlägt:

```bash
cd /matchleague.org/backend

# 1. Stop current instance
pkill -f "node.*server.js.*5002"

# 2. Restore previous database
ls -lt backups/*.backup_*  # Find latest
cp backups/sportsplatform-test.db.backup_TIMESTAMP sportsplatform-test.db

# 3. Rollback code
git log --oneline -10  # Find previous commit
git reset --hard <previous-commit-hash>

# 4. Rebuild & restart
cd ../frontend
REACT_APP_INSTANCE_TYPE=test npm run build
cd ../backend
PORT=5002 nohup node server.js > logs/test-server.log 2>&1 &
```

---

**Bei Fragen**: Dokumentation lesen oder Logs checken! 🚀
