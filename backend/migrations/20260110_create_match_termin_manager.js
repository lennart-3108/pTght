/**
 * Termin-Manager
 * - match_time_options: Owner legt mögliche Spielzeiten fest
 * - match_schedule_proposals: Spieler senden/antworten auf Terminvorschläge
 * - match_messages: optionale Erweiterung um kind/action/data für "special" Chat-Messages
 */

exports.up = async function (knex) {
  const hasMatches = await knex.schema.hasTable('matches').catch(() => false);
  if (!hasMatches) return;

  // 1) match_time_options
  const hasOptions = await knex.schema.hasTable('match_time_options').catch(() => false);
  if (!hasOptions) {
    await knex.schema.createTable('match_time_options', (t) => {
      t.increments('id').primary();
      t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
      t.text('starts_at').notNullable();
      t.integer('created_by_user_id').references('id').inTable('users').onDelete('SET NULL');
      t.text('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
      t.index(['match_id'], 'idx_match_time_options_match');
      t.index(['match_id', 'starts_at'], 'idx_match_time_options_match_starts');
    });
  }

  // 2) match_schedule_proposals
  const hasProposals = await knex.schema.hasTable('match_schedule_proposals').catch(() => false);
  if (!hasProposals) {
    await knex.schema.createTable('match_schedule_proposals', (t) => {
      t.increments('id').primary();
      t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
      t.integer('proposer_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('recipient_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('option_id').notNullable().references('id').inTable('match_time_options').onDelete('CASCADE');
      t.string('status', 20).notNullable().defaultTo('sent'); // sent|accepted|rejected|countered
      t.text('note').nullable(); // optional text sent with proposal/action
      t.text('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
      t.text('responded_at').nullable();
      t.index(['match_id'], 'idx_match_schedule_proposals_match');
      t.index(['match_id', 'status'], 'idx_match_schedule_proposals_match_status');
    });
  }

  // 3) match_messages columns (best-effort, keep backward compatible)
  const hasMM = await knex.schema.hasTable('match_messages').catch(() => false);
  if (hasMM) {
    const info = await knex('match_messages').columnInfo().catch(() => ({}));
    await knex.schema.table('match_messages', (t) => {
      if (!Object.prototype.hasOwnProperty.call(info, 'kind')) t.string('kind', 20).nullable(); // text|action
      if (!Object.prototype.hasOwnProperty.call(info, 'action')) t.string('action', 50).nullable();
      if (!Object.prototype.hasOwnProperty.call(info, 'data')) t.text('data').nullable(); // JSON string
    });
  }
};

exports.down = async function (knex) {
  const hasOptions = await knex.schema.hasTable('match_time_options').catch(() => false);
  if (hasOptions) await knex.schema.dropTable('match_time_options');

  const hasProposals = await knex.schema.hasTable('match_schedule_proposals').catch(() => false);
  if (hasProposals) await knex.schema.dropTable('match_schedule_proposals');

  const hasMM = await knex.schema.hasTable('match_messages').catch(() => false);
  if (hasMM) {
    const info = await knex('match_messages').columnInfo().catch(() => ({}));
    await knex.schema.table('match_messages', (t) => {
      if (Object.prototype.hasOwnProperty.call(info, 'kind')) t.dropColumn('kind');
      if (Object.prototype.hasOwnProperty.call(info, 'action')) t.dropColumn('action');
      if (Object.prototype.hasOwnProperty.call(info, 'data')) t.dropColumn('data');
    });
  }
};
