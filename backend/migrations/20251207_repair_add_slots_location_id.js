/**
 * Repair migration: ensure slots.location_id exists.
 * The suggest and search endpoints join slots to locations via this column.
 * Idempotent: only adds if missing.
 */
exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('slots');
  if (!hasTable) return;
  const info = await knex('slots').columnInfo().catch(() => ({}));
  if (!Object.prototype.hasOwnProperty.call(info, 'location_id')) {
    await knex.schema.alterTable('slots', (t) => {
      t.integer('location_id').unsigned().notNullable().defaultTo(1);
    });
    console.log('✓ Added slots.location_id');
  } else {
    console.log('✓ slots.location_id already exists');
  }
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('slots');
  if (!hasTable) return;
  const info = await knex('slots').columnInfo().catch(() => ({}));
  if (Object.prototype.hasOwnProperty.call(info, 'location_id')) {
    await knex.schema.alterTable('slots', (t) => {
      t.dropColumn('location_id');
    });
  }
};
