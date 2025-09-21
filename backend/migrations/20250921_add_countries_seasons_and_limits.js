exports.up = async function(knex) {
  // Create countries table
  const hasCountries = await knex.schema.hasTable('countries');
  if (!hasCountries) {
    await knex.schema.createTable('countries', (t) => {
      t.increments('id').primary();
      t.string('code', 8).notNullable().index();
      t.string('name').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // Add country_id to cities
  const hasCities = await knex.schema.hasTable('cities');
  if (hasCities) {
    const hasCountryCol = await knex.schema.hasColumn('cities', 'country_id');
    if (!hasCountryCol) {
      await knex.schema.table('cities', (t) => {
        t.integer('country_id').unsigned().nullable().references('id').inTable('countries').onDelete('SET NULL');
      });
    }
  }

  // Create seasons table
  const hasSeasons = await knex.schema.hasTable('seasons');
  if (!hasSeasons) {
    await knex.schema.createTable('seasons', (t) => {
      t.increments('id').primary();
      t.integer('league_id').unsigned().notNullable().references('id').inTable('leagues').onDelete('CASCADE');
      t.string('name').notNullable();
      t.date('starts_at').notNullable();
      t.date('ends_at').notNullable();
      t.boolean('is_active').defaultTo(true);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // Add season_id and status/completed_at to matches (or games) table if matches exists
  const hasMatches = await knex.schema.hasTable('matches');
  if (hasMatches) {
    const hasSeasonId = await knex.schema.hasColumn('matches', 'season_id');
    if (!hasSeasonId) {
      await knex.schema.table('matches', (t) => {
        t.integer('season_id').unsigned().nullable().references('id').inTable('seasons').onDelete('SET NULL');
      });
    }
    const hasStatus = await knex.schema.hasColumn('matches', 'status');
    if (!hasStatus) {
      await knex.schema.table('matches', (t) => {
        t.string('status').nullable().defaultTo('open'); // open | scheduled | completed | cancelled
        t.timestamp('completed_at').nullable();
      });
    }
  }

  // Add max_participants to leagues
  const hasLeagues = await knex.schema.hasTable('leagues');
  if (hasLeagues) {
    const hasMax = await knex.schema.hasColumn('leagues', 'max_participants');
    if (!hasMax) {
      await knex.schema.table('leagues', (t) => {
        t.integer('max_participants').nullable();
      });
    }
  }

  // Add team_size to sports if missing (used to interpret max_participants)
  const hasSports = await knex.schema.hasTable('sports');
  if (hasSports) {
    const hasTeamSize = await knex.schema.hasColumn('sports', 'team_size');
    if (!hasTeamSize) {
      await knex.schema.table('sports', (t) => {
        t.integer('team_size').nullable();
        t.string('sport_type').nullable(); // 'team' or 'single' - existing migration may already have this
      });
    }
  }
};

exports.down = async function(knex) {
  // reverse changes where sensible
  if (await knex.schema.hasTable('matches')) {
    if (await knex.schema.hasColumn('matches', 'season_id')) {
      await knex.schema.table('matches', (t) => { t.dropColumn('season_id'); });
    }
    if (await knex.schema.hasColumn('matches', 'status')) {
      await knex.schema.table('matches', (t) => { t.dropColumn('status'); });
    }
    if (await knex.schema.hasColumn('matches', 'completed_at')) {
      await knex.schema.table('matches', (t) => { t.dropColumn('completed_at'); });
    }
  }

  if (await knex.schema.hasTable('seasons')) {
    await knex.schema.dropTable('seasons');
  }

  if (await knex.schema.hasTable('leagues')) {
    if (await knex.schema.hasColumn('leagues', 'max_participants')) {
      await knex.schema.table('leagues', (t) => { t.dropColumn('max_participants'); });
    }
  }

  if (await knex.schema.hasTable('sports')) {
    if (await knex.schema.hasColumn('sports', 'team_size')) {
      await knex.schema.table('sports', (t) => { t.dropColumn('team_size'); });
    }
    if (await knex.schema.hasColumn('sports', 'sport_type')) {
      await knex.schema.table('sports', (t) => { t.dropColumn('sport_type'); });
    }
  }

  if (await knex.schema.hasTable('cities')) {
    if (await knex.schema.hasColumn('cities', 'country_id')) {
      await knex.schema.table('cities', (t) => { t.dropColumn('country_id'); });
    }
  }

  if (await knex.schema.hasTable('countries')) {
    await knex.schema.dropTable('countries');
  }
};
