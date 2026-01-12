# 🚀 DEPLOYMENT ANLEITUNG - DEV SERVER

## ⚠️ SERVER STATUS: NICHT ERREICHBAR
- IP: 82.165.134.166 (dev.matchleague.org)
- Problem: Server antwortet nicht auf Ping/HTTP
- Mögliche Ursache: Server offline, Firewall, oder Node-Prozess gestoppt

## ✅ Code ist bereit
- Commit: `26fc91b`
- Branch: `dev`
- Nachricht: "fix: Einheitliches Design für alle Benachrichtigungen - grüner Container mit Icons"

## 📝 Was wurde gefixt:
1. **SQL-Fehler**: `users.name` → `users.username` (Spalte existierte nicht)
2. **Timeout-Fehler**: 3000ms → 10000ms (verhindert "signal is aborted without reason")
3. **Design-Vereinheitlichung**: ALLE Benachrichtigungen haben jetzt grünen Container mit Icons
4. **NewsPage**: Avatare hinzugefügt + einheitliches Button-Design

---

## 🔧 MANUELLE DEPLOYMENT-SCHRITTE

### Verbindung zum Strato Server:

```bash
# Via SSH
ssh rsftp_matchle@ssh.strato.de
```

**Falls SSH nicht funktioniert, alternative Verbindungsmethoden:**
- SFTP: `sftp rsftp_matchle@ssh.strato.de`
- Strato Control Panel: https://www.strato.de/apps/CustomerService

---

### 1. Server-Status überprüfen

```bash
cd /matchleague.org

# Check if server is running
ps aux | grep node

# Check PM2 status (falls PM2 verwendet wird)
pm2 list
pm2 logs backend --lines 50
```

---

### 2. Code aktualisieren

```bash
cd /matchleague.org
git fetch origin
git checkout dev
git pull origin dev

# Verifiziere Commit
git log --oneline -1
# Sollte sein: 26fc91b fix: Einheitliches Design für alle Benachrichtigungen - grüner Container mit Icons
```

---

### 3. Backend Dependencies + Migration

```bash
cd backend

# Dependencies installieren
npm install

# WICHTIG: Datenbank-Migrationen
npm run migrate
# ODER direkt:
npx knex migrate:latest

# Verifiziere Migrations-Status
npx knex migrate:currentVersion
```

---

### 4. Frontend bauen

```bash
cd ../frontend
npm install
npm run build

# Frontend zum Backend kopieren
cd ..
rm -rf backend/public
cp -r frontend/build backend/public
```

---

### 5. Backend neu starten

**Option A: Mit PM2 (empfohlen)**
```bash
cd backend
pm2 restart backend
pm2 logs backend --lines 30
```

**Option B: Direkt mit Node**
```bash
cd backend

# Alte Prozesse stoppen
pkill -f "node.*server.js" || true

# Neu starten
nohup npm start > logs/backend.log 2>&1 &

# Logs checken
sleep 3
tail -50 logs/backend.log
```

---

### 6. Server-Health überprüfen

```bash
# Checke ob Server läuft
curl http://localhost:5001/api/health

# Checke Logs
tail -50 /matchleague.org/backend/logs/backend.log

# Checke DB-Verbindung
cd /matchleague.org/backend
sqlite3 sportsplatform.db "SELECT COUNT(*) FROM notifications;"
```

---

## 🎯 SCHNELL-VERSION (Copy & Paste)

**Falls Server läuft und du nur Code aktualisieren willst:**

```bash
ssh rsftp_matchle@ssh.strato.de

cd /matchleague.org && \
git pull origin dev && \
cd backend && \
npm install && \
npx knex migrate:latest && \
cd ../frontend && \
npm install && \
npm run build && \
cd .. && \
rm -rf backend/public && \
cp -r frontend/build backend/public && \
cd backend && \
pm2 restart backend && \
pm2 logs backend --lines 30
```

---

## 🆘 TROUBLESHOOTING

### Server komplett neu starten:

```bash
ssh rsftp_matchle@ssh.strato.de

cd /matchleague.org/backend

# Alle Node-Prozesse stoppen
pkill -f node || true

# Logs leeren
> logs/backend.log

# Neu starten
nohup npm start > logs/backend.log 2>&1 &

# PID speichern
echo $! > backend.pid

# Warten und Logs checken
sleep 5
tail -100 logs/backend.log
```

### Datenbank-Probleme:

```bash
cd /matchleague.org/backend

# Backup erstellen
cp sportsplatform.db sportsplatform.db.backup_$(date +%Y%m%d_%H%M%S)

# Migrations-Status
npx knex migrate:list

# Falls Migration fehlschlägt, manuell rollback
npx knex migrate:rollback

# Dann erneut migrieren
npx knex migrate:latest
```

### Port bereits belegt:

```bash
# Finde Prozess auf Port 5001
lsof -i :5001

# Stoppe Prozess
kill -9 <PID>

# Oder alle Node-Prozesse
pkill -9 node
```

---

## 📊 Nach dem Deployment checken:

1. **Backend läuft**: `curl http://localhost:5001/api/health`
2. **Frontend erreichbar**: Browser öffnen auf https://dev.matchleague.org
3. **Benachrichtigungen laden**: Login → Bell-Icon klicken
4. **DB hat Migrationen**: `npx knex migrate:currentVersion`
5. **Logs sind sauber**: `tail -50 logs/backend.log`

---

## 🔍 WICHTIGE DB-MIGRATION

Falls die `users.name` Spalte fehlt, wurde die Migration bereits im Code behoben:
- `users.name` wurde zu `users.username` geändert
- Diese Spalte existiert bereits in der DB
- Keine manuelle Migration nötig

---

## 📞 KONTAKT BEI PROBLEMEN

Falls der Server nicht startet:
1. Checke logs: `tail -200 /matchleague.org/backend/logs/backend.log`
2. Checke Nginx logs (falls vorhanden): `tail -100 /var/log/nginx/error.log`
3. Checke System-Ressourcen: `free -h`, `df -h`
4. Strato Support kontaktieren falls Server komplett down ist
