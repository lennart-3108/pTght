/**
 * Repair migration: ensure assets.status column exists with default 'active'.
 * Idempotent: only adds column if missing.
 */
exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('assets');
  if (!hasTable) return;
  const info = await knex('assets').columnInfo().catch(() => ({}));
  if (!Object.prototype.hasOwnProperty.call(info, 'status')) {
    await knex.schema.alterTable('assets', (t) => {
      t.text('status').notNullable().defaultTo('active');
    });
  }
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('assets');
  if (!hasTable) return;
  const info = await knex('assets').columnInfo().catch(() => ({}));
  if (Object.prototype.hasOwnProperty.call(info, 'status')) {
    // Safe removal; note this may fail if constraints depend on status in production
    await knex.schema.alterTable('assets', (t) => {
      t.dropColumn('status');
    });
  }
};
