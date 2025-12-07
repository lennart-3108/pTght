# Database Quality & Redundancy Report
**Datum**: 7. Dezember 2025  
**Datenbank**: sportplattform.db (SQLite)

---

## Executive Summary

### ✅ Gut
- Foreign Keys korrekt definiert
- Primärschlüssel auf allen Tabellen
- Cascading Deletes wo sinnvoll
- Gute Normalisierung (3NF)

### ⚠️ Probleme gefunden
1. **Redundante Tabelle**: `games` ist veraltet (0 Einträge, ersetzt durch `matches`)
2. **Leere Tabelle**: `sport_categories` (0 Einträge, aber in API-Code referenziert)
3. **Verwaiste Daten**: 2 user_leagues Einträge mit nicht-existierenden User-IDs
4. **Fehlende Indizes**: Einige Foreign Keys ohne Index
5. **Schema-Inkonsistenzen**: `sports` Tabelle hat redundante Spalten

---

## 1. Tabellen-Übersicht (40 Tabellen)

### Core Tables (mit Daten)
| Tabelle | Zeilen | Indizes | Status |
|---------|--------|---------|--------|
| `leagues` | 1058 | 2 | ✅ Aktiv |
| `sports` | 46 | 1 | ✅ Aktiv |
| `cities` | 23 | 3 | ✅ Aktiv |
| `slots` | 14 | 1 | ✅ Aktiv |
| `assets` | 3 | 1 | ✅ Aktiv |
| `matches` | 2 | 1 | ✅ Aktiv |
| `locations` | 1 | 3 | ✅ Aktiv |
| `users` | 1 | 2 | ✅ Aktiv |

### Empty Tables (potenziell redundant)
| Tabelle | Zeilen | Problem |
|---------|--------|---------|
| `games` | 0 | 🔴 **REDUNDANT** - Ersetzt durch `matches` |
| `sport_categories` | 0 | 🟡 **UNUSED** - API sucht danach, aber leer |
| `countries` | 0 | 🟡 Geo-Feature nicht aktiv |
| `teams` | 0 | 🟡 Kein Team erstellt bisher |
| `bookings` | 0 | 🟡 Booking-Feature nicht genutzt |

### Junction/Relation Tables
| Tabelle | Zeilen | Status |
|---------|--------|--------|
| `user_leagues` | ? | ⚠️ 2 verwaiste Einträge |
| `team_members` | ? | ✅ OK |
| `user_sports` | ? | ✅ OK |
| `user_seasons` | ? | ✅ OK |

---

## 2. Redundanz-Analyse

### 🔴 Kritisch: `games` vs `matches`

**Problem**: Zwei Tabellen für die gleiche Funktionalität

#### `games` Tabelle (ALT, 11 Spalten)
```sql
CREATE TABLE `games` (
  `id` INTEGER PRIMARY KEY,
  `league_id` INTEGER,
  `kickoff_at` TEXT,
  `home_user_id` INTEGER,
  `away_user_id` INTEGER,
  `home_team_id` INTEGER,
  `away_team_id` INTEGER,
  `home` TEXT,
  `away` TEXT,
  `home_score` INTEGER,
  `away_score` INTEGER
)
```
- ❌ Keine Foreign Keys
- ❌ Kein `created_at`
- ❌ Kein `status` Feld
- ❌ Kein `season_id`
- ❌ Kein `ruleset_id`
- **0 Einträge** - wird nicht verwendet!

#### `matches` Tabelle (NEU, 17 Spalten)
```sql
CREATE TABLE "matches" (
  `id` INTEGER PRIMARY KEY,
  `league_id` INTEGER NOT NULL,
  `kickoff_at` TEXT,
  `status` TEXT,
  `home_user_id` INTEGER,
  `away_user_id` INTEGER,
  `home_team_id` INTEGER,
  `away_team_id` INTEGER,
  `home_score` INTEGER,
  `away_score` INTEGER,
  `created_at` TEXT DEFAULT CURRENT_TIMESTAMP,
  `home` TEXT,
  `away` TEXT,
  `season_id` INTEGER,
  `kickoff_end_at` TEXT,
  `ruleset_id` INTEGER,
  `location` TEXT,
  FOREIGN KEY (`ruleset_id`) REFERENCES `rulesets` (`id`)
)
```
- ✅ Foreign Key Constraints
- ✅ Status-Tracking
- ✅ Season-Support
- ✅ Ruleset-Integration
- ✅ Timestamps
- **2 Einträge** - aktiv in Verwendung

