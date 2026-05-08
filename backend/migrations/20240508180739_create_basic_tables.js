/**
 * Migration: Create basic tables required for the application
 * This ensures all fundamental tables exist before other migrations try to modify them
 */

exports.up = async function(knex) {
  console.log('Creating basic application tables...');

  // Users table
  const hasUsersTable = await knex.schema.hasTable('users');
  if (!hasUsersTable) {
    await knex.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('email').unique().notNullable();
      table.string('firstname');
      table.string('lastname');
      table.string('password_hash');
      table.boolean('is_admin').defaultTo(false);
      table.boolean('open_for_matches').defaultTo(true);
      table.text('favorite_sports');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    console.log('✓ Created users table');
  }

  // Sports table
  const hasSportsTable = await knex.schema.hasTable('sports');
  if (!hasSportsTable) {
    await knex.schema.createTable('sports', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.integer('league_members').defaultTo(10).comment('Max participants per mini-league');
      table.boolean('active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    console.log('✓ Created sports table');
  }

  // Cities table
  const hasCitiesTable = await knex.schema.hasTable('cities');
  if (!hasCitiesTable) {
    await knex.schema.createTable('cities', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    console.log('✓ Created cities table');
  }

  // Leagues table (basic structure)
  const hasLeaguesTable = await knex.schema.hasTable('leagues');
  if (!hasLeaguesTable) {
    await knex.schema.createTable('leagues', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.integer('sport_id').notNullable().references('id').inTable('sports');
      table.integer('city_id').notNullable().references('id').inTable('cities');
      table.string('status', 20).defaultTo('inactive').comment('inactive, active, archived');
      table.boolean('active').defaultTo(true).comment('Visibility flag');
      table.boolean('publicState').defaultTo(true);
      table.date('start_date');
      table.date('end_date');
      table.timestamp('activated_at').nullable().comment('When the league was first activated');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    console.log('✓ Created leagues table');
  }

  // User leagues junction table
  const hasUserLeaguesTable = await knex.schema.hasTable('user_leagues');
  if (!hasUserLeaguesTable) {
    await knex.schema.createTable('user_leagues', (table) => {
      table.integer('user_id').notNullable().references('id').inTable('users');
      table.integer('league_id').notNullable().references('id').inTable('leagues');
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.primary(['user_id', 'league_id']);
    });
    console.log('✓ Created user_leagues table');
  }

  // Matches table
  const hasMatchesTable = await knex.schema.hasTable('matches');
  if (!hasMatchesTable) {
    await knex.schema.createTable('matches', (table) => {
      table.increments('id').primary();
      table.integer('league_id').notNullable().references('id').inTable('leagues');
      table.integer('home_user_id').references('id').inTable('users');
      table.integer('away_user_id').references('id').inTable('users');
      table.integer('home_score');
      table.integer('away_score');
      table.datetime('kickoff_at');
      table.string('status', 20).defaultTo('scheduled');
      table.datetime('completed_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
    console.log('✓ Created matches table');
  }

  console.log('✓ Basic tables creation completed');
};

exports.down = async function(knex) {
  // Drop tables in reverse order (respecting foreign keys)
  await knex.schema.dropTableIfExists('matches');
  await knex.schema.dropTableIfExists('user_leagues');
  await knex.schema.dropTableIfExists('leagues');
  await knex.schema.dropTableIfExists('cities');
  await knex.schema.dropTableIfExists('sports');
  await knex.schema.dropTableIfExists('users');

  console.log('✓ Basic tables dropped');
};