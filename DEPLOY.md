# 🚀 Deployment Anleitung

## Schnell-Deployment (empfohlen)

### 1. SSH-Key zum Agent hinzufügen (einmalig pro Session)
```bash
ssh-add ~/.ssh/strato-dev_ed25519
```
Gib die Passphrase ein.

### 2. Deployment ausführen
```bash
./deploy-to-server.sh
```

---

## Manuelles Deployment

### Mit SSH verbinden
```bash
ssh -i ~/.ssh/strato-dev_ed25519 root@82.165.134.166
```

### Auf dem Server ausführen
```bash
cd /opt/matchleague

# 1. Git Pull
git pull origin dev

# 2. Backend Dependencies & Migration
cd backend
npm ci
npm run migrate

# 3. Backend Restart
pm2 restart ptght-backend

# 4. Frontend Build
cd ../frontend
npm ci
npm run build

# 5. Frontend Deploy
rm -rf /var/www/dev.matchleague.org/*
cp -r build/* /var/www/dev.matchleague.org/

# 6. Nginx Reload
nginx -t && systemctl reload nginx

# 7. Status prüfen
pm2 status
pm2 logs ptght-backend --lines 20
```

---

## Wichtige Änderungen in diesem Deployment

✅ **Datenbank-Migrationen:**
- `20251025_add_asset_booking_rules.js` - Booking-Regeln für Assets

✅ **Neue Backend-Features:**
- Slot Generator API (`/api/slot-generator`)
- Booking Stats API (`/api/booking-stats`)
- Aktualisierte Slots Search API (datetime parameter)
- Cities Endpoint (`/api/locations/cities`)

✅ **Neue Frontend-Seiten:**
- LocationManagerPage mit Reporting
- Überarbeitete BookingPage (direkter Input)
- MyBookingsPage
- BookingReportingPage

---

## Troubleshooting

### SSH Key Passphrase vergessen?
Nutze den Standard-Key:
```bash
ssh -i ~/.ssh/id_ed25519 root@82.165.134.166
```

### PM2 Backend läuft nicht?
```bash
ssh -i ~/.ssh/strato-dev_ed25519 root@82.165.134.166
cd /opt/matchleague/backend
PORT=5001 pm2 start server.js --name ptght-backend
pm2 save
```

### Frontend nicht aktualisiert?
```bash
# Auf dem Server:
cd /opt/matchleague/frontend
npm run build
rm -rf /var/www/dev.matchleague.org/*
cp -r build/* /var/www/dev.matchleague.org/
```

### Logs anschauen
```bash
ssh -i ~/.ssh/strato-dev_ed25519 root@82.165.134.166 "pm2 logs ptght-backend --lines 50"
```
