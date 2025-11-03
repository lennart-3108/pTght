# Instance Configuration: Local vs Dev

## 🎯 KRITISCHE UNTERSCHIEDE - IMMER BEACHTEN!

### 1. **API Base URL**

#### LOCAL
- Frontend: `http://localhost:5001/api`
- Logic in `frontend/src/config.js`: Erkennt localhost → verwendet explizit `http://localhost:5001/api`
- Fallback: Falls nicht localhost → `/api` (relativ)

#### DEV (Production)
- Frontend: `/api` (relativ → `https://dev.matchleague.org/api`)
- Nginx leitet `/api/*` an Backend Port 5001 weiter
- **WICHTIG**: Avatar URLs dürfen NICHT `/api` prefix bekommen! (siehe Avatar.js Fix)

---

### 2. **Environment Variables (.env)**

#### LOCAL (`backend/.env`)
```env
PORT=5001
CORS_ORIGIN=http://localhost:3000
MAIL_HOST=smtp.hostinger.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=info@dev.matchleague.org
MAIL_PASS=Espresso.2025
MAIL_DEBUG=1
IMAP_HOST=imap.hostinger.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=info@dev.matchleague.org
IMAP_PASS=Espresso.2025
IMAP_MAILBOX=Sent
JWT_SECRET=92d4800ea4e9895ca718d137bbaea081e8bc8ef6baab62bb5c7701cc32d57c50
```

#### DEV (`/opt/matchleague/backend/.env`)
```env
PORT=5001
CORS_ORIGIN=https://dev.matchleague.org
MAIL_HOST=smtp.hostinger.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=info@dev.matchleague.org
MAIL_PASS=Espresso.2025
MAIL_DEBUG=1
IMAP_HOST=imap.hostinger.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=info@dev.matchleague.org
IMAP_PASS=Espresso.2025
IMAP_MAILBOX=Sent
BACKEND_PUBLIC_URL=https://dev.matchleague.org/api
FRONTEND_PUBLIC_URL=https://dev.matchleague.org
```

**UNTERSCHIEDE:**
- `CORS_ORIGIN`: localhost vs. production domain
- `BACKEND_PUBLIC_URL` / `FRONTEND_PUBLIC_URL`: Nur auf Dev gesetzt

---

### 3. **Database Files**

#### LOCAL
- Location: `/Users/A105227786/Documents/projects/sL/pTght/backend/`
- Active file: `database.sqlite` (144KB)
- Backup file: `sportplattform.db` (96KB, alt)
- Content:
  - 123 users (Test-Accounts)
  - 10 sports (wenige Test-Daten)
  - 3 cities (minimal)

#### DEV
- Location: `/opt/matchleague/backend/`
- Active file: `database.sqlite` (816KB)
- Backup file: `sportplattform.db` (88KB, alt)
- Content:
  - 245 users (inkl. echte Registrierungen)
  - 46 sports (vollständige Daten)
  - 37 cities (vollständige Daten)

**WICHTIG:** Bei Sync von LOCAL → DEV:
1. Backup erstellen: `ssh root@82.165.134.166 "cp /opt/matchleague/backend/database.sqlite /opt/matchleague/backend/database.sqlite.backup_$(date +%Y%m%d_%H%M%S)"`
2. Datei kopieren: `scp backend/database.sqlite root@82.165.134.166:/opt/matchleague/backend/`
3. PM2 restart: `ssh root@82.165.134.166 "pm2 restart ptght-backend"`

---

### 4. **Static File Serving (Avatars, Uploads)**

#### LOCAL
- URL: `http://localhost:5001/uploads/avatars/1.jpg`
- Backend serviert direkt aus `backend/uploads/`

#### DEV
- URL: `https://dev.matchleague.org/uploads/avatars/1.jpg`
- Nginx serviert aus `/opt/matchleague/backend/uploads/`
- **CRITICAL**: Avatar.js darf NICHT `/api` prefix hinzufügen!
  - Falsch: `/api/uploads/avatars/1.jpg` → 404
  - Richtig: `/uploads/avatars/1.jpg` → 200

Fix in `Avatar.js`:
```javascript
if (s.startsWith('/uploads/')) {
  const base = API_BASE.replace(/\/api$/, '');
  if (base.startsWith('http')) return base + s;
  else if (typeof window !== 'undefined') return window.location.origin + s;
  return s;
}
```

---

### 5. **Process Management**

#### LOCAL
- Start: `PORT=5001 node backend/server.js` (manuell oder via VS Code Task)
- Keine Persistenz nach Neustart

#### DEV
- PM2 Process: `ptght-backend` (id: 0)
- Script: `/opt/matchleague/backend/server.js`
- Working Dir: `/opt/matchleague/backend/`
- Auto-restart bei Crash
- Commands:
  - Status: `ssh root@82.165.134.166 "pm2 list"`
  - Logs: `ssh root@82.165.134.166 "pm2 logs ptght-backend --lines 50"`
  - Restart: `ssh root@82.165.134.166 "pm2 restart ptght-backend"`
  - Stop: `ssh root@82.165.134.166 "pm2 stop ptght-backend"`

---

### 6. **Frontend Serving**

#### LOCAL
- Dev Server: `npm start` (Port 3000)
- Hot Reload aktiv
- Source maps vorhanden

#### DEV
- Static Build: `/var/www/dev.matchleague.org/`
- Nginx serviert direkt
- Deploy:
  ```bash
  npm run build
  rsync -avz --delete frontend/build/ root@82.165.134.166:/var/www/dev.matchleague.org/
  ```

---

### 7. **Ports**

#### LOCAL
- Backend: 5001
- Frontend Dev Server: 3000

