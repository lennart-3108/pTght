/**
 * Migration: Add slot_duration to matches table
 * - slot_duration: Duration in minutes for time slots in termin manager (default: 60)
 */

exports.up = async function(knex) {
  const hasMatches = await knex.schema.hasTable('matches');
  if (!hasMatches) return;

  const info = await knex('matches').columnInfo().catch(() => ({}));
  
  if (!Object.prototype.hasOwnProperty.call(info, 'slot_duration')) {
    await knex.schema.table('matches', (t) => {
      t.integer('slot_duration').defaultTo(60).comment('Slot duration in minutes for termin manager');
    });
    console.log('[Migration] Added slot_duration column to matches table');
  }
};

exports.down = async function(knex) {
  const hasMatches = await knex.schema.hasTable('matches');
  if (!hasMatches) return;

  await knex.schema.table('matches', (t) => {
    t.dropColumn('slot_duration');
  });
};
