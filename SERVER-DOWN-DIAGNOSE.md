# 🔴 DEV-SERVER DIAGNOSE - NICHT ERREICHBAR

**Stand**: 12. Januar 2026, 01:XX Uhr

## Problem
- **Server**: dev.matchleague.org (82.165.134.166)
- **Status**: Komplett offline / nicht erreichbar
- **DNS**: ✅ Korrekt aufgelöst zu 82.165.134.166
- **Ping**: ❌ 100% Packet Loss
- **HTTP/HTTPS**: ❌ Connection Timeout (75 Sekunden)

## Mögliche Ursachen

### 1. Server ist komplett offline
- VPS wurde heruntergefahren
- Strato-Wartung
- Stromausfall im Rechenzentrum

**Lösung**: Strato Control Panel checken und Server neu starten

### 2. Firewall blockiert alle Verbindungen
- Firewall-Regel wurde geändert
- Port 22 (SSH), 80 (HTTP), 443 (HTTPS) sind blockiert

**Lösung**: Über Strato Control Panel Firewall-Einstellungen prüfen

### 3. Node/PM2 Prozess abgestürzt
- Backend läuft nicht mehr
- Frontend wird nicht ausgeliefert

**Lösung**: Über SSH neu starten (falls SSH erreichbar)

### 4. Nginx/Webserver down
- Nginx ist gestoppt
- Konfigurationsfehler

**Lösung**: `systemctl restart nginx`

### 5. IP-Adresse hat sich geändert
- Strato hat neue IP vergeben
- DNS ist veraltet

**Lösung**: IP im Strato Panel prüfen und DNS aktualisieren

---

## Sofort-Maßnahmen

### 1. Strato Control Panel checken
```
https://www.strato.de/apps/CustomerService
```

**Was prüfen:**
- [ ] Server-Status (Running/Stopped)
- [ ] Aktuelle IP-Adresse
- [ ] Firewall-Regeln
- [ ] Letzte Logs/Events

### 2. Alternative SSH-Verbindung versuchen

```bash
# Via Root-User (falls eingerichtet)
ssh -i ~/.ssh/strato-dev_ed25519 root@82.165.134.166

# Oder via SFTP-User
ssh rsftp_matchle@ssh.strato.de
```

### 3. Server-Neustart über Strato Panel

Falls Server offline:
1. Einloggen ins Strato Control Panel
2. Server Management → Server auswählen
3. "Restart" oder "Start" klicken
4. 2-3 Minuten warten
5. Erneut pingen

---

## Nach Server-Neustart: Deployment durchführen

### Schritt 1: SSH-Verbindung testen
```bash
ssh rsftp_matchle@ssh.strato.de
```

### Schritt 2: Code deployen
```bash
cd /matchleague.org

# Code aktualisieren
git fetch origin
git checkout dev
git pull origin dev

# Sollte Commit 26fc91b sein
git log --oneline -1
```

### Schritt 3: Backend starten
```bash
cd backend

# Dependencies
npm install

# Migrationen
npx knex migrate:latest

# Prozesse stoppen
pkill -f node || true

# Neu starten
nohup npm start > logs/backend.log 2>&1 &
echo $! > backend.pid

# Logs checken
sleep 3
tail -50 logs/backend.log
```

### Schritt 4: Frontend deployen
```bash
cd ../frontend
npm install
npm run build

cd ..
rm -rf backend/public
cp -r frontend/build backend/public
```

### Schritt 5: Testen
```bash
# Lokal auf Server
curl http://localhost:5001/api/health

# Von außen (aus anderem Terminal)
curl https://dev.matchleague.org
```

---

## Wichtige Infos für Strato Support

Falls du Strato kontaktieren musst:

**Server-Details:**
- Domain: dev.matchleague.org
- IP: 82.165.134.166
- Paket: VPS / Virtual Server
- Account: rsftp_matchle@ssh.strato.de

**Problem:**
- Server antwortet nicht auf Ping, HTTP, HTTPS
- Kompletter Connection Timeout
- Seit: [Zeitpunkt eintragen]

**Benötigt:**
- Server-Neustart
- Zugriff auf Server-Konsole
- Überprüfung der Netzwerkverbindung

---

## Deployment bereit

✅ Code ist auf GitHub gepusht:
- **Branch**: dev
- **Commit**: 26fc91b
- **Änderungen**:
  - SQL-Fehler behoben (users.name → users.username)
  - Timeout erhöht (3s → 10s)
  - Einheitliches Design für alle Benachrichtigungen
  - Grüner Container mit Icons für alle Notification-Typen

✅ Build ist lokal erstellt:
- Frontend: `/Users/A105227786/Documents/projects/sL/pTght/frontend/build`
- Backend dependencies: Aktualisiert
- Migrationen: Bereit

---

## Alternative: Lokalen Dev-Server nutzen

Falls Strato-Server länger down bleibt, kannst du lokal weiterarbeiten:

```bash
cd /Users/A105227786/Documents/projects/sL/pTght

# Backend starten
cd backend
npm start > logs/backend.log 2>&1 &

# In neuem Terminal: Frontend
cd frontend
npm start
```

Dann erreichbar unter:
- Frontend: http://localhost:3000
- Backend: http://localhost:5001

---

## Nächste Schritte

1. **JETZT**: Strato Control Panel öffnen und Server-Status prüfen
2. **Falls offline**: Server neu starten
3. **Nach Start**: SSH-Verbindung testen
4. **Dann**: Deployment durchführen (siehe oben)
5. **Testen**: curl https://dev.matchleague.org

**Timeline:**
- Server-Neustart: ~2-5 Minuten
- Deployment: ~5-10 Minuten
- Gesamt: ~15 Minuten bis Server wieder läuft
