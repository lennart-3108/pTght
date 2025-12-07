#!/usr/bin/env node
/**
 * Import complete location hierarchy from country-state-city library
 * Includes: Countries, States/Counties, Cities with GPS coordinates
 * For DACH region (Germany, Austria, Switzerland)
 */

const csc = require('country-state-city');
const knex = require('knex');
const config = require('../knexfile.js');
const db = knex(config);

const DACH_COUNTRIES = ['DE', 'AT', 'CH']; // Germany, Austria, Switzerland

async function importLocations() {
  try {
    console.log('🌍 Importing locations from country-state-city library...\n');

    // Check if counties table exists (might be named states)
    const hasCounties = await db.schema.hasTable('counties');
    const hasStates = await db.schema.hasTable('states');
    const stateTableName = hasCounties ? 'counties' : 'states';

    if (!hasStates && !hasCounties) {
      console.error('❌ Neither states nor counties table exists!');
      process.exit(1);
    }

    console.log(`📊 Using table: ${stateTableName}\n`);

    // Import countries
    console.log('1️⃣  Importing countries...');
    for (const countryCode of DACH_COUNTRIES) {
      const country = csc.Country.getCountryByCode(countryCode);
      if (!country) {
        console.log(`   ⚠️  Country ${countryCode} not found in library`);
        continue;
      }

      const existing = await db('countries').where({ code: countryCode }).first();
      if (existing) {
        // Update with full data
        await db('countries').where({ id: existing.id }).update({
          name: country.name,
          iso2: country.isoCode,
          flag: country.flag || null,
          phonecode: country.phonecode || null,
          currency: country.currency || null,
          latitude: country.latitude ? parseFloat(country.latitude) : null,
          longitude: country.longitude ? parseFloat(country.longitude) : null
        });
        console.log(`   ↻ Updated: ${country.name} (${countryCode})`);
      } else {
        // Insert new
        await db('countries').insert({
          name: country.name,
          code: countryCode,
          iso2: country.isoCode,
          flag: country.flag || null,
          phonecode: country.phonecode || null,
          currency: country.currency || null,
          latitude: country.latitude ? parseFloat(country.latitude) : null,
          longitude: country.longitude ? parseFloat(country.longitude) : null
        });
        console.log(`   + Added: ${country.name} (${countryCode})`);
      }
    }

    // Import states/counties
    console.log('\n2️⃣  Importing states/counties...');
    let stateCount = 0;
    for (const countryCode of DACH_COUNTRIES) {
      const countryRecord = await db('countries').where({ code: countryCode }).first();
      if (!countryRecord) continue;

      const states = csc.State.getStatesOfCountry(countryCode);
      for (const state of states) {
        const existing = await db(stateTableName)
          .where({ 
            country_id: countryRecord.id, 
            code: state.isoCode 
          })
          .first();

        if (existing) {
          // Update with coordinates
          await db(stateTableName).where({ id: existing.id }).update({
            name: state.name,
            latitude: state.latitude ? parseFloat(state.latitude) : null,
            longitude: state.longitude ? parseFloat(state.longitude) : null
          });
        } else {
          // Insert new
          await db(stateTableName).insert({
            country_id: countryRecord.id,
            code: state.isoCode,
            name: state.name,
            latitude: state.latitude ? parseFloat(state.latitude) : null,
            longitude: state.longitude ? parseFloat(state.longitude) : null
          });
        }
        stateCount++;
      }
    }
    console.log(`   ✓ Processed ${stateCount} states`);

    // Import cities
    console.log('\n3️⃣  Importing cities with GPS coordinates...');
    let cityCount = 0;
    let updatedCount = 0;
    let insertedCount = 0;

    for (const countryCode of DACH_COUNTRIES) {
      const countryRecord = await db('countries').where({ code: countryCode }).first();
      if (!countryRecord) continue;

      const states = await db(stateTableName).where({ country_id: countryRecord.id });
      
      for (const stateRecord of states) {
        const cities = csc.City.getCitiesOfState(countryCode, stateRecord.code);
        
        for (const city of cities) {
          const existing = await db('cities')
            .where({ 
              name: city.name,
              country_id: countryRecord.id,
              state_id: stateRecord.id
            })
            .first();

          if (existing) {
            // Update existing city with coordinates
            await db('cities').where({ id: existing.id }).update({
              latitude: city.latitude ? parseFloat(city.latitude) : null,
              longitude: city.longitude ? parseFloat(city.longitude) : null
            });
            updatedCount++;
          } else {
            // Insert new city
            await db('cities').insert({
              name: city.name,
              country_id: countryRecord.id,
              state_id: stateRecord.id,
              type: 'city',
              latitude: city.latitude ? parseFloat(city.latitude) : null,
              longitude: city.longitude ? parseFloat(city.longitude) : null
            });
            insertedCount++;
          }
          cityCount++;
        }
      }
    }
    console.log(`   ✓ Processed ${cityCount} cities`);
    console.log(`     - Updated: ${updatedCount}`);
    console.log(`     - Inserted: ${insertedCount}`);

    // Summary
    console.log('\n📊 Final Summary:');
    const countryCount = await db('countries').count('* as count').first();
    const finalStateCount = await db(stateTableName).count('* as count').first();
    const finalCityCount = await db('cities').where({ type: 'city' }).count('* as count').first();
    const districtCount = await db('cities').where({ type: 'district' }).count('* as count').first();

    console.log(`   Countries: ${countryCount.count}`);
    console.log(`   States: ${finalStateCount.count}`);
    console.log(`   Cities: ${finalCityCount.count}`);
    console.log(`   Districts: ${districtCount.count}`);

    await db.destroy();
    console.log('\n✨ Import complete!');

  } catch (error) {
    console.error('❌ Error importing locations:', error.message);
    console.error(error);
    await db.destroy();
    process.exit(1);
  }
}

