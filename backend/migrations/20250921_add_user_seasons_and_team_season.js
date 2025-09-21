exports.up = async function(knex) {
  // Add season_id to teams if missing
  const hasTeams = await knex.schema.hasTable('teams');
  if (hasTeams) {
    const hasSeasonId = await knex.schema.hasColumn('teams', 'season_id');
    if (!hasSeasonId) {
      await knex.schema.table('teams', (t) => {
        t.integer('season_id').unsigned().nullable().references('id').inTable('seasons').onDelete('SET NULL');
      });
    }
  }

  // Create user_seasons table
  const hasUserSeasons = await knex.schema.hasTable('user_seasons');
  if (!hasUserSeasons) {
    await knex.schema.createTable('user_seasons', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.integer('season_id').unsigned().notNullable().references('id').inTable('seasons').onDelete('CASCADE');
      t.integer('team_id').unsigned().nullable().references('id').inTable('teams').onDelete('SET NULL');
      t.timestamp('joined_at').defaultTo(knex.fn.now());
      t.string('status').nullable();
      t.unique(['user_id', 'season_id']);
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('user_seasons')) {
    await knex.schema.dropTable('user_seasons');
  }
  if (await knex.schema.hasTable('teams')) {
    if (await knex.schema.hasColumn('teams', 'season_id')) {
      await knex.schema.table('teams', (t) => { t.dropColumn('season_id'); });
    }
  }
};
