/**
 * Migration: Add booking rules to assets
 * - min_booking_duration: minimum bookable time in minutes
 * - max_booking_duration: maximum bookable time in minutes
 * - slot_interval: interval between slot start times in minutes
 * - advance_booking_days: how many days in advance bookings are allowed
 * - cancellation_hours: hours before start time that cancellation is allowed
 */

exports.up = function(knex) {
  return knex.schema.alterTable('assets', table => {
    table.integer('min_booking_duration').defaultTo(60).comment('Minimum booking duration in minutes');
    table.integer('max_booking_duration').defaultTo(120).comment('Maximum booking duration in minutes');
    table.integer('slot_interval').defaultTo(15).comment('Interval between slot start times in minutes');
    table.integer('advance_booking_days').defaultTo(30).comment('Days in advance bookings allowed');
    table.integer('cancellation_hours').defaultTo(24).comment('Hours before start for cancellation');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('assets', table => {
    table.dropColumn('min_booking_duration');
    table.dropColumn('max_booking_duration');
    table.dropColumn('slot_interval');
    table.dropColumn('advance_booking_days');
    table.dropColumn('cancellation_hours');
  });
};