// Check if columns exist first
async function checkAndAddColumns() {
  console.log('🔧 Checking database schema...\n');
  
  const hasCounties = await db.schema.hasTable('counties');
  const hasStates = await db.schema.hasTable('states');
  const stateTableName = hasCounties ? 'counties' : 'states';

  // Add missing columns to countries
  const countryCols = await db('countries').columnInfo();
  const countryColumnsToAdd = [];
  if (!countryCols.latitude) countryColumnsToAdd.push('latitude REAL');
  if (!countryCols.longitude) countryColumnsToAdd.push('longitude REAL');
  if (!countryCols.flag) countryColumnsToAdd.push('flag TEXT');
  if (!countryCols.phonecode) countryColumnsToAdd.push('phonecode TEXT');
  if (!countryCols.currency) countryColumnsToAdd.push('currency TEXT');

  if (countryColumnsToAdd.length > 0) {
    console.log(`Adding columns to countries: ${countryColumnsToAdd.join(', ')}`);
    for (const col of countryColumnsToAdd) {
      await db.raw(`ALTER TABLE countries ADD COLUMN ${col}`);
    }
  }

  // Add missing columns to states/counties
  const stateCols = await db(stateTableName).columnInfo();
  const stateColumnsToAdd = [];
  if (!stateCols.latitude) stateColumnsToAdd.push('latitude REAL');
  if (!stateCols.longitude) stateColumnsToAdd.push('longitude REAL');

  if (stateColumnsToAdd.length > 0) {
    console.log(`Adding columns to ${stateTableName}: ${stateColumnsToAdd.join(', ')}`);
    for (const col of stateColumnsToAdd) {
      await db.raw(`ALTER TABLE ${stateTableName} ADD COLUMN ${col}`);
    }
  }

  // Add missing columns to cities
  const cityCols = await db('cities').columnInfo();
  const cityColumnsToAdd = [];
  if (!cityCols.latitude) cityColumnsToAdd.push('latitude REAL');
  if (!cityCols.longitude) cityColumnsToAdd.push('longitude REAL');

  if (cityColumnsToAdd.length > 0) {
    console.log(`Adding columns to cities: ${cityColumnsToAdd.join(', ')}`);
    for (const col of cityColumnsToAdd) {
      await db.raw(`ALTER TABLE cities ADD COLUMN ${col}`);
    }
  }

  console.log('✓ Schema check complete\n');
}

// Run
(async () => {
  await checkAndAddColumns();
  await importLocations();
})();
