# Sports Structure Documentation

## Overview
The sports system now uses a hierarchical 3-level structure with separate categories:

1. **Categories** (Level 1) - Top-level groupings
2. **Sports** (Level 2) - Main sports that belong to categories
3. **Variants** (Level 3) - Specific variants of sports (Einzel/Doppel, 11v11/5v5, etc.)

## Database Schema

### sport_categories Table
```sql
CREATE TABLE sport_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(10),
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### sports Table (Updated)
```sql
CREATE TABLE sports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,
  category_id INTEGER,                    -- FK to sport_categories
  parent_sport_id INTEGER,                -- FK to sports (for variants)
  variant_type VARCHAR(50),               -- 'Einzel', 'Doppel', '11v11', etc.
  is_approved INTEGER DEFAULT 1,
  type VARCHAR(50) DEFAULT 'Single',
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES sport_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_sport_id) REFERENCES sports(id) ON DELETE CASCADE
);
```

## Current Data

### Categories (4 total)
| ID | Name | Slug | Icon | Description |
|----|------|------|------|-------------|
| 1 | Ballsport | ballsport | ⚽ | Teamsportarten mit Ball |
| 2 | Racket Sports | racket | 🎾 | Rückschlagsportarten |
| 3 | Watersports | water | 🏊 | Wassersportarten |
| 4 | Bar & Fun Games | fun | 🎯 | Freizeit- und Kneipensportarten |

### Sports by Category

#### Ballsport (4 sports)
- Volleyball
- Handball
- Basketball
- **Fußball** (with 3 variants)
  - Fußball 11 vs 11 (11v11)
  - Fußball 7 vs 7 (7v7)
  - Fußball 5 vs 5 (5v5)

#### Racket Sports (3 sports)
- **Tennis** (with 3 variants)
  - Tennis Einzel (Einzel)
  - Tennis Doppel (Doppel)
  - Tennis Mixed (Mixed)
- Badminton
- Tischtennis

#### Watersports (2 sports)
- Schwimmen
- Laufen

#### Bar & Fun Games (0 sports)
- (Ready for future additions: Dart, Billard, Bowling, etc.)

## API Endpoints

### GET /api/sports/categories
Returns hierarchical structure with all categories, sports, and variants:
```json
[
  {
    "id": 1,
    "name": "Ballsport",
    "slug": "ballsport",
    "icon": "⚽",
    "sort_order": 1,
    "sports": [
      {
        "id": 7,
        "name": "Fußball",
        "category_id": 1,
        "parent_sport_id": null,
        "variant_type": null,
        "type": "Single",
        "variants": [
          {
            "id": 13,
            "name": "Fußball 11 vs 11",
            "category_id": 1,
            "parent_sport_id": 7,
            "variant_type": "11v11",
            "type": "Team"
          }
        ]
      }
    ]
  }
]
```

### GET /api/sports/list
Returns flat list of all sports with category info:
```json
[
  {
    "id": 1,
    "name": "Tennis",
    "category_id": 2,
    "parent_sport_id": null,
    "variant_type": null,
    "type": "Single",
    "category_name": "Racket Sports"
  }
]
```

## Frontend Integration

### SportSelector Component
Location: `frontend/src/components/SportSelector.js`

The component displays the hierarchical structure:
- **Categories** (📁 icon) - Expandable sections
- **Sports** (📂/🏃 icon) - Main sports that can be selected
- **Variants** (⚡ icon) - Specific variants that can be selected

**Usage:**
```jsx
<SportSelector
  sports={sports}
  value={selectedSportName}
  onChange={(sportName, sportId) => {
    setSelectedSportName(sportName);
    setSelectedSport(sportId);
  }}
  placeholder="Wähle eine Sportart..."
/>
```

The component fetches data from `/api/sports/categories` and displays it hierarchically with:
- Search/filter across all levels
- Auto-expand on current selection
- Consistent styling with LocationSelector

## Adding New Data

### Add a Category
```sql
INSERT INTO sport_categories (name, slug, icon, sort_order, description)
VALUES ('Kampfsport', 'combat', '🥊', 5, 'Kampfsportarten');
```

### Add a Sport
```sql
INSERT INTO sports (name, category_id, type, sort_order)
VALUES ('Boxen', 
        (SELECT id FROM sport_categories WHERE slug = 'combat'),
        'Single', 
        100);
```

### Add a Variant
```sql
INSERT INTO sports (name, category_id, parent_sport_id, variant_type, type, sort_order)
VALUES ('Badminton Einzel',
        (SELECT id FROM sport_categories WHERE slug = 'racket'),
        (SELECT id FROM sports WHERE name = 'Badminton'),
        'Einzel',
        'Single',
        201);
```

## Migration History

1. **20251104_create_sport_categories.js** - Creates new structure
   - sport_categories table created
   - sports table recreated with proper foreign keys
   - 4 categories inserted
   - 9 base sports migrated with category assignments
   - 6 variants added (3 Tennis + 3 Fußball)

## Future Enhancements

1. **Add more variants**
   - Badminton Einzel/Doppel/Mixed
   - Basketball 5v5/3v3
   - Volleyball 6v6/2v2 (Beach)

2. **Populate Bar & Fun Games**
   - Dart
   - Billard
   - Bowling
   - Tischkicker

3. **Add new categories**
   - Kampfsport (Boxen, MMA, Karate)
   - Wintersport (Ski, Snowboard, Eishockey)
   - Fitness (Yoga, Pilates, CrossFit)

4. **Sport-specific attributes**
   - Min/max players per variant
   - Required equipment
   - Typical duration
   - Skill levels
