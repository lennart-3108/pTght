/**
 * Create district groups (Nord, Süd, Ost, West, Zentrum) for major German cities
 * 
 * Usage: node scripts/create-city-districts.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'sportplattform.db');

// Major cities that should have district groups
const MAJOR_CITIES = [
  { name: 'Berlin', stateId: 114 },
  { name: 'Hamburg', stateId: 117 },
  { name: 'München', stateId: 113 },
  { name: 'Munich', stateId: 113 }, // English name in GeoNames
  { name: 'Köln', stateId: 121 },
  { name: 'Frankfurt am Main', stateId: 118 },
  { name: 'Stuttgart', stateId: 112 },
  { name: 'Düsseldorf', stateId: 121 },
  { name: 'Dortmund', stateId: 121 },
  { name: 'Essen', stateId: 121 },
  { name: 'Leipzig', stateId: 124 },
  { name: 'Dresden', stateId: 124 },
  { name: 'Hannover', stateId: 119 },
  { name: 'Nürnberg', stateId: 113 }
];

const DISTRICTS = ['Nord', 'Süd', 'Ost', 'West', 'Zentrum'];

async function createDistrictGroups() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
    });

    let created = 0;
    let skipped = 0;

    const processCity = (cityIndex) => {
      if (cityIndex >= MAJOR_CITIES.length) {
        console.log(`\n✅ Created ${created} district groups, skipped ${skipped}`);
        db.close();
        return resolve();
      }

      const cityInfo = MAJOR_CITIES[cityIndex];
      
      // Find the city in database
      db.get(
        'SELECT id, name, state_id, country_id, latitude, longitude FROM cities WHERE name = ? AND state_id = ? AND type = \'city\'',
        [cityInfo.name, cityInfo.stateId],
        (err, city) => {
          if (err) {
            console.error(`Error finding ${cityInfo.name}:`, err);
            return processCity(cityIndex + 1);
          }
          
          if (!city) {
            console.log(`⚠️  City not found: ${cityInfo.name}`);
            skipped++;
            return processCity(cityIndex + 1);
          }

          console.log(`\n📍 ${city.name} (ID: ${city.id})`);
          
          // Check if districts already exist
          db.get(
            'SELECT COUNT(*) as count FROM cities WHERE parent_city_id = ? AND name LIKE \'%-%\'',
            [city.id],
            (err, result) => {
              if (err) {
                console.error(`Error checking districts for ${city.name}:`, err);
                return processCity(cityIndex + 1);
              }

              if (result.count > 0) {
                console.log(`  ⏭️  Already has ${result.count} district groups, skipping`);
                skipped++;
                return processCity(cityIndex + 1);
              }

              // Create district groups
              let districtIndex = 0;
              const insertDistrict = () => {
                if (districtIndex >= DISTRICTS.length) {
                  return processCity(cityIndex + 1);
                }

                const districtName = `${city.name}-${DISTRICTS[districtIndex]}`;
                
                db.run(
                  'INSERT INTO cities (name, country_id, state_id, parent_city_id, type, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [districtName, city.country_id, city.state_id, city.id, 'district', city.latitude, city.longitude],
                  (err) => {
                    if (err) {
                      console.error(`  ❌ Error creating ${districtName}:`, err.message);
                    } else {
                      console.log(`  ✅ Created: ${districtName}`);
                      created++;
                    }
                    districtIndex++;
                    insertDistrict();
                  }
                );
              };

              insertDistrict();
            }
          );
        }
      );
    };

    processCity(0);
  });
}

createDistrictGroups().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
