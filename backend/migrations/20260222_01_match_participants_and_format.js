/**
 * Add multi-participant match support.
 *
 * - match_participants: stores N participants per match (with optional team_index)
 * - matches: optional config columns to describe match format (capacity/teams)
 */

exports.up = async function up(knex) {
  const hasMatches = await knex.schema.hasTable('matches');
  if (!hasMatches) return;

  const hasParticipants = await knex.schema.hasTable('match_participants');
  if (!hasParticipants) {
    await knex.schema.createTable('match_participants', (t) => {
      t.increments('id').primary();
      t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
      t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('team_index').nullable(); // 1..team_count, null until selected
      t.string('status', 20).notNullable().defaultTo('joined'); // joined|left
      t.text('joined_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
      t.text('left_at').nullable();
      t.unique(['match_id', 'user_id']);
      t.index(['match_id'], 'idx_match_participants_match');
      t.index(['user_id'], 'idx_match_participants_user');
    });
  }

  // Add format columns to matches (best-effort, keep older DBs compatible)
  const info = await knex('matches').columnInfo().catch(() => ({}));
  const needs = (col) => !Object.prototype.hasOwnProperty.call(info, col);

  if (needs('max_players') || needs('team_count') || needs('players_per_team') || needs('allow_team_choice')) {
    await knex.schema.table('matches', (t) => {
      if (needs('max_players')) t.integer('max_players').nullable();
      if (needs('team_count')) t.integer('team_count').nullable();
      if (needs('players_per_team')) t.integer('players_per_team').nullable();
      if (needs('allow_team_choice')) t.integer('allow_team_choice').notNullable().defaultTo(1);
    });
  }
};

exports.down = async function down(knex) {
  // Keep down migration minimal/safe in SQLite projects.
  const hasParticipants = await knex.schema.hasTable('match_participants');
  if (hasParticipants) await knex.schema.dropTable('match_participants');
  // SQLite does not support dropping columns easily; leave matches columns as-is.
};
