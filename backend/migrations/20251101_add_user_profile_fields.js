/**
 * Migration: Add additional profile fields to users table
 * bio, location (city name), phone, birth_date, gender
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

  await addIfMissing('bio', (t) => t.text('bio').nullable());
  await addIfMissing('location', (t) => t.string('location', 255).nullable()); // City name or text location
  await addIfMissing('phone', (t) => t.string('phone', 50).nullable());
  await addIfMissing('birth_date', (t) => t.date('birth_date').nullable());
  await addIfMissing('gender', (t) => t.string('gender', 50).nullable());
};

exports.down = async function (knex) {
  const table = 'users';
  const dropIfExists = async (col) => {
    const has = await knex.schema.hasColumn(table, col);
    if (has) {
      await knex.schema.alterTable(table, (t) => t.dropColumn(col));
    }
  };

  await dropIfExists('bio');
  await dropIfExists('location');
  await dropIfExists('phone');
  await dropIfExists('birth_date');
  await dropIfExists('gender');
};
