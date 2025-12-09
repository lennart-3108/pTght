# Datenbank Performance Fix - 8. Dezember 2025

## 🚨 Identifizierte Probleme

### KRITISCH: Fehlende Indexes auf leagues-Tabelle
- **184.224 Leagues** in der Datenbank
- **KEIN Index auf `sport_id`** → Full Table Scan bei jeder Abfrage!
- **KEIN Index auf `city_id`** → Langsame JOINs mit cities-Tabelle
- Die Route `/sports/:id/leagues` war extrem langsam

### Weitere Probleme
- 3 Migrations-Dateien fehlten (20251207_*.js) → Migration-Fehler
- `states` Tabelle existiert nicht in DB
- Cities-Tabelle hat jetzt **4.128 Einträge** (neue Location-Daten)

## ✅ Durchgeführte Fixes

### 1. Fehlende Indexes hinzugefügt
Migration `20251208_add_missing_indexes.js` erstellt und ausgeführt:
- ✅ `idx_leagues_sport_id` - Index auf `leagues.sport_id`
- ✅ `idx_leagues_city_id` - Index auf `leagues.city_id`

### 2. Migration-Inkonsistenz behoben
Fehlende Migrations-Dateien wiederhergestellt:
- `20251207_add_city_hierarchy.js`
- `20251207_add_region_to_countries.js`
- `20251207_create_regions.js`

### 3. Query Optimizer aktualisiert
- `ANALYZE` ausgeführt
- `PRAGMA optimize` ausgeführt

## 📊 Performance-Verbesserung

### Query Plan Vergleich

**VORHER (ohne Index):**
```
SCAN leagues  -- Full table scan über 184.224 Zeilen!
```

**NACHHER (mit Index):**
```
SEARCH leagues USING INDEX idx_leagues_sport_id (sport_id=?)
```

### Benchmark-Ergebnisse

| Query | Ergebnis | Zeit |
|-------|----------|------|
| Leagues für Sport 1 | 3.761 Einträge | **62ms** |
| Leagues + Cities JOIN (100) | 100 Einträge | **2ms** |
| 5x verschiedene Sports | 5x ~3.700 Einträge | **72ms** (Ø 14ms) |

## 🎯 Ergebnis

Die Platform sollte jetzt **deutlich schneller** sein, besonders bei:
- Navigation zwischen verschiedenen Sports
- Anzeige von Leagues
- Jegliche Abfragen die nach `sport_id` filtern

## 📋 Aktuelle DB-Statistiken

```
Tabelle         Einträge    Indexes
-----------------------------------
leagues         184.224     ✅ sport_id, city_id, level, district_id
cities          4.128       ✅ type, parent_city_id, name, (name, state_id)
countries       3           ✅ region_id, iso2, code
districts       1           ✅ name, city_id
matches         6.878       
teams           0           
users           5           
```

## 🔍 Empfehlungen

1. **Regelmäßig `ANALYZE` ausführen** nach großen Daten-Imports
2. **Monitoring einrichten** für langsame Queries
3. **States-Tabelle klären** - wird referenziert, existiert aber nicht
4. **Leagues-Anzahl prüfen** - 184k Leagues wirken sehr viel, eventuell Duplikate?

## 🛠️ Verwendete Dateien

- Migration: `backend/migrations/20251208_add_missing_indexes.js`
- Test-Script: `backend/check_db_performance.js`
- DB-Datei: `backend/sportplattform.db` (85 MB)
