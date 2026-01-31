/**
 * Migration: Add published columns for manual content approval
 * - sports.published (with hierarchy publishing support)
 * - locations.published (with hierarchy publishing support)
 * - leagues.published (for community leagues)
 */

exports.up = async function(knex) {
  console.log('[Publishing] Adding published columns...');

  // Add published to sports
  const hasSportsPublished = await knex.schema.hasColumn('sports', 'published');
  if (!hasSportsPublished) {
    await knex.schema.table('sports', (table) => {
      table.boolean('published').defaultTo(false).notNullable();
      table.index('published');
    });
    console.log('[Publishing] ✓ sports.published added');
  }

  // Add published to locations
  const hasLocationsPublished = await knex.schema.hasColumn('locations', 'published');
  if (!hasLocationsPublished) {
    await knex.schema.table('locations', (table) => {
      table.boolean('published').defaultTo(false).notNullable();
      table.index('published');
    });
    console.log('[Publishing] ✓ locations.published added');
  }

  // Add published to leagues
  const hasLeaguesPublished = await knex.schema.hasColumn('leagues', 'published');
  if (!hasLeaguesPublished) {
    await knex.schema.table('leagues', (table) => {
      table.boolean('published').defaultTo(false).notNullable();
      table.index('published');
    });
    console.log('[Publishing] ✓ leagues.published added');
  }

  // Publish all existing sports by default (legacy data)
  await knex('sports').update({ published: true });
  console.log('[Publishing] ✓ Existing sports published');

  // Publish all existing locations by default (legacy data)
  await knex('locations').update({ published: true });
  console.log('[Publishing] ✓ Existing locations published');

  // Publish all existing leagues by default (legacy data)
  await knex('leagues').update({ published: true });
  console.log('[Publishing] ✓ Existing leagues published');

  console.log('[Publishing] ✅ Publishing system ready!');
};

exports.down = async function(knex) {
  const hasSportsPublished = await knex.schema.hasColumn('sports', 'published');
  if (hasSportsPublished) {
    await knex.schema.table('sports', (table) => {
      table.dropColumn('published');
    });
  }

  const hasLocationsPublished = await knex.schema.hasColumn('locations', 'published');
  if (hasLocationsPublished) {
    await knex.schema.table('locations', (table) => {
      table.dropColumn('published');
    });
  }

  const hasLeaguesPublished = await knex.schema.hasColumn('leagues', 'published');
  if (hasLeaguesPublished) {
    await knex.schema.table('leagues', (table) => {
      table.dropColumn('published');
    });
  }

  console.log('[Publishing] Rollback complete');
};
