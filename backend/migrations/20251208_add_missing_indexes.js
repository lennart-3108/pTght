/**
 * Migration: Add missing performance-critical indexes
 * 
 * Fixes:
 * - Add index on leagues.sport_id (CRITICAL - 184k rows without index!)
 * - Add index on leagues.city_id (for JOIN performance)
 * - Add index on states table if it exists
 */

exports.up = async function(knex) {
  console.log('Adding missing indexes for performance...');
  
  // Critical: Add index on sport_id in leagues table
  const hasSportIdIndex = await knex.schema.raw(`
    SELECT name FROM sqlite_master 
    WHERE type='index' AND tbl_name='leagues' AND name='idx_leagues_sport_id'
  `);
  
  if (hasSportIdIndex.length === 0) {
    console.log('Creating index on leagues.sport_id...');
    await knex.schema.raw('CREATE INDEX idx_leagues_sport_id ON leagues(sport_id)');
  }
  
  // Add index on city_id in leagues table for JOIN performance
  const hasCityIdIndex = await knex.schema.raw(`
    SELECT name FROM sqlite_master 
    WHERE type='index' AND tbl_name='leagues' AND name='idx_leagues_city_id'
  `);
  
  if (hasCityIdIndex.length === 0) {
    console.log('Creating index on leagues.city_id...');
    await knex.schema.raw('CREATE INDEX idx_leagues_city_id ON leagues(city_id)');
  }
  
  // Check if states table exists and add indexes
  const statesTableExists = await knex.schema.hasTable('states');
  if (statesTableExists) {
    console.log('Adding indexes to states table...');
    
    const hasStateCountryIndex = await knex.schema.raw(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='states' AND name='idx_states_country_id'
    `);
    
    if (hasStateCountryIndex.length === 0) {
      await knex.schema.raw('CREATE INDEX idx_states_country_id ON states(country_id)');
    }
    
    const hasStateNameIndex = await knex.schema.raw(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='states' AND name='idx_states_name'
    `);
    
    if (hasStateNameIndex.length === 0) {
      await knex.schema.raw('CREATE INDEX idx_states_name ON states(name)');
    }
  }
  
  console.log('Performance indexes added successfully!');
};

exports.down = async function(knex) {
  console.log('Removing performance indexes...');
  
  await knex.schema.raw('DROP INDEX IF EXISTS idx_leagues_sport_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_leagues_city_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_states_country_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_states_name');
  
  console.log('Performance indexes removed.');
};
