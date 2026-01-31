# Community League System - Dokumentation

## Übersicht

Das Community League System ermöglicht es, automatisch Ligen für jede Location × Sport Kombination bereitzustellen. Die Ligen werden **lazy** erstellt (on-demand) und müssen vom Admin freigeschaltet werden, bevor User beitreten können.

## Konzept

### Eigenschaften
- **Lazy Creation**: Ligen werden NICHT alle vorab erstellt, sondern erst wenn benötigt
- **Admin Approval**: Neue Community Ligen sind unpublished (published=false) bis Admin sie freischaltet
- **Skalierung**: 10 Locations × 81 Sports = 810 potenzielle Ligen (handhabbar)
- **Effizienz**: Nur aktiv genutzte Ligen werden erstellt

### Datenbankschema

```sql
-- leagues Tabelle
CREATE TABLE leagues (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  location_id INTEGER,  -- Link zu Location
  sport_id INTEGER,     -- Link zu Sport
  city_id INTEGER,      -- Link zu City (für Kompatibilität)
  level VARCHAR(50) DEFAULT 'city',  -- 'community' für Community Ligen
  published BOOLEAN DEFAULT 0,        -- Admin muss freischalten!
  status VARCHAR(20) DEFAULT 'inactive',
  start_date TEXT,
  end_date TEXT,
  -- ... weitere Spalten
);
```

### States

| State | Bedeutung | Sichtbar für User? | Beitreten möglich? |
|-------|-----------|-------------------|-------------------|
| `published=false, level=community` | Neu erstellt, wartet auf Admin | ❌ Nein | ❌ Nein |
| `published=true, level=community` | Freigeschaltet | ✅ Ja | ✅ Ja |
| `level != 'community'` | Normale Liga | ✅ Ja | ✅ Ja |

## API Endpoints

### Admin Publishing Routes (`/api/publishing`)

#### 1. Community League Statistiken
```http
GET /api/publishing/community-leagues/stats
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 45,
    "published": 12,
    "withMembers": 8
  }
}
```

#### 2. Community League erstellen (On-Demand)
```http
POST /api/publishing/community-leagues/create
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "locationId": 123,
  "sportId": 45,
  "autoPublish": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "name": "Fußball Community Liga - Sportplatz Mitte",
    "location_id": 123,
    "sport_id": 45,
    "level": "community",
    "published": false
  }
}
```

#### 3. Community League publishen/unpublishen
```http
PATCH /api/publishing/community-leagues/:id/publish
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "published": true
}
```

#### 4. Bulk-Erstellung für Location (alle Sports)
```http
POST /api/publishing/community-leagues/bulk-create
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "locationId": 123,
  "autoPublish": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "created": 81,
    "leagues": [...]
  }
}
```

### Public Leagues Route (`/leagues`)

Der `/leagues` Endpoint wurde angepasst:
- **Zeigt nur published Community Leagues** (published=true AND level=community)
- Normale Ligen (level != community) werden immer angezeigt

## Service Layer

### `communityLeagueService.js`

```javascript
// Get or create Community League (lazy)
const league = await getOrCreateCommunityLeague(db, locationId, sportId, {
  autoPublish: false  // Admin muss freischalten
});

// Alle Community Ligen für eine Location
const leagues = await getCommunityLeaguesByLocation(db, locationId, {
  publishedOnly: true  // Nur published
});

// Alle Community Ligen für eine Sportart
const leagues = await getCommunityLeaguesBySport(db, sportId);

// Check ob Liga eine Community Liga ist
const isCommunity = await isCommunityLeague(db, leagueId);

// Publish/Unpublish
const league = await setCommunityLeaguePublished(db, leagueId, true);

// Statistiken
const stats = await getCommunityLeagueStats(db);
```

## User Flow

### 1. User möchte Community Liga beitreten

```
User → /leagues?sportId=X&locationId=Y
  → Sieht nur published Community Ligen
  → Join Liga (wenn published)
```

### 2. Admin schaltet Community Ligen frei

```
Admin → Admin Panel → Publishing
  → Sieht alle Locations
  → Klick "Erstelle Community Ligen" für Location X
  → System erstellt Ligen für alle Sports (unpublished)
  → Admin wählt gewünschte Sports aus und published sie
  → User können jetzt beitreten
```

## Performance & Skalierung

### Aktuelle Zahlen
- **Locations**: 10
- **Sportarten (published)**: 81
- **Theoretische Maximum**: 810 Community Ligen
- **Praktisch**: Nur benötigte Ligen werden erstellt

### Effiziente Strategien

1. **Lazy Creation**: Ligen erst erstellen wenn Location aktiviert wird
2. **Bulk Operations**: Admin kann alle Sports für eine Location auf einmal erstellen
3. **Indexierung**: `location_id`, `sport_id`, `level`, `published` sollten indexiert sein

```sql
CREATE INDEX idx_leagues_community ON leagues(level, published) WHERE level = 'community';
CREATE INDEX idx_leagues_location_sport ON leagues(location_id, sport_id);
```

## Migration Path

### Von altem System (ensureCommunityLeagues)

Das alte System hat automatisch Ligen für ALLE City × Sport Kombinationen erstellt (20k+ Ligen).

**Neues System**:
1. Lazy Creation nur für Locations (nicht Cities)
2. Admin Approval erforderlich
3. Deutlich weniger Ligen (nur aktiv genutzte)

### Cleanup alter Ligen

```sql
-- Alte Auto-Generated Community Ligen löschen
DELETE FROM leagues 
WHERE name LIKE '%Community%Liga%' 
  AND level != 'community'
  AND created_at < '2026-01-31';

-- Neue Community Ligen markieren
UPDATE leagues 
SET level = 'community', published = false
WHERE name LIKE '%Community%Liga%';
```

## Frontend Integration

### AdminPublishing.js Updates

```javascript
// Bulk-Create für Location
const createCommunityLeagues = async (locationId) => {
  const res = await fetch('/api/publishing/community-leagues/bulk-create', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ locationId, autoPublish: false })
  });
  
  const data = await res.json();
  console.log(`${data.created} Ligen erstellt`);
};

// Einzelne Liga publishen
const publishLeague = async (leagueId, published) => {
  await fetch(`/api/publishing/community-leagues/${leagueId}/publish`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ published })
  });
};
```

## Best Practices

1. **Nicht alle Ligen vorab erstellen** - Nur on-demand
2. **Admin Approval ist wichtig** - Verhindert Spam
3. **Regelmäßig aufräumen** - Unpublished Ligen ohne Mitglieder nach 30 Tagen löschen
4. **Monitoring** - Statistiken nutzen um beliebte Kombinationen zu identifizieren

## Weitere Entwicklung

### Phase 1 (aktuell)
- ✅ Service Layer
- ✅ API Endpoints
- ✅ Filter in /leagues
- ⏳ Admin UI Updates

### Phase 2
- Auto-Delete unpublished Ligen nach 30 Tagen ohne Aktivität
- Vorschläge für Admin (welche Sport×Location Kombinationen sind gefragt)
- Bulk-Publish basierend auf Regeln

### Phase 3
- User können neue Community Ligen vorschlagen
- Automatisches Publishing basierend auf Demand (z.B. wenn 5 User beitreten wollen)
