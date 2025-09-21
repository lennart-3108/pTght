exports.up = async function(knex) {
  const hasTeamRosters = await knex.schema.hasTable('team_match_rosters');
  if (!hasTeamRosters) {
    await knex.schema.createTable('team_match_rosters', (t) => {
      t.increments('id').primary();
      t.integer('team_id').unsigned().notNullable().references('id').inTable('teams').onDelete('CASCADE');
      t.integer('match_id').unsigned().notNullable().references('id').inTable('matches').onDelete('CASCADE');
      t.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.unique(['team_id','match_id']);
    });
  }

  const hasRosterPlayers = await knex.schema.hasTable('team_roster_players');
  if (!hasRosterPlayers) {
    await knex.schema.createTable('team_roster_players', (t) => {
      t.increments('id').primary();
      t.integer('roster_id').unsigned().notNullable().references('id').inTable('team_match_rosters').onDelete('CASCADE');
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('role').notNullable().defaultTo('sub'); // 'starter' or 'sub'
      t.integer('shirt_number').nullable();
      t.unique(['roster_id','user_id']);
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('team_roster_players')) await knex.schema.dropTable('team_roster_players');
  if (await knex.schema.hasTable('team_match_rosters')) await knex.schema.dropTable('team_match_rosters');
};
