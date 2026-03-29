exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('direct_match_invitations');
  if (exists) return;

  await knex.schema.createTable('direct_match_invitations', (table) => {
    table.increments('id').primary();
    table.integer('chat_id').notNullable();
    table.integer('requester_user_id').notNullable();
    table.integer('recipient_user_id').notNullable();
    table.integer('sport_id').notNullable();
    table.integer('city_id').notNullable();
    table.integer('location_id').nullable();
    table.text('when_type').nullable();
    table.text('kickoff_at').nullable();
    table.text('kickoff_end_at').nullable();
    table.integer('range_days').nullable();
    table.text('player_level').nullable();
    table.text('time_of_day').nullable();
    table.text('time_from').nullable();
    table.text('time_to').nullable();
    table.text('note').nullable();
    table.text('availability_json').nullable();
    table.text('status').notNullable().defaultTo('pending');
    table.integer('match_id').nullable();
    table.text('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.text('updated_at').nullable();
    table.text('responded_at').nullable();

    table.index(['chat_id', 'created_at'], 'dmi_chat_created_idx');
    table.index(['recipient_user_id', 'status'], 'dmi_recipient_status_idx');
  });
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasTable('direct_match_invitations');
  if (!exists) return;
  await knex.schema.dropTable('direct_match_invitations');
};