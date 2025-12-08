# Quick Reference: DB Migrations Checklist

## Auf dem Server ausführen

```bash
# 1. Code pullen
cd /path/to/ptght
git pull origin dev

# 2. Dependencies updaten
cd backend && npm install
cd ../frontend && npm install

# 3. KRITISCH: Migrations ausführen
cd backend
npm run migrate

# 4. Indexes verifizieren (WICHTIG!)
sqlite3 sportsplatform.db "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='leagues';"

# Erwartete Ausgabe muss enthalten:
# - idx_leagues_sport_id
# - idx_leagues_city_id  
# - idx_leagues_name ← NEU! KRITISCH für Performance!
# - idx_leagues_status

# 5. Falls idx_leagues_name fehlt, manuell erstellen:
sqlite3 sportsplatform.db "CREATE INDEX idx_leagues_name ON leagues(name);"

# 6. Services neu starten
pm2 restart ptght-backend
pm2 restart ptght-frontend  # oder nginx reload

# 7. Performance testen
time curl "http://localhost:5001/api/leagues?limit=50"
# Sollte < 200ms sein!
```

## Was die Migrationen machen

| Migration | Was passiert | Wichtigkeit |
|-----------|-------------|-------------|
| `20251208_add_missing_indexes.js` | Erstellt `idx_leagues_sport_id`, `idx_leagues_city_id` | 🔴 KRITISCH |
| Manual Index | Erstellt `idx_leagues_name` für ORDER BY | 🔴 KRITISCH |
| `20251208_add_city_tier_and_population.js` | Fügt `tier`, `population`, `leagues_enabled` zu cities | 🟡 Optional |
| `20251208_add_league_status.js` | Fügt `status`, `activated_at` zu leagues | 🟡 Optional |

## Rollback (falls nötig)

```bash
cd backend
npm run migrate:rollback
git reset --hard ec92946
pm2 restart ptght-backend
```

## Erfolg verifizieren

```bash
# API Performance Check (muss < 200ms sein)
time curl -s "http://localhost:5001/api/leagues?limit=50" | jq '.data | length'

# League Count
sqlite3 sportsplatform.db "SELECT COUNT(*) FROM leagues;"

# Indexes Check
sqlite3 sportsplatform.db ".indexes leagues"
```

## Bei Problemen

1. **"table `leagues` has no column named `status`"**
   → Migration nicht gelaufen: `npm run migrate`

2. **API immer noch langsam (>1s)**
   → Index fehlt: `CREATE INDEX idx_leagues_name ON leagues(name);`

3. **"no such table: regions"**  
   → Alte Migration - ignorieren, wird nicht gebraucht

---

**Total Time**: ~2 Minuten
**Downtime**: ~30 Sekunden
