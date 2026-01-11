/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('notifications');
  if (exists) return;

  await knex.schema.createTable('notifications', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().index();
    table.string('type', 50).notNullable(); // 'schedule_proposal', 'availability_shared', 'match_result', etc.
    table.integer('match_id').nullable().index();
    table.integer('from_user_id').nullable();
    table.integer('proposal_id').nullable();
    table.string('title', 255).nullable();
    table.text('message').nullable();
    table.datetime('created_at').notNullable();
    table.integer('is_read').defaultTo(0);
    
    table.index(['user_id', 'created_at']);
    table.index(['user_id', 'is_read']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('notifications');
};