**Empfehlung**: `games` Tabelle kann sicher gelöscht werden!

---

### 🟡 Mittel: `sport_categories` Tabelle leer

**Problem**: API-Code (`backend/src/routes/sports.js`) referenziert diese Tabelle, aber sie ist leer.

**Aktueller Code (VERALTET)**:
```javascript
// Versucht sport_categories zu joinen
db.all(`SELECT id, name, slug, icon, sort_order 
        FROM sport_categories ORDER BY sort_order`, ...)
```

**Gefixter Code (NEU)**:
```javascript
// Gruppiert Sports direkt nach `type` Spalte
db.all(`SELECT id, name, type, category, parent_id 
        FROM sports ORDER BY name`, ...)
```

**Status**: ✅ Bereits gefixt in aktueller Codebase

**Empfehlung**: 
- Option A: `sport_categories` Tabelle löschen (wird nicht verwendet)
- Option B: Richtig befüllen und `sports.category_id` Foreign Key hinzufügen

---

### 🟡 Klein: `sports` Spalten-Redundanz

**Problem**: Die `sports` Tabelle hat inkonsistente Spalten:

```sql
PRAGMA table_info(sports);
-- 0|id|INTEGER
-- 1|name|TEXT
-- 2|type|varchar(255) -- 'Single' oder 'Team'
-- 3|team_size|INTEGER
-- 4|sport_type|varchar(255) -- redundant zu `type`?
-- 5|parent_id|INTEGER
-- 6|category|varchar(255) -- Text statt FK
```

**Probleme**:
1. `type` vs `sport_type` - möglicherweise redundant
2. `category` ist TEXT statt Foreign Key zu `sport_categories`
3. Keine `sort_order` Spalte für UI-Sortierung

**Empfehlung**:
```sql
-- Bereinigtes Schema
ALTER TABLE sports ADD COLUMN sort_order INTEGER DEFAULT 0;
-- Entweder category als FK oder sport_categories Tabelle entfernen
```

---

## 3. Verwaiste Daten (Orphaned Records)

### user_leagues mit gelöschten Users

**Befund**: 2 Einträge in `user_leagues` referenzieren User-IDs, die nicht in `users` existieren.

```sql
SELECT * FROM user_leagues 
WHERE user_id NOT IN (SELECT id FROM users);
-- Returns 2 rows
```

**Problem**: Foreign Key Constraint fehlt oder nicht enforced.

**Fix**:
```sql
-- Bereinigen
DELETE FROM user_leagues 
WHERE user_id NOT IN (SELECT id FROM users);

-- Sicherstellen dass FK existiert (sollte bereits da sein)
-- PRAGMA foreign_keys = ON;
```

---

## 4. Fehlende Indizes

### Empfohlene Indizes für Performance

```sql
-- Foreign Keys ohne Index (wichtig bei JOINs)
CREATE INDEX IF NOT EXISTS idx_matches_league_id ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_season_id ON matches(season_id);
CREATE INDEX IF NOT EXISTS idx_matches_home_user_id ON matches(home_user_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_user_id ON matches(away_user_id);
CREATE INDEX IF NOT EXISTS idx_matches_home_team_id ON matches(home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_team_id ON matches(away_team_id);

CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams(league_id);
CREATE INDEX IF NOT EXISTS idx_teams_sport_id ON teams(sport_id);
CREATE INDEX IF NOT EXISTS idx_teams_city_id ON teams(city_id);
CREATE INDEX IF NOT EXISTS idx_teams_season_id ON teams(season_id);

CREATE INDEX IF NOT EXISTS idx_leagues_sport_id ON leagues(sport_id);
CREATE INDEX IF NOT EXISTS idx_leagues_city_id ON leagues(city_id);

CREATE INDEX IF NOT EXISTS idx_slots_location_id ON slots(location_id);
CREATE INDEX IF NOT EXISTS idx_slots_start_time ON slots(start_time);
CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(slot_id);
```

