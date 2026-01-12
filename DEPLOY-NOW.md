# 🚀 DEPLOYMENT ANLEITUNG

## ✅ Änderungen committed und gepusht
- Commit: `cf73a78`
- Branch: `dev`
- Nachricht: "fix: Benachrichtigungssystem komplett - SQL Fehler behoben, Timeout erhöht, Design verbessert"

## 📝 Was wurde gefixt:
1. **SQL-Fehler**: `users.name` → `users.username` (Spalte existierte nicht)
2. **Timeout-Fehler**: 3000ms → 10000ms (verhindert "signal is aborted without reason")
3. **Design**: Terminvorschläge jetzt mit grünem Container wie in TerminManagerModalV2
4. **NewsPage**: Avatare hinzugefügt für bessere visuelle Darstellung

---

## 🔧 MANUELLE DEPLOYMENT-SCHRITTE

### 1. Mit Server verbinden
```bash
ssh rsftp_matchle@ssh.strato.de
# Passwort eingeben
```

### 2. Code aktualisieren
```bash
cd /matchleague.org
git fetch origin
git checkout dev
git pull origin dev
```

### 3. Backend Dependencies installieren
```bash
cd backend
npm install
```

### 4. Backend neu starten
```bash
# PM2 neu starten (wenn vorhanden)
pm2 restart backend

# ODER: Node-Prozess neu starten
pkill -f "node.*server.js"
nohup npm start > logs/backend.log 2>&1 &
```

### 5. Frontend bauen (falls noch nicht gebaut)
```bash
cd ../frontend
npm install
npm run build
```

### 6. Frontend deployen
```bash
cd ..
cp -r frontend/build backend/public
```

### 7. Überprüfen
```bash
# Backend-Logs checken
tail -50 backend/logs/backend.log

# Server-Status
curl -I http://localhost:5001/api/health
```

---

## 🎯 SCHNELL-VERSION (Copy & Paste)

```bash
# Alles in einem Schritt:
ssh rsftp_matchle@ssh.strato.de << 'ENDSSH'
cd /matchleague.org
git pull origin dev
cd backend
npm install
pkill -f "node.*server.js" || true
nohup npm start > logs/backend.log 2>&1 &
sleep 3
tail -30 logs/backend.log
ENDSSH
```

---

## ⚠️ WICHTIG: PROPOSAL_NOT_ACTIVE Fehler

Der Fehler `{"error":"PROPOSAL_NOT_ACTIVE"}` im Screenshot bedeutet:
- Der Terminvorschlag ist nicht mehr im Status "sent"
- Mögliche Ursachen:
  1. Vorschlag wurde bereits angenommen/abgelehnt
  2. Vorschlag wurde zurückgezogen
  3. Status in DB ist nicht "sent"

**Debug-Abfrage auf dem Server:**
```bash
cd /matchleague.org/backend
sqlite3 sportsplatform.db "SELECT id, status, proposer_user_id, recipient_user_id, proposed_datetime FROM termin_proposals ORDER BY created_at DESC LIMIT 5;"
```

Falls nötig, Status manuell zurücksetzen:
```bash
sqlite3 sportsplatform.db "UPDATE termin_proposals SET status='sent' WHERE id=<PROPOSAL_ID>;"
```
