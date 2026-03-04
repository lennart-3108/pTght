/**
 * Migration: Add result confirmation flow to matches
 * 
 * New columns on matches:
 * - result_submitted_by: user_id of who submitted the result
 * - result_submitted_at: when the result was submitted
 * - result_confirmed_by: user_id of who confirmed (opponent)
 * - result_confirmed_at: when confirmed
 * 
 * New status values: 'result_pending', 'result_disputed'
 * Existing: 'scheduled', 'completed'
 */
exports.up = async function (knex) {
  const hasMatches = await knex.schema.hasTable('matches');
  if (!hasMatches) return;

  const info = await knex('matches').columnInfo();

  if (!info.result_submitted_by) {
    await knex.schema.alterTable('matches', (t) => {
      t.integer('result_submitted_by').nullable();
      t.datetime('result_submitted_at').nullable();
      t.integer('result_confirmed_by').nullable();
      t.datetime('result_confirmed_at').nullable();
    });
  }
};

exports.down = async function (knex) {
  const hasMatches = await knex.schema.hasTable('matches');
  if (!hasMatches) return;

  const info = await knex('matches').columnInfo();

  await knex.schema.alterTable('matches', (t) => {
    if (info.result_submitted_by) t.dropColumn('result_submitted_by');
    if (info.result_submitted_at) t.dropColumn('result_submitted_at');
    if (info.result_confirmed_by) t.dropColumn('result_confirmed_by');
    if (info.result_confirmed_at) t.dropColumn('result_confirmed_at');
  });
};
