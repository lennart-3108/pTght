/**
 * Migration: Create Community Leagues v2
 * - community_leagues: Umbrella leagues per sport + city (lazy creation)
 * - Extend leagues table with community_league_id and is_community_mini_league
 * - Ensure sports.league_members column exists for max participants
 */

exports.up = async function(knex) {
  console.log('Setting up Community Leagues v2...');

  // Ensure sports.league_members column exists
  const hasLeagueMembers = await knex.schema.hasColumn('sports', 'league_members');
  if (!hasLeagueMembers) {
    await knex.schema.table('sports', (table) => {
      table.integer('league_members').defaultTo(10).comment('Max participants per mini-league (default: 10)');
    });
    console.log('✓ Added league_members column to sports table');
  }

  // Create community_leagues table (umbrella leagues)
  const hasCommunityLeaguesTable = await knex.schema.hasTable('community_leagues');
  if (!hasCommunityLeaguesTable) {
    await knex.schema.createTable('community_leagues', (table) => {
      table.increments('id').primary();
      table.integer('sport_id').notNullable().references('id').inTable('sports');
      table.integer('city_id').notNullable().references('id').inTable('cities');
      table.boolean('active').defaultTo(true).comment('Visibility flag for the community league');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Unique constraint: one community league per sport + city
      table.unique(['sport_id', 'city_id']);
    });
    console.log('✓ Created community_leagues table');
  }

  // Extend leagues table for mini-leagues
  const hasCommunityLeagueId = await knex.schema.hasColumn('leagues', 'community_league_id');
  if (!hasCommunityLeagueId) {
    await knex.schema.table('leagues', (table) => {
      table.integer('community_league_id').nullable().references('id').inTable('community_leagues')
        .comment('Reference to umbrella community league (NULL for regular leagues)');
    });
    console.log('✓ Added community_league_id to leagues table');
  }

  // Add is_community_mini_league field to leagues
  const hasIsCommunityMiniLeague = await knex.schema.hasColumn('leagues', 'is_community_mini_league');
  if (!hasIsCommunityMiniLeague) {
    await knex.schema.table('leagues', (table) => {
      table.boolean('is_community_mini_league').defaultTo(false)
        .comment('True if this is an auto-generated mini-league within a community league');
    });
    console.log('✓ Added is_community_mini_league to leagues table');
  }

  // Create indexes for performance
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_community_leagues_sport_city ON community_leagues(sport_id, city_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_leagues_community_league_id ON leagues(community_league_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_leagues_is_community_mini_league ON leagues(is_community_mini_league)');

  console.log('✓ Community Leagues v2 migration completed');
};

exports.down = async function(knex) {
  // Remove indexes
  await knex.schema.raw('DROP INDEX IF EXISTS idx_leagues_is_community_mini_league');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_leagues_community_league_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_community_leagues_sport_city');

  // Remove added columns
  const hasIsCommunityMiniLeague = await knex.schema.hasColumn('leagues', 'is_community_mini_league');
  if (hasIsCommunityMiniLeague) {
    await knex.schema.table('leagues', (table) => {
      table.dropColumn('is_community_mini_league');
    });
  }

  const hasCommunityLeagueId = await knex.schema.hasColumn('leagues', 'community_league_id');
  if (hasCommunityLeagueId) {
    await knex.schema.table('leagues', (table) => {
      table.dropColumn('community_league_id');
    });
  }

  // Drop community_leagues table
  await knex.schema.dropTableIfExists('community_leagues');

  // Remove league_members from sports (only if we added it)
  const hasLeagueMembers = await knex.schema.hasColumn('sports', 'league_members');
  if (hasLeagueMembers) {
    await knex.schema.table('sports', (table) => {
      table.dropColumn('league_members');
    });
  }

  console.log('✓ Community Leagues v2 migration rolled back');
};
