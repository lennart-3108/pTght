/**
 * Import major German cities from GeoNames data with population filter
 * Only imports cities with population > 50,000
 * 
 * Usage: node scripts/import-geonames-cities.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Admin1 code to state_id mapping (Germany)
const ADMIN1_TO_STATE_ID = {
  '01': 112, // Baden-Württemberg
  '02': 113, // Bavaria
  '03': 116, // Bremen
  '04': 117, // Hamburg
  '05': 118, // Hesse
  '06': 119, // Lower Saxony
  '07': 121, // North Rhine-Westphalia
  '08': 122, // Rhineland-Palatinate
  '09': 123, // Saarland
  '10': 126, // Schleswig-Holstein
  '11': 115, // Brandenburg
  '12': 120, // Mecklenburg-Vorpommern
  '13': 124, // Saxony
  '14': 125, // Saxony-Anhalt
  '15': 127, // Thuringia
  '16': 114, // Berlin
};

const MIN_POPULATION = 50000;
const COUNTRY_ID = 506; // Germany

async function importCities() {
  const geonamesFile = path.join(__dirname, '..', 'DE.txt');
  
  if (!fs.existsSync(geonamesFile)) {
    console.error('ERROR: DE.txt not found. Please download it first:');
    console.error('curl -sS "https://download.geonames.org/export/dump/DE.zip" -o DE.zip && unzip DE.zip');
    process.exit(1);
  }

  const cities = [];
  const fileStream = fs.createReadStream(geonamesFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    const fields = line.split('\t');
    
    // Fields: 
    // 0: geonameid, 1: name, 2: asciiname, 3: alternatenames
    // 4: latitude, 5: longitude, 6: feature class, 7: feature code
    // 8: country code, 9: cc2, 10: admin1, 11: admin2, 12: admin3, 13: admin4
    // 14: population, 15: elevation, 16: dem, 17: timezone, 18: modification date
    
    const featureClass = fields[6];
    const population = parseInt(fields[14]) || 0;
    const admin1 = fields[10];
    
    // Only populated places (P) with population > MIN_POPULATION
    if (featureClass === 'P' && population > MIN_POPULATION) {
      const name = fields[1];
      const latitude = parseFloat(fields[4]);
      const longitude = parseFloat(fields[5]);
      const stateId = ADMIN1_TO_STATE_ID[admin1];
      
      if (stateId) {
        cities.push({
          name,
          stateId,
          countryId: COUNTRY_ID,
          latitude,
          longitude,
          population,
          type: 'city'
        });
      }
    }
  }

  console.log(`Processed ${lineCount} lines from GeoNames`);
  console.log(`Found ${cities.length} major cities (population > ${MIN_POPULATION.toLocaleString()})`);

  // Sort by population descending
  cities.sort((a, b) => b.population - a.population);

  // Generate SQL
  console.log('\n--- SQL to import major cities ---\n');
  console.log('-- Clear existing German cities first (optional):');
  console.log('-- DELETE FROM cities WHERE country_id = 506 AND type = \'city\';\n');
  
  console.log('-- Insert major German cities with population:');
  cities.forEach(city => {
    const name = city.name.replace(/'/g, "''"); // Escape single quotes
    console.log(
      `INSERT OR REPLACE INTO cities (name, country_id, state_id, type, latitude, longitude) ` +
      `VALUES ('${name}', ${city.countryId}, ${city.stateId}, '${city.type}', ${city.latitude}, ${city.longitude}); ` +
      `-- Pop: ${city.population.toLocaleString()}`
    );
  });

  console.log(`\n-- Total: ${cities.length} cities`);
  
  // Statistics by state
  const byState = {};
  cities.forEach(city => {
    byState[city.stateId] = (byState[city.stateId] || 0) + 1;
  });
  
  console.log('\n-- Cities per state:');
  Object.entries(byState).sort((a, b) => b[1] - a[1]).forEach(([stateId, count]) => {
    console.log(`-- State ID ${stateId}: ${count} cities`);
  });
}

importCities().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
