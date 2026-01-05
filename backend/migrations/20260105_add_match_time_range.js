/**
 * Migration: Add time range fields to matches table
 * - kickoff_end_at: End of time range for flexible matches
 * - when_type: Type of time selection (exact, range, fixed)
 * - range_days: Number of days for range type (e.g., "next 7 days")
 */

exports.up = async function(knex) {
  const hasMatches = await knex.schema.hasTable('matches');
  if (!hasMatches) return;

  const info = await knex('matches').columnInfo().catch(() => ({}));
  
  await knex.schema.table('matches', (t) => {
    // Add kickoff_end_at if it doesn't exist
    if (!Object.prototype.hasOwnProperty.call(info, 'kickoff_end_at')) {
      t.text('kickoff_end_at').nullable().comment('End of time range for flexible matches');
    }
    
    // Add when_type if it doesn't exist
    if (!Object.prototype.hasOwnProperty.call(info, 'when_type')) {
      t.string('when_type', 20).nullable().comment('exact | range | fixed');
    }
    
    // Add range_days if it doesn't exist
    if (!Object.prototype.hasOwnProperty.call(info, 'range_days')) {
      t.integer('range_days').nullable().comment('Number of days for range type (e.g., 7 for "next 7 days")');
    }
  });

  console.log('[Migration] Added time range fields to matches table');
};

exports.down = async function(knex) {
  const hasMatches = await knex.schema.hasTable('matches');
  if (!hasMatches) return;

  await knex.schema.table('matches', (t) => {
    t.dropColumn('kickoff_end_at');
    t.dropColumn('when_type');
    t.dropColumn('range_days');
  });
};