#### DEV
- Backend: 5001 (intern)
- Nginx: 80 → 443 (SSL)
- Public URLs:
  - Frontend: https://dev.matchleague.org/
  - API: https://dev.matchleague.org/api/
  - Uploads: https://dev.matchleague.org/uploads/

---

## 🔥 HÄUFIGE PROBLEME UND LÖSUNGEN

### Problem 1: Email Connection "Disconnected"
**Ursache:** `.env` nicht in `/opt/matchleague/backend/` vorhanden (PM2 lädt nicht aus Parent-Dir)  
**Lösung:** `cp /opt/matchleague/.env /opt/matchleague/backend/.env && pm2 restart ptght-backend`

### Problem 2: Admin Routes 404
**Ursache:** Routes auf `app` statt `apiRouter` gemountet  
**Lösung:** Alle Admin-Routes auf `apiRouter` mounten, dann `app.use("/api", apiRouter)` am Ende

### Problem 3: Avatar Images 404
**Ursache:** Avatar.js fügt `/api` prefix zu allen relativen URLs hinzu  
**Lösung:** Special handling für `/uploads` Pfade (siehe Avatar.js Fix oben)

### Problem 4: Port 5001 Already in Use
**Ursache:** Orphaned Node-Prozess oder PM2 errored  
**Lösung:**
```bash
ssh root@82.165.134.166 "lsof -i :5001"  # Find PID
ssh root@82.165.134.166 "kill -9 <PID> && pm2 restart ptght-backend"
```

### Problem 5: Falsche Datenbank (sportplattform.db statt database.sqlite)
**Ursache:** `SQLITE_FILE` env var nicht gesetzt → Backend verwendet `sportsplatform.db` als Fallback  
**Lösung:** Backend nutzt automatisch `database.sqlite` wenn vorhanden, sonst Fallback zu `sportsplatform.db`

### Problem 6: localStorage stale API_BASE auf Production
**Ursache:** localStorage hat `http://localhost:5001/api` gespeichert, wird auf Production verwendet  
**Lösung:** `config.js` ignoriert localStorage auf Production-Domains (nicht localhost)

---

## ✅ DEPLOYMENT CHECKLIST

### Backend Deploy:
1. ✅ Änderungen committen & pushen
2. ✅ Datei(en) via scp kopieren ODER Git pull auf Server
3. ✅ Bei .env Änderungen: In `/opt/matchleague/backend/.env` auch updaten
4. ✅ PM2 restart: `ssh root@82.165.134.166 "pm2 restart ptght-backend"`
5. ✅ Logs checken: `ssh root@82.165.134.166 "pm2 logs ptght-backend --lines 30"`
6. ✅ API testen: `curl https://dev.matchleague.org/api/admin/email-status`

### Frontend Deploy:
1. ✅ Änderungen committen & pushen
2. ✅ Build: `npm run build` in `frontend/`
3. ✅ Deploy: `rsync -avz --delete frontend/build/ root@82.165.134.166:/var/www/dev.matchleague.org/`
4. ✅ Browser hard refresh (Cmd+Shift+R)

### Database Sync:
1. ✅ Backup auf Server: `ssh root@82.165.134.166 "cp /opt/matchleague/backend/database.sqlite /opt/matchleague/backend/database.sqlite.backup_$(date +%Y%m%d_%H%M%S)"`
2. ✅ Upload: `scp backend/database.sqlite root@82.165.134.166:/opt/matchleague/backend/`
3. ✅ PM2 restart: `ssh root@82.165.134.166 "pm2 restart ptght-backend"`
4. ✅ Verify: `curl https://dev.matchleague.org/api/sports/list | jq 'length'`

---

## 📋 WICHTIGE PFADE

### LOCAL
- Project Root: `/Users/A105227786/Documents/projects/sL/pTght`
- Backend: `backend/`
- Frontend: `frontend/`
- Database: `backend/database.sqlite`
- Uploads: `backend/uploads/`

### DEV
- Project Root: `/opt/matchleague/`
- Backend: `/opt/matchleague/backend/`
- Frontend: `/var/www/dev.matchleague.org/`
- Database: `/opt/matchleague/backend/database.sqlite`
- Uploads: `/opt/matchleague/backend/uploads/`
- Nginx Config: `/etc/nginx/sites-available/dev.matchleague.org`
- PM2 Config: `~/.pm2/` (gespeichert)

### SSH
- Key: `~/.ssh/strato-dev_ed25519`
- Host: `root@82.165.134.166`
- Domain: `dev.matchleague.org`

---

## 🎯 ZUSAMMENFASSUNG: WAS MUSS WO WIE SEIN

| Komponente | LOCAL | DEV | Bemerkung |
|------------|-------|-----|-----------|
| API_BASE | `http://localhost:5001/api` | `/api` | Frontend config.js erkennt automatisch |
| CORS_ORIGIN | `http://localhost:3000` | `https://dev.matchleague.org` | In .env setzen |
| Database | `database.sqlite` (144KB) | `database.sqlite` (816KB) | Sync mit Backup! |
| Users | 123 Test-Accounts | 245 echte User | Nicht überschreiben! |
| Sports | 10 | 46 | Vollständige Daten auf Dev |
| Cities | 3 | 37 | Vollständige Daten auf Dev |
| .env Location | `backend/.env` | `/opt/matchleague/backend/.env` | PM2 braucht in backend/ |
| Avatar URLs | `http://localhost:5001/uploads/...` | `https://dev.matchleague.org/uploads/...` | Kein /api prefix! |
| Process | Manuell/Task | PM2 ptght-backend | Auto-restart auf Dev |
| Frontend | Dev Server (3000) | Static Build + Nginx | Rsync nach Build |

---

**Letzte Aktualisierung:** 3. November 2025, 23:30 Uhr
