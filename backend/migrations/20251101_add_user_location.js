/**
 * Migration: Add latitude and longitude columns to users table
 * For storing user's current location
 */

exports.up = async function (knex) {
  const table = 'users';
  const exists = await knex.schema.hasTable(table);
  if (!exists) return;

  // Helper to add a column only if missing
  const addIfMissing = async (col, add) => {
    const has = await knex.schema.hasColumn(table, col);
    if (!has) {
      await knex.schema.alterTable(table, (t) => add(t));
    }
  };

  await addIfMissing('latitude', (t) => t.decimal('latitude', 10, 8).nullable());
  await addIfMissing('longitude', (t) => t.decimal('longitude', 11, 8).nullable());
  await addIfMissing('location_updated_at', (t) => t.timestamp('location_updated_at').nullable());
};

exports.down = async function (knex) {
  const table = 'users';
  const dropIfExists = async (col) => {
    const has = await knex.schema.hasColumn(table, col);
    if (has) {
      await knex.schema.alterTable(table, (t) => t.dropColumn(col));
    }
  };

  await dropIfExists('latitude');
  await dropIfExists('longitude');
  await dropIfExists('location_updated_at');
};
