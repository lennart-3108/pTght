# Migration Guide: SQLite → PostgreSQL

## Warum PostgreSQL?

### Performance-Vorteile
- ✅ **Concurrent Writes**: Tausende gleichzeitige Schreibzugriffe
- ✅ **Better Indexing**: Partial indexes, GIN, GiST für geo-queries
- ✅ **Connection Pooling**: PgBouncer für 10.000+ connections
- ✅ **Full Text Search**: Native PostgreSQL FTS
- ✅ **JSON Support**: Bessere Performance als SQLite
- ✅ **Partitioning**: Tabellen nach Stadt/Region partitionieren

### Skalierung
- SQLite: Gut bis ~100k Leagues
- PostgreSQL: Problemlos 10M+ Leagues

## Migration Steps

### 1. PostgreSQL starten

```bash
# Docker Compose starten
docker-compose -f docker-compose.postgres.yml up -d

# Prüfen ob läuft
docker ps | grep postgres

# pgAdmin öffnen
open http://localhost:5050
```

### 2. Daten migrieren

```bash
# SQLite Dump erstellen
cd backend
sqlite3 sportplattform.db .dump > backup.sql

# Zu PostgreSQL konvertieren (Script nutzen)
node scripts/migrate-sqlite-to-postgres.js

# Oder manuell:
# 1. Schema migrieren (Knex migrations)
DATABASE_URL=postgresql://... npm run migrate

# 2. Daten importieren
node scripts/import-from-sqlite.js
```

### 3. Backend konfigurieren

```bash
# .env anpassen
cp .env.postgres .env

# Backend neu starten
PORT=5001 node server.js
```

### 4. Testen

```bash
# Health check
curl http://localhost:5001/api/health

# Performance test
node scripts/benchmark-db.js
```

## Phased Rollout Strategy

### Phase 1: Tier 1 Cities (Sofort)
- **Cities**: Berlin, Hamburg, München, Köln, etc. (~15 Städte)
- **Population**: >100.000
- **Leagues**: ~735 (15 cities × 49 sports)
- **Timeline**: Sofort verfügbar

```bash
# Tier berechnen und Phase 1 aktivieren
node backend/scripts/rollout-leagues.js --calculate
node backend/scripts/rollout-leagues.js --phase 1
```

### Phase 2: Tier 2 Cities (+2 Wochen)
- **Cities**: Große Städte >50k (~50 Städte)
- **Leagues**: +2.450
- **Total**: ~3.185 Leagues

```bash
node backend/scripts/rollout-leagues.js --phase 2
```

### Phase 3: Tier 3 Cities (+1 Monat)
- **Cities**: Mittelstädte >10k (~200 Städte)
- **Leagues**: +9.800
- **Total**: ~12.985 Leagues

```bash
node backend/scripts/rollout-leagues.js --phase 3
```

### Phase 4: All Cities (+3 Monate)
- **Cities**: Alle Städte (~4.000 Städte)
- **Leagues**: ~196.000 (theoretisch, aber lazy created!)
- **Real**: Nur ~10-20k aktive Leagues

## Lazy League Creation

Statt alle Leagues vorab zu erstellen:

```javascript
// Wenn User Liga beitritt
async function joinOrCreateLeague(userId, cityId, sportId) {
  // 1. Prüfe ob Stadt freigeschaltet
  const city = await db('cities')
    .where('id', cityId)
    .first();
  
  if (!city.leagues_enabled) {
    throw new Error('Leagues not yet available in this city');
  }
  
  // 2. Suche oder erstelle Liga
  let league = await db('leagues')
    .where({ city_id: cityId, sport_id: sportId, status: 'active' })
    .first();
  
  if (!league) {
    league = await db('leagues').insert({
      name: `${city.name} ${sport.name} Liga`,
      city_id: cityId,
      sport_id: sportId,
      status: 'active',
      activated_at: new Date()
    }).returning('*');
  }
  
  // 3. User hinzufügen
  await db('user_leagues').insert({ user_id: userId, league_id: league.id });
}
```

## Cleanup Strategy

```bash
# Regelmäßig ausführen (cronjob)
node backend/scripts/rollout-leagues.js --cleanup

# Was wird gemacht:
# - Leagues ohne Members → status: 'archived'
# - Archived Leagues älter als 90 Tage → DELETE
```

## Monitoring

```bash
# Statistiken anzeigen
node backend/scripts/rollout-leagues.js --stats

# Output:
# 📊 League Rollout Statistics
# Cities by Tier:
#   Tier 1 - Major Cities        15/15 enabled
#   Tier 2 - Large Cities         0/50 enabled
# Leagues by Status:
#   active          1,234
#   inactive        182,990
#   archived        0
```

## Performance Optimization

### PostgreSQL Tuning

```sql
-- Partitionierung nach Stadt-Tier
CREATE TABLE leagues_tier1 PARTITION OF leagues 
  FOR VALUES IN (SELECT id FROM cities WHERE tier = 1);

-- Materialized View für schnelle Stats
CREATE MATERIALIZED VIEW league_stats AS
SELECT 
  c.tier,
  l.sport_id,
  COUNT(DISTINCT l.id) as leagues,
  COUNT(DISTINCT ul.user_id) as members
FROM leagues l
JOIN cities c ON c.id = l.city_id
LEFT JOIN user_leagues ul ON ul.league_id = l.id
WHERE l.status = 'active'
GROUP BY c.tier, l.sport_id;

-- Index auf häufige Queries
CREATE INDEX idx_leagues_city_sport ON leagues(city_id, sport_id) 
  WHERE status = 'active';
```

### Connection Pooling

```javascript
// backend/db-postgres.js
const knex = require('knex')({
  client: 'postgresql',
  connection: process.env.DATABASE_URL,
  pool: { 
    min: 2, 
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  }
});
```

## Rollback Plan

Falls Probleme auftreten:

```bash
# 1. Backend auf SQLite zurück
cp .env.sqlite .env
pm2 restart backend

# 2. Daten von PostgreSQL zurück holen (falls nötig)
pg_dump sportplattform > backup_postgres.sql
node scripts/postgres-to-sqlite.js
```

## Kosten

### PostgreSQL Hosting

**Development**:
- Docker lokal: Kostenlos
- Render.com: $7/Monat (256MB RAM)

**Production**:
- Digital Ocean: $15/Monat (1GB RAM, 10GB Storage)
- AWS RDS: $25-50/Monat (t3.micro)
- Heroku Postgres: $50/Monat (Standard Plan)

**Skalierung**:
- 100k Leagues + 10k Users: $15/Monat ausreichend
- 1M Leagues + 100k Users: $50-100/Monat
- 10M Leagues + 1M Users: $200-500/Monat

## Empfehlung

1. ✅ **Jetzt starten**: PostgreSQL Docker lokal
2. ✅ **Phase 1**: Nur Tier 1 Cities (15 Städte)
3. ✅ **Lazy Creation**: Leagues on-demand erstellen
4. ✅ **Monitor**: Nach 2 Wochen Phase 2 starten
5. ✅ **Scale**: Bei Erfolg auf managed PostgreSQL (Render/DO)

Mit diesem Ansatz:
- Start mit ~735 Leagues statt 184k
- Wächst organisch mit Nutzern
- PostgreSQL kann später Millionen Leagues handeln
- Kosten bleiben niedrig
