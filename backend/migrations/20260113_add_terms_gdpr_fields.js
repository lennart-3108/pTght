/**
 * Migration: Add Terms and GDPR acceptance fields to users table
 * accept_terms, accept_gdpr, country_code
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

  await addIfMissing('accept_terms', (t) => t.boolean('accept_terms').defaultTo(false).notNullable());
  await addIfMissing('accept_gdpr', (t) => t.boolean('accept_gdpr').defaultTo(false).notNullable());
  await addIfMissing('country_code', (t) => t.string('country_code', 3).nullable());
};

exports.down = async function (knex) {
  const table = 'users';
  const dropIfExists = async (col) => {
    const has = await knex.schema.hasColumn(table, col);
    if (has) {
      await knex.schema.alterTable(table, (t) => t.dropColumn(col));
    }
  };

  await dropIfExists('accept_terms');
  await dropIfExists('accept_gdpr');
  await dropIfExists('country_code');
};
