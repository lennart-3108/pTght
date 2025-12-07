/**
 * Repair migration: ensure essential columns exist on `slots` table.
 * Columns: duration_minutes, base_price, currency, status.
 */
exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('slots');
  if (!hasTable) return;
  const info = await knex('slots').columnInfo().catch(() => ({}));
  const missing = [];
  if (!Object.prototype.hasOwnProperty.call(info, 'duration_minutes')) missing.push('duration_minutes');
  if (!Object.prototype.hasOwnProperty.call(info, 'base_price')) missing.push('base_price');
  if (!Object.prototype.hasOwnProperty.call(info, 'currency')) missing.push('currency');
  if (!Object.prototype.hasOwnProperty.call(info, 'status')) missing.push('status');
  if (!missing.length) return;

  await knex.schema.alterTable('slots', (t) => {
    if (missing.includes('duration_minutes')) t.integer('duration_minutes').notNullable().defaultTo(60);
    if (missing.includes('base_price')) t.decimal('base_price', 10, 2).defaultTo(0);
    if (missing.includes('currency')) t.string('currency', 3).notNullable().defaultTo('EUR');
    if (missing.includes('status')) t.string('status', 50).notNullable().defaultTo('available');
  });
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('slots');
  if (!hasTable) return;
  const info = await knex('slots').columnInfo().catch(() => ({}));
  await knex.schema.alterTable('slots', (t) => {
    if (Object.prototype.hasOwnProperty.call(info, 'status')) t.dropColumn('status');
    if (Object.prototype.hasOwnProperty.call(info, 'currency')) t.dropColumn('currency');
    if (Object.prototype.hasOwnProperty.call(info, 'base_price')) t.dropColumn('base_price');
    if (Object.prototype.hasOwnProperty.call(info, 'duration_minutes')) t.dropColumn('duration_minutes');
  });
};
