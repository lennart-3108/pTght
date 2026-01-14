/**
 * Migration: Add resale features to bookings and credit balance to users
 */

exports.up = function(knex) {
  return knex.schema
    // Add credit balance to users table
    .table('users', table => {
      table.decimal('credit_balance', 10, 2).defaultTo(0).notNullable();
    })
    // Add resale columns to bookings table
    .table('bookings', table => {
      table.boolean('available_for_resale').defaultTo(false);
      table.integer('original_owner_id').unsigned().nullable();
      table.timestamp('resold_at').nullable();
      
      // Foreign key to users table
      table.foreign('original_owner_id').references('id').inTable('users').onDelete('SET NULL');
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('bookings', table => {
      table.dropForeign('original_owner_id');
      table.dropColumn('available_for_resale');
      table.dropColumn('original_owner_id');
      table.dropColumn('resold_at');
    })
    .table('users', table => {
      table.dropColumn('credit_balance');
    });
};
