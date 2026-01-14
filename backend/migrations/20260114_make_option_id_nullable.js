/**
 * Make option_id nullable in match_schedule_proposals
 * This is needed because we now use proposed_datetime instead of option_id
 */

exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('match_schedule_proposals');
  if (!hasTable) return;

  // SQLite doesn't support altering columns directly
  // We need to recreate the table
  
  // 1. Create temporary table with correct schema
  await knex.schema.createTable('match_schedule_proposals_temp', (t) => {
    t.increments('id').primary();
    t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
    t.integer('proposer_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('recipient_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('option_id').nullable().references('id').inTable('match_time_options').onDelete('CASCADE'); // Now nullable
    t.text('proposed_datetime').nullable(); // Added in previous migration
    t.string('status', 20).notNullable().defaultTo('sent');
    t.text('note').nullable();
    t.text('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    t.text('responded_at').nullable();
  });

  // 2. Copy data
  await knex.raw(`
    INSERT INTO match_schedule_proposals_temp 
    SELECT * FROM match_schedule_proposals
  `);

  // 3. Drop old table
  await knex.schema.dropTable('match_schedule_proposals');

  // 4. Rename temp table
  await knex.schema.renameTable('match_schedule_proposals_temp', 'match_schedule_proposals');

  // 5. Recreate indices
  await knex.schema.table('match_schedule_proposals', (t) => {
    t.index(['match_id'], 'idx_match_schedule_proposals_match');
    t.index(['match_id', 'status'], 'idx_match_schedule_proposals_match_status');
  });
};

exports.down = async function(knex) {
  // Reverse: make option_id NOT NULL again
  const hasTable = await knex.schema.hasTable('match_schedule_proposals');
  if (!hasTable) return;

  await knex.schema.createTable('match_schedule_proposals_temp', (t) => {
    t.increments('id').primary();
    t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
    t.integer('proposer_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('recipient_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('option_id').notNullable().references('id').inTable('match_time_options').onDelete('CASCADE');
    t.text('proposed_datetime').nullable();
    t.string('status', 20).notNullable().defaultTo('sent');
    t.text('note').nullable();
    t.text('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    t.text('responded_at').nullable();
  });

  await knex.raw(`
    INSERT INTO match_schedule_proposals_temp 
    SELECT * FROM match_schedule_proposals
    WHERE option_id IS NOT NULL
  `);

  await knex.schema.dropTable('match_schedule_proposals');
  await knex.schema.renameTable('match_schedule_proposals_temp', 'match_schedule_proposals');

  await knex.schema.table('match_schedule_proposals', (t) => {
    t.index(['match_id'], 'idx_match_schedule_proposals_match');
    t.index(['match_id', 'status'], 'idx_match_schedule_proposals_match_status');
  });
};
