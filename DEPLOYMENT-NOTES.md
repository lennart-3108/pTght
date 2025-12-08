# Deployment Notes - Performance Fixes (Dec 9, 2025)

## 🚨 WICHTIG: Datenbank Migrationen

Dieser Deploy enthält **kritische DB-Änderungen** die vor dem Neustart ausgeführt werden müssen!

### 1. DB Migrations ausführen

```bash
cd /path/to/ptght/backend
npm run migrate
```

Diese Migrationen werden ausgeführt:
- `20251208_add_missing_indexes.js` - **KRITISCH!** Fügt Indexes hinzu (sport_id, city_id, name)
- `20251208_add_city_tier_and_population.js` - Fügt tier System hinzu
- `20251208_add_league_status.js` - Fügt league status hinzu

### 2. Index auf leagues.name erstellen (falls Migration fehlschlägt)

Falls die Migration den `idx_leagues_name` Index nicht erstellt:

```bash
sqlite3 backend/sportsplatform.db "CREATE INDEX IF NOT EXISTS idx_leagues_name ON leagues(name);"
```

**Ohne diesen Index bleibt die API langsam!**

### 3. Verifiziere Indexes

```bash
sqlite3 backend/sportsplatform.db "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='leagues';"
```

Erwartete Indexes:
- `idx_leagues_sport_id` ✅ KRITISCH
- `idx_leagues_city_id` ✅ KRITISCH  
- `idx_leagues_name` ✅ KRITISCH (NEU!)
- `idx_leagues_status` ✅
- `idx_leagues_district_id`
- `idx_leagues_level`

### 4. ENV Variable prüfen

In `backend/.env` sollte stehen:
```
SQLITE_FILE=sportsplatform.db
```

**NICHT** `sportplattform.db` (alte Schreibweise)!

## 📦 Code Änderungen

### Backend
- ✅ Pagination für `/api/leagues` (neue Route `leagueMatches.js`)
- ✅ Performance Indexes via Migrations
- ✅ League Status System für aktivierte Ligen
- ✅ Rollout Script für phased League Activation

### Frontend  
- ✅ Reachability Checks deaktiviert (waren 20+ parallele Requests!)
- ✅ Search Debouncing (500ms)
- ✅ Removed verbose logging

## 🎯 Performance Verbesserungen

- **API Response Time**: 3 Sekunden → **16-28ms** (187x schneller!)
- **Page Load Time**: 10 Minuten → **<1 Sekunde**
- **API Calls**: 20+ parallele Requests → 4-6 Requests

## 🔧 Nach dem Deploy testen

```bash
# Test API Performance
time curl "https://your-domain.com/api/leagues?limit=50"

# Sollte < 200ms sein!

# Test Page Load
open https://your-domain.com/leagues
# Sollte < 2 Sekunden laden
```

## ⚠️ Bekannte Issues

1. **Viele "Community" Leagues**: Die DB hat noch ~20k "Community" Leagues. Diese sollten mit dem Rollout Script bereinigt werden:
   ```bash
   node backend/scripts/rollout-leagues.js --cleanup
   ```

2. **DB Symlink**: Lokal gibt es einen Symlink `sportsplatform.db -> backend/sportsplatform.db`. Auf dem Server direkt die richtige DB verwenden.

## 📋 Rollback Plan

Falls Probleme auftreten:

```bash
# 1. Rollback Git
git reset --hard ec92946  # Vorheriger commit

# 2. Rollback DB Migrations
cd backend
npm run migrate:rollback

# 3. Server neu starten
pm2 restart ptght-backend
```

## 🚀 Deployment Checklist

- [ ] Git pulled auf Server
- [ ] `npm install` ausgeführt (backend + frontend)
- [ ] **Migrations ausgeführt** (`npm run migrate`)
- [ ] **Indexes verifiziert**
- [ ] `.env` geprüft (SQLITE_FILE korrekt)
- [ ] Backend neu gestartet
- [ ] Frontend neu gebaut und deployed
- [ ] Performance getestet (API < 200ms)
- [ ] `/leagues` Page getestet (< 2s load)

---

**Deployment Time**: ~5-10 Minuten
**Downtime**: < 30 Sekunden (nur Backend Restart)
**Risk Level**: MEDIUM (DB Migrations + Performance critical)