**Begründung**: SQLite hat keine automatischen Indizes auf Foreign Keys!

---

## 5. Schema-Inkonsistenzen

### Naming Conventions

**Gemischt**: `snake_case` vs `camelCase`

| Tabelle | Spalte | Problem |
|---------|--------|---------|
| `leagues` | `max_participants` | ✅ snake_case |
| `matches` | `kickoff_at` | ✅ snake_case |
| `cities` | `stateId` | ❌ camelCase |
| `cities` | `countryId` | ❌ camelCase |

**Empfehlung**: Konsistent `snake_case` verwenden (SQL-Standard)

### Timestamp Conventions

**Gemischt**: `TEXT` vs `DATETIME` vs `date`

```sql
-- users
birth_date date  -- OK
location_updated_at datetime  -- OK

-- matches
kickoff_at TEXT  -- SCHLECHT! Sollte DATETIME sein
created_at TEXT  -- SCHLECHT!

-- bookings
start_time DATETIME  -- GUT!
created_at DATETIME  -- GUT!
```

**Empfehlung**: 
- Alle Timestamps als `DATETIME` oder `INTEGER` (Unix Timestamp)
- Nutze `CURRENT_TIMESTAMP` für Defaults

---

## 6. Datenintegrität

### Missing NOT NULL Constraints

Viele wichtige Spalten erlauben NULL, wo es keinen Sinn macht:

```sql
-- leagues
sport_id INTEGER NOT NULL  -- ✅ Gut
city_id INTEGER NOT NULL   -- ✅ Gut

-- matches
home_user_id INTEGER       -- ❌ Sollte NOT NULL sein (oder home_team_id)
away_user_id INTEGER       -- ❌ Sollte NOT NULL sein (oder away_team_id)

-- teams
name TEXT NOT NULL         -- ✅ Gut
league_id INTEGER NOT NULL -- ✅ Gut
sport_id INTEGER           -- ❌ Sollte NOT NULL sein
```

---

## 7. Konkrete Empfehlungen

### Sofort (Kritisch)

1. **Lösche `games` Tabelle**
   ```sql
   DROP TABLE IF EXISTS games;
   ```

2. **Bereinige verwaiste user_leagues**
   ```sql
   DELETE FROM user_leagues 
   WHERE user_id NOT IN (SELECT id FROM users);
   ```

3. **Aktiviere Foreign Key Enforcement**
   ```sql
   PRAGMA foreign_keys = ON;
   ```

### Kurzfristig (Diese Woche)

4. **Erstelle fehlende Indizes** (siehe Sektion 4)

5. **Entscheide über sport_categories**
   - Option A: Löschen
   - Option B: Befüllen und in sports FK hinzufügen

6. **Korrigiere cities Tabelle**
   ```sql
   -- Rename camelCase zu snake_case
   ALTER TABLE cities RENAME COLUMN stateId TO state_id;
   ALTER TABLE cities RENAME COLUMN countryId TO country_id;
   ```

### Mittelfristig (Nächste Sprint)

7. **Timestamp-Konsistenz**
   ```sql
   -- Migration: TEXT → DATETIME für alle Timestamps
   ```

8. **NOT NULL Constraints hinzufügen** (mit Default-Werten für existierende Daten)

9. **Normalisierung prüfen**
   - `sports.category` zu FK machen
   - `matches.location` zu FK auf `locations(id)` machen

---

## 8. Performance-Check

### Slow Queries (potenzielle Probleme)

