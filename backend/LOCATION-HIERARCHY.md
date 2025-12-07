# Location Hierarchy

## Overview
The location data is now organized in a 5-level hierarchy:

**Region → Country → County → City → District**

Example:
- **Central Europe** (Region)
  - **Germany** (Country)
    - **Berlin** (County/Bundesland)
      - **Berlin** (City)
        - **Mitte** (District/Stadtteil) *(optional for large cities)*

## Database Schema

### Tables

#### `regions`
- `id` - Primary key
- `name` - Region name (e.g., "Central Europe", "Western Europe")
- `code` - Short code (e.g., "CEU", "WEU")
- `created_at` - Timestamp

#### `countries`
- `id` - Primary key
- `name` - Country name (e.g., "Germany", "Austria")
- `code` / `iso2` - ISO 3166-1 alpha-2 code (e.g., "DE", "AT")
- **`region_id`** - Foreign key to `regions.id`
- `created_at` - Timestamp

#### `counties` (formerly `states`)
- `id` - Primary key
- `name` - County/state name (e.g., "Berlin", "Bavaria", "North Rhine-Westphalia")
- `code` - State code (e.g., "BE", "BY", "NW")
- `country_id` - Foreign key to `countries.id`
- `type` - Optional type field
- `created_at` - Timestamp

**Note:** German Bundesländer are called "counties" in the API for consistency.

#### `cities`
- `id` - Primary key
- `name` - City name (e.g., "Berlin", "Munich", "Cologne")
- `country_id` - Foreign key to `countries.id`
- `state_id` - Foreign key to `counties.id`
- **`parent_city_id`** - Foreign key to `cities.id` (for districts)
- **`type`** - `'city'` or `'district'`
- `created_at` - Timestamp

**District Logic:**
- Major cities have `type = 'city'` and `parent_city_id = NULL`
- Districts/Stadtteile have `type = 'district'` and `parent_city_id` pointing to the parent city

Example:
- Berlin (id=6, type='city', parent_city_id=NULL)
  - Mitte (id=X, type='district', parent_city_id=6)
  - Kreuzberg (id=Y, type='district', parent_city_id=6)
  - etc.

## API Endpoints

### Regions

#### `GET /api/regions`
Get all regions.

**Response:**
```json
[
  {
    "id": 2,
    "code": "CEU",
    "name": "Central Europe"
  },
  ...
]
```

### Countries

#### `GET /api/countries`
Get all countries with region information.

**Response:**
```json
[
  {
    "id": 506,
    "code": "DE",
    "name": "Germany",
    "region_id": 2
  },
  ...
]
```

### Counties (Bundesländer)

#### `GET /api/counties/list`
Get all counties/states.

**Query Parameters:**
- `country_id` - Filter by country ID

**Response:**
```json
[
  {
    "id": 114,
    "countryId": 506,
    "code": "BE",
    "name": "Berlin",
    "type": null
  },
  ...
]
```

**Legacy Endpoint:** `/api/states/list` still works for backward compatibility.

### Cities

#### `GET /api/cities/list`
Get all cities with optional filters.

**Query Parameters:**
- `state_id` - Filter by county/state ID
- `country_id` - Filter by country ID
- `type` - Filter by type ('city' or 'district')
- `parent_city_id` - Filter by parent city (for districts)

**Response:**
```json
[
  {
    "id": 6,
    "name": "Berlin",
    "countryId": 506,
    "stateId": 114,
    "type": "city",
    "parentCityId": null,
    "countryName": "Germany",
    "countryCode": "DE",
    "stateName": "Berlin",
    "stateCode": "BE",
    "parentCityName": null
  },
  ...
]
```

#### `GET /api/cities/:cityId/districts`
Get all districts of a specific city.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Adlershof",
    "type": "district",
    "parentCityId": 6
  },
  ...
]
```

## Current Data

- **5 Regions:** Central Europe, Eastern Europe, Northern Europe, Southern Europe, Western Europe
- **3 Countries:** Germany, Austria, Switzerland (all in Central Europe)
- **51 Counties:** 16 German Bundesländer, 9 Austrian states, 26 Swiss cantons
- **6,250 Cities:** Including 104 districts in 5 major cities
  - Berlin: 96 districts
  - Hamburg: 3 districts
  - Düsseldorf: 2 districts
  - Halle: 2 districts
  - Bochum: 1 district

## Examples

### Complete Hierarchy: Cologne

1. **Region:** Central Europe (CEU)
2. **Country:** Germany (DE)
3. **County:** North Rhine-Westphalia (NW)
4. **City:** Cologne
5. **District:** Köln-Kalk (if city has districts)

### API Call Flow

```bash
# 1. Get regions
curl "http://localhost:5001/api/regions"

# 2. Get countries in Central Europe (region_id=2)
curl "http://localhost:5001/api/countries"

# 3. Get counties in Germany (country_id=506)
curl "http://localhost:5001/api/counties/list?country_id=506"

# 4. Get cities in North Rhine-Westphalia (state_id=121)
curl "http://localhost:5001/api/cities/list?state_id=121&type=city"

# 5. Get districts of Cologne (city_id=1045)
curl "http://localhost:5001/api/cities/1045/districts"
```

## Frontend Integration

The location selector should have cascading dropdowns:

1. **Region** → Select "Central Europe"
2. **Country** → Shows Germany, Austria, Switzerland
3. **County** → Shows 16 Bundesländer (for Germany)
4. **City** → Shows cities in selected Bundesland
5. **District** (optional) → Shows if selected city has districts

## Migration Notes

- `states` table renamed to `counties` for consistency
- Added `regions` table as top-level hierarchy
- Added `region_id` to `countries` table
- Legacy `/api/states/list` endpoint redirects to `/api/counties/list` for backward compatibility
- All references updated in server.js to use `counties` table
