# Match League Deployment Status

## Summary
Das Frontend und Backend für Test- und Produktionsinstanzen wurden vorbereitet und teilweise deployed.

## Completed ✓

### 1. Frontend Build & Integration
- ✓ ProductionWorkInProgress landing page erstellt mit CSS
- ✓ Landing page in App.js integriert (INSTANCE_TYPE-based routing)
- ✓ Frontend gebaut (217KB main.js, 9.8KB CSS)
- ✓ Hostname-based instance detection (test.matchleague.org vs matchleague.org)
- ✓ Feature flags implementiert (SHOW_ONLY_LANDING für production)

### 2. Backend Infrastructure
- ✓ backend/init.js erstellt (auto-install dependencies on startup)
- ✓ backend/server.js updated (requires init.js)
- ✓ start-backend-enhanced.sh erstellt (handles test + prod instances)
- ✓ .env.test und .env.prod konfiguriert
- ✓ Feature flags: Test=nur Tennis+Chat, Prod=alle Features

### 3. Deployment Scripts
- ✓ deploy_backend_only.py (Python LFTP upload script)
- ✓ deploy-test-backend-simple.sh (excludes node_modules)
- ✓ deploy-comprehensive.sh
- ✓ Alle Scripts committed to Git

### 4. Git Commits
```bash
f589791 - feat: Auto-initialize backend dependencies on startup (init.js + require in server.js)
67949c2 - Deploy: Backend startup script, comprehensive deployment scripts, production landing page integration
```

## In Progress ⏳

### Backend Deployment
**Status:** LFTP uploads laufen noch (mehrere parallel Prozesse)

Aktive LFTP processes (lsof/ps):
- Test frontend upload (PID 57423) - läuft seit 4:42AM
- Test node_modules upload (PID 51172) - läuft seit 4:22AM  
- Backend source upload (PID 55692, 61443) - läuft

**Was deployed wird:**
- Frontend build → `/matchleague.org/test/frontend/` (40MB)
- Frontend build → `/matchleague.org/prod/frontend/` (40MB)
- Backend source → `/matchleague.org/test/backend/` (ohne node_modules)
- Backend source → `/matchleague.org/prod/backend/` (ohne node_modules)

**Deployment-Methode:** LFTP mirror über FTP (SSH blockiert)

## Blocked / Not Started ❌

### 1. Backend Startup
**Problem:** Keine SSH/Shell-Access zum Server
- SSH: "Permission denied (publickey)" 
- VNC: Login failed (wrong password)
- LFTP: Nur file transfer, keine command execution

**Workaround-Optionen:**
1. Warten bis Uploads fertig → Server reboot triggern (via Strato Panel)
2. Auto-start script via cron/systemd einrichten
3. Manuell via Strato Server Admin Panel SSH aktivieren
4. Alternative: init.js wird node_modules automatisch installieren beim ersten Start

### 2. API Health Check
```bash
curl http://test.matchleague.org/api/health
# Erwartet: {"status":"healthy"}
# Aktuell: 301 Moved Permanently (nginx redirect, backend nicht gestartet)
```

### 3. SSL Certificates
- Test: test.matchleague.org zeigt "Zertifikat ist ungültig"
- Prod: matchleague.org SSL status unknown
- Lösung: Let's Encrypt Certbot installieren und konfigurieren (braucht SSH)

## File Locations on Server

```
/matchleague.org/
├── test/
│   ├── frontend/          # React build (deploying...)
│   ├── backend/           # Node.js source (deploying...)
│   │   ├── server.js
│   │   ├── init.js
│   │   ├── .env           # renamed from .env.test
│   │   ├── package.json
│   │   └── (node_modules will auto-install on first run)
│   └── logs/
└── prod/
    ├── frontend/          # React build (deploying...)
    ├── backend/           # Node.js source (deploying...)
    │   ├── server.js
    │   ├── init.js
    │   ├── .env           # renamed from .env.prod
    │   └── package.json
    └── logs/
```

## Instance Configuration

### Test Instance (test.matchleague.org)
- Port: 5002
- Features: Nur Tennis Einzelmatches + Chat
- .env: ENABLE_MATCHES=true, ENABLE_CHAT=true, rest=false
- Landing: Voller MVP (Matching + Chat)

### Production Instance (matchleague.org)
- Port: 5003
- Features: Alle aktiviert (Leagues, Competitions, Bookings, Venues, Matches, Chat)
- .env: Alle ENABLE_*=true
- Landing: ProductionWorkInProgress page (link to test instance)

## Next Steps (Manual Intervention Required)

Da SSH blockiert ist, benötigen wir **Server Admin Panel Zugriff** oder **alternative Methode**:

### Option 1: Server Admin Panel (Strato)
1. Login to Strato Server Admin Panel
2. Open terminal/console for server 82.165.134.166
3. Execute:
```bash
cd /matchleague.org/test/backend
PORT=5002 INSTANCE_TYPE=test node server.js &

cd /matchleague.org/prod/backend
PORT=5003 INSTANCE_TYPE=production node server.js &
```

### Option 2: Auto-Start via systemd (needs SSH once)
1. Get SSH access (even one-time)
2. Copy start-backend-enhanced.sh to server
3. Setup systemd services:
```bash
# Test service
sudo systemctl enable /matchleague.org/test/backend/matchleague-test.service
sudo systemctl start matchleague-test

# Prod service
sudo systemctl enable /matchleague.org/prod/backend/matchleague-prod.service
sudo systemctl start matchleague-prod
```

### Option 3: Server Reboot (if startup scripts configured)
- Trigger server reboot via Strato panel
- If cron @reboot configured, backends will auto-start

### Option 4: Wait for LFTP uploads + verify
1. Check if all LFTP processes finished:
```bash
ps aux | grep lftp
```
2. When done, manually trigger backend startup via Panel

## Verification Commands (Once Running)

```bash
# Health checks
curl http://test.matchleague.org/api/health
curl http://matchleague.org/api/health

# Frontend checks  
curl -I https://test.matchleague.org
curl -I https://matchleague.org

# Backend logs (on server)
tail -f /matchleague.org/test/logs/backend.log
tail -f /matchleague.org/prod/logs/backend.log
```

## Known Issues

1. **LFTP Timeouts:** Large uploads (node_modules 500MB+) hitting timeout → using init.js auto-install instead
2. **SSH Blocked:** Cannot execute commands directly on server
3. **SSL Certificates:** Invalid/missing, needs Let's Encrypt setup
4. **nginx config:** Needs update to proxy `/api` to backend ports (5002, 5003)

## Risk Mitigation

- **init.js:** Backend auto-installs dependencies on first run (no manual npm install needed)
- **Multiple deployment attempts:** Several LFTP processes uploading redundantly (can check which succeeds)
- **Frontend served static:** Works independently of backend status
- **Graceful degradation:** Frontend shows connection errors if backend down

## Contact Points

- **FTP Credentials:** rsftp_matchle / Sursee.2026
- **Server IP:** 82.165.134.166
- **Domains:** test.matchleague.org (DNS OK), matchleague.org (DNS OK)
- **Git:** All changes committed to dev branch

---

**Status:** Deployment scripts running, waiting for completion or manual server access to start backends.
