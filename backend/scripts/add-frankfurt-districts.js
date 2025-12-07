#!/usr/bin/env node
/**
 * Add Frankfurt am Main districts to the database
 * Frankfurt has 46 Stadtteile (city districts/neighborhoods)
 */

const knex = require('knex');
const path = require('path');

const config = require('../knexfile.js');
const db = knex(config);

// Frankfurt am Main Stadtteile (districts)
// Source: https://de.wikipedia.org/wiki/Liste_der_Stadtteile_von_Frankfurt_am_Main
const FRANKFURT_DISTRICTS = [
  'Altstadt',
  'Innenstadt',
  'Bahnhofsviertel',
  'Westend-Süd',
  'Westend-Nord',
  'Nordend-West',
  'Nordend-Ost',
  'Ostend',
  'Bornheim',
  'Gutleutviertel',
  'Gallus',
  'Bockenheim',
  'Sachsenhausen-Nord',
  'Sachsenhausen-Süd',
  'Flughafen',
  'Oberrad',
  'Niederrad',
  'Schwanheim',
  'Griesheim',
  'Rödelheim',
  'Hausen',
  'Praunheim',
  'Heddernheim',
  'Niederursel',
  'Ginnheim',
  'Dornbusch',
  'Eschersheim',
  'Eckenheim',
  'Preungesheim',
  'Bonames',
  'Berkersheim',
  'Riederwald',
  'Seckbach',
  'Fechenheim',
  'Höchst',
  'Nied',
  'Sindlingen',
  'Zeilsheim',
  'Unterliederbach',
  'Sossenheim',
  'Nieder-Erlenbach',
  'Kalbach-Riedberg',
  'Harheim',
  'Nieder-Eschbach',
  'Bergen-Enkheim',
  'Frankfurter Berg'
];

async function addFrankfurtDistricts() {
  try {
    console.log('🏙️  Adding Frankfurt am Main districts...\n');

    // Find Frankfurt am Main city
    const frankfurtCity = await db('cities')
      .where({ name: 'Frankfurt am Main', type: 'city' })
      .first();

    if (!frankfurtCity) {
      console.error('❌ Frankfurt am Main city not found in database');
      process.exit(1);
    }

    console.log(`✓ Found Frankfurt am Main (ID: ${frankfurtCity.id}, State ID: ${frankfurtCity.state_id})`);

    // Check if districts already exist
    const existingDistricts = await db('cities')
      .where({ parent_city_id: frankfurtCity.id, type: 'district' })
      .select('name');

    if (existingDistricts.length > 0) {
      console.log(`\n⚠️  Found ${existingDistricts.length} existing districts for Frankfurt:`);
      existingDistricts.forEach(d => console.log(`   - ${d.name}`));
      console.log('\nSkipping insert. Delete existing districts first if you want to re-import.');
      await db.destroy();
      return;
    }

    // Insert all Frankfurt districts
    console.log(`\n📍 Adding ${FRANKFURT_DISTRICTS.length} districts...\n`);
    
    let addedCount = 0;
    for (const districtName of FRANKFURT_DISTRICTS) {
      // Check if district already exists (might be in DB as independent city)
      const existing = await db('cities')
        .where({ 
          name: districtName,
          state_id: frankfurtCity.state_id 
        })
        .first();

      if (existing) {
        // Update existing entry to be a district of Frankfurt
        await db('cities')
          .where({ id: existing.id })
          .update({
            type: 'district',
            parent_city_id: frankfurtCity.id
          });
        console.log(`   ↻ Updated: ${districtName} (was city, now district)`);
      } else {
        // Insert new district
        await db('cities').insert({
          name: districtName,
          country_id: frankfurtCity.country_id,
          state_id: frankfurtCity.state_id,
          parent_city_id: frankfurtCity.id,
          type: 'district'
        });
        console.log(`   + Added: ${districtName}`);
      }
      addedCount++;
    }

    console.log(`\n✅ Successfully added ${addedCount} districts to Frankfurt am Main`);

    // Verify
    const districtCount = await db('cities')
      .where({ parent_city_id: frankfurtCity.id, type: 'district' })
      .count('* as count')
      .first();

    console.log(`\n📊 Total districts for Frankfurt am Main: ${districtCount.count}`);

    await db.destroy();
    console.log('\n✨ Done!');

  } catch (error) {
    console.error('❌ Error adding Frankfurt districts:', error.message);
    console.error(error);
    await db.destroy();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  addFrankfurtDistricts();
}

module.exports = { addFrankfurtDistricts };
