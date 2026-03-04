/**
 * Add cancelled_by and cancelled_at columns to matches table for soft-delete support.
 */
exports.up = function (knex) {
  return knex.schema.table('matches', (table) => {
    table.integer('cancelled_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('cancelled_at');
  });
};

exports.down = function (knex) {
  return knex.schema.table('matches', (table) => {
    table.dropColumn('cancelled_by');
    table.dropColumn('cancelled_at');
  });
};
