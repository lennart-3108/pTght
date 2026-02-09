/**
 * Migration: Add result_details JSON field to matches table
 * For storing additional result information like tennis sets, abort reasons, etc.
 */

exports.up = function(knex) {
  return knex.schema.table('matches', function(table) {
    table.text('result_details').nullable().comment('JSON field for additional result data (sets, abort info, etc.)');
  });
};

exports.down = function(knex) {
  return knex.schema.table('matches', function(table) {
    table.dropColumn('result_details');
  });
};
