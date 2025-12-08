/**
 * Migration: Add city tier and population for phased league rollout
 * 
 * Tier System:
 * - tier 1: Cities > 100,000 population (launch immediately)
 * - tier 2: Cities > 50,000 population
 * - tier 3: Cities > 10,000 population  
 * - tier 4: All other cities
 * - tier 5: Small villages/communities
 */

exports.up = async function(knex) {
  console.log('Adding population and tier columns to cities...');
  
  // Check if columns already exist
  const hasPopulation = await knex.schema.hasColumn('cities', 'population');
  const hasTier = await knex.schema.hasColumn('cities', 'tier');
  const hasEnabled = await knex.schema.hasColumn('cities', 'leagues_enabled');
  
  if (!hasPopulation) {
    await knex.schema.table('cities', (table) => {
      table.integer('population').nullable().comment('City population for tier calculation');
    });
    console.log('✓ Added population column');
  }
  
  if (!hasTier) {
    await knex.schema.table('cities', (table) => {
      table.integer('tier').nullable().defaultTo(4).comment('City tier: 1=major, 2=large, 3=medium, 4=small, 5=village');
    });
    console.log('✓ Added tier column');
  }
  
  if (!hasEnabled) {
    await knex.schema.table('cities', (table) => {
      table.boolean('leagues_enabled').defaultTo(false).comment('Whether leagues are available for this city');
    });
    console.log('✓ Added leagues_enabled column');
  }
  
  // Add index for efficient tier-based queries
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_cities_tier ON cities(tier)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_cities_leagues_enabled ON cities(leagues_enabled)');
  
  console.log('✓ City tier system ready for phased rollout');
};

exports.down = async function(knex) {
  await knex.schema.table('cities', (table) => {
    table.dropColumn('population');
    table.dropColumn('tier');
    table.dropColumn('leagues_enabled');
  });
  
  await knex.schema.raw('DROP INDEX IF EXISTS idx_cities_tier');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_cities_leagues_enabled');
};