```sql
-- Diese Query ist langsam ohne Index:
SELECT * FROM matches 
WHERE league_id = 1 AND season_id = 5;
-- FEHLT: idx_matches_league_season

-- Diese Query ist langsam ohne Index:
SELECT * FROM teams 
WHERE league_id = 1 AND season_id = 3;
-- FEHLT: idx_teams_league_season
```

**Empfehlung**: Composite Index erstellen
```sql
CREATE INDEX idx_matches_league_season ON matches(league_id, season_id);
CREATE INDEX idx_teams_league_season ON teams(league_id, season_id);
```

---

## 9. Migrations-Plan

### Migration 1: Bereinigung (SAFE)
```javascript
// 20251207_cleanup_redundant_tables.js
exports.up = async function(knex) {
  // Drop games table (0 rows, unused)
  await knex.schema.dropTableIfExists('games');
  
  // Clean orphaned user_leagues
  await knex.raw(`
    DELETE FROM user_leagues 
    WHERE user_id NOT IN (SELECT id FROM users)
  `);
};

exports.down = async function(knex) {
  // Recreate games table if needed (but empty)
  await knex.schema.createTable('games', table => {
    table.increments('id').primary();
    table.integer('league_id');
    // ... rest of schema
  });
};
```

### Migration 2: Indizes (SAFE, Performance+)
```javascript
// 20251207_add_missing_indexes.js
exports.up = async function(knex) {
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_matches_league_id ON matches(league_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_matches_season_id ON matches(season_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams(league_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_teams_sport_id ON teams(sport_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_leagues_sport_id ON leagues(sport_id)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_leagues_city_id ON leagues(city_id)');
};

exports.down = async function(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_matches_league_id');
  // ... rest
};
```

### Migration 3: Schema-Fix (BREAKING, Vorsicht!)
```javascript
// 20251207_fix_cities_column_names.js
exports.up = async function(knex) {
  // SQLite doesn't support ALTER COLUMN, need to recreate
  await knex.schema.raw(`
    CREATE TABLE cities_new (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      state_id INTEGER,  -- renamed from stateId
      country_id INTEGER, -- renamed from countryId
      FOREIGN KEY(state_id) REFERENCES states(id),
      FOREIGN KEY(country_id) REFERENCES countries(id)
    )
  `);
  
  await knex.raw(`INSERT INTO cities_new SELECT id, name, stateId, countryId FROM cities`);
  await knex.raw(`DROP TABLE cities`);
  await knex.raw(`ALTER TABLE cities_new RENAME TO cities`);
};
```

---

## 10. Zusammenfassung

### Statistik
- **40 Tabellen** gesamt
- **8 Tabellen** mit Daten (aktiv genutzt)
- **1 Tabelle** redundant (`games`)
- **1 Tabelle** ungenutztes Feature (`sport_categories`)
- **2 verwaiste Einträge** in `user_leagues`
- **~15 fehlende Indizes** auf Foreign Keys

### Prioritäten

#### 🔴 Kritisch (heute)
1. ✅ Sports API fix (bereits done!)
2. Drop `games` table
3. Clean orphaned user_leagues

#### 🟡 Wichtig (diese Woche)
4. Add missing indexes
5. Decide on sport_categories (delete or use)

#### 🟢 Nice-to-have (später)
6. Rename camelCase columns to snake_case
7. Timestamp consistency (TEXT → DATETIME)
8. Add NOT NULL constraints where appropriate

---

## 11. Code-Qualität: Backend Routes

### ✅ Gut implementiert
- `backend/src/routes/leagues.js` - Defensive columnInfo checks
- `backend/src/routes/teams.js` - Proper FK validation
- `backend/src/routes/sports.js` - Wurde gerade gefixt!

### ⚠️ Verbesserungspotenzial
- Einige Routes nutzen noch `games` statt `matches` (falls vorhanden)
- Fehlende Paginierung bei großen Result-Sets (z.B. leagues mit 1058 Einträgen!)

---

**Report Ende**

Erstellt: 7. Dezember 2025  
Autor: Database Quality Check Tool
