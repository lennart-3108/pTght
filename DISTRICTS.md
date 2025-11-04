# Districts & Geographic Hierarchy

## Übersicht

Das System unterstützt jetzt eine mehrstufige geografische Hierarchie für Ligen:

```
Land (Country)
  └─ Bundesland (State)
      └─ Stadt (City)
          └─ Stadtteil (District)
```

## Datenbank-Struktur

### Neue Tabelle: `districts`

```sql
CREATE TABLE districts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id INTEGER NOT NULL,           -- FK zu cities
  name VARCHAR(100) NOT NULL,         -- z.B. "Mitte", "Kreuzberg"
  type VARCHAR(50) DEFAULT 'district', -- district, neighborhood, borough
  population INTEGER,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE
);
```

### Erweiterte Tabelle: `leagues`

Neue Spalten:
- `district_id INTEGER` - Optional, für Stadtteil-Ligen
- `level VARCHAR(50)` - Liga-Ebene: 'national', 'state', 'city', 'district'

```sql
-- Beispiele
INSERT INTO leagues (name, sport_id, city_id, level) 
VALUES ('Freiburg Stadtliga Tennis', 1, 15, 'city');

INSERT INTO leagues (name, sport_id, city_id, district_id, level)
VALUES ('Berlin-Mitte Fußballliga', 2, 1, 5, 'district');
```

## API-Endpunkte

### Districts

**GET /api/districts/list**
```json
[
  {
    "id": 1,
    "name": "Mitte",
    "type": "district",
    "population": 380000,
    "cityId": 1,
    "cityName": "Berlin"
  }
]
```

**GET /api/districts/by-city/:cityId**
```json
[
  {
    "id": 1,
    "name": "Mitte",
    "type": "district",
    "population": 380000,
    "cityId": 1
  }
]
```

**GET /api/districts/:id**
```json
{
  "id": 1,
  "name": "Mitte",
  "type": "district",
  "population": 380000,
  "description": null,
  "cityId": 1,
  "cityName": "Berlin"
}
```

## Liga-Strategie nach Stadtgröße

### Große Städte (> 500.000 Einwohner)
**Beispiele**: Berlin, München, Hamburg, Köln

**Empfehlung**: Stadtteile/Bezirke verwenden
- Berlin-Mitte Tennisliga
- München-Schwabing Fußballliga
- Hamburg-Altona Basketball

**SQL**:
```sql
INSERT INTO leagues (name, sport_id, city_id, district_id, level)
VALUES ('Berlin-Mitte Tennisliga', 1, 1, 5, 'district');
```

### Mittelgroße Städte (50.000 - 500.000)
**Beispiele**: Freiburg, Heidelberg, Konstanz

**Empfehlung**: Stadt-Ebene verwenden
- Freiburg Stadtliga Tennis
- Heidelberg Basketball
- Konstanz Fußball

**SQL**:
```sql
INSERT INTO leagues (name, sport_id, city_id, level)
VALUES ('Freiburg Stadtliga Tennis', 1, 15, 'city');
```

### Kleine Städte (< 50.000)
**Beispiele**: Bad Krozingen, Emmendingen

**Empfehlung**: Regionale Liga (mehrere Städte)
- Breisgau Kreisliga Tennis
- Schwarzwald Liga Fußball

**SQL**:
```sql
INSERT INTO leagues (name, sport_id, state_id, level)
VALUES ('Breisgau Kreisliga Tennis', 1, 6, 'regional');
```

## Beispieldaten

### Berlin Stadtteile (12 Bezirke)
- Mitte (380.000 Einwohner)
- Friedrichshain-Kreuzberg (290.000)
- Pankow (410.000)
- Charlottenburg-Wilmersdorf (340.000)
- Spandau (245.000)
- Steglitz-Zehlendorf (310.000)
- Tempelhof-Schöneberg (350.000)
- Neukölln (330.000)
- Treptow-Köpenick (275.000)
- Marzahn-Hellersdorf (270.000)
- Lichtenberg (295.000)
- Reinickendorf (265.000)

### München Stadtteile (8 Stadtbezirke)
- Altstadt-Lehel (22.000)
- Ludwigsvorstadt-Isarvorstadt (56.000)
- Maxvorstadt (54.000)
- Schwabing-West (68.000)
- Schwabing-Freimann (75.000)
- Bogenhausen (86.000)
- Sendling (42.000)
- Pasing-Obermenzing (76.000)

### Hamburg Stadtteile (7 Bezirke)
- Hamburg-Mitte (330.000)
- Altona (275.000)
- Eimsbüttel (270.000)
- Hamburg-Nord (315.000)
- Wandsbek (440.000)
- Bergedorf (132.000)
- Harburg (171.000)

## Frontend Integration

### LocationSelector erweitern
```javascript
// Zeige Stadtteile wenn Stadt ausgewählt ist
const [selectedCity, setSelectedCity] = useState('');
const [selectedDistrict, setSelectedDistrict] = useState('');
const [districts, setDistricts] = useState([]);

useEffect(() => {
  if (selectedCity) {
    fetch(`${API_BASE}/districts/by-city/${selectedCity}`)
      .then(r => r.json())
      .then(setDistricts);
  }
}, [selectedCity]);
```

### Liga-Erstellung mit Level
```javascript
const createLeague = async (formData) => {
  const leagueData = {
    name: formData.name,
    sport_id: formData.sportId,
    city_id: formData.cityId,
    district_id: formData.districtId || null,
    level: formData.districtId ? 'district' : 'city'
  };
  
  await fetch(`${API_BASE}/leagues`, {
    method: 'POST',
    body: JSON.stringify(leagueData)
  });
};
```

## Migration Status

✅ `districts` Tabelle erstellt
✅ `leagues` Tabelle erweitert (district_id, level)
✅ API-Endpunkte implementiert (/api/districts/*)
✅ Seed-Daten vorbereitet (Berlin, München, Hamburg Stadtteile)

## Nächste Schritte

1. **Seed-Daten ausführen**: Cities und Districts einfügen
2. **LocationSelector erweitern**: District-Auswahl hinzufügen
3. **Liga-Formular anpassen**: Level-Auswahl basierend auf Stadt
4. **Liga-Liste filtern**: Nach District filtern
5. **UI-Labels**: "Stadtteil" für große Städte, "Stadt" für kleine

## Verwendung

```javascript
// Automatische Level-Bestimmung
function suggestLeagueLevel(city) {
  if (city.population > 500000) return "district";
  if (city.population > 50000) return "city";
  return "regional";
}

// Liga-Namen generieren
function generateLeagueName(sport, city, district) {
  if (district) {
    return `${city.name}-${district.name} ${sport.name}liga`;
  }
  return `${city.name} ${sport.name}liga`;
}
```
