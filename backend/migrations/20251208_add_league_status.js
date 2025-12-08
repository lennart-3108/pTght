/**
 * Migration: Add status field to leagues for activation control
 */

exports.up = async function(knex) {
  console.log('Adding status and activation fields to leagues...');
  
  const hasStatus = await knex.schema.hasColumn('leagues', 'status');
  const hasActivatedAt = await knex.schema.hasColumn('leagues', 'activated_at');
  
  if (!hasStatus) {
    await knex.schema.table('leagues', (table) => {
      table.string('status', 20).defaultTo('inactive').comment('inactive, active, archived');
    });
    console.log('✓ Added status column');
    
    // Set existing leagues with members to active
    await knex.raw(`
      UPDATE leagues 
      SET status = 'active' 
      WHERE id IN (
        SELECT DISTINCT league_id FROM user_leagues
      )
    `);
    console.log('✓ Marked leagues with members as active');
  }
  
  if (!hasActivatedAt) {
    await knex.schema.table('leagues', (table) => {
      table.timestamp('activated_at').nullable().comment('When the league was first activated');
    });
    console.log('✓ Added activated_at column');
  }
  
  // Add index for status queries
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_leagues_status ON leagues(status)');
  
  console.log('✓ League status system ready');
};

exports.down = async function(knex) {
  await knex.schema.table('leagues', (table) => {
    table.dropColumn('status');
    table.dropColumn('activated_at');
  });
  
  await knex.schema.raw('DROP INDEX IF EXISTS idx_leagues_status');
};
