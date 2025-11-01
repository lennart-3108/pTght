/**
 * Migration: Add kickoff_end_at column to matches table for flexible date ranges
 */
exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('matches', 'kickoff_end_at');
  if (!hasColumn) {
    await knex.schema.table('matches', (table) => {
      table.text('kickoff_end_at').nullable();
    });
    console.log('[Migration] Added kickoff_end_at column to matches table');
  }
};

exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('matches', 'kickoff_end_at');
  if (hasColumn) {
    await knex.schema.table('matches', (table) => {
      table.dropColumn('kickoff_end_at');
    });
  }
};
