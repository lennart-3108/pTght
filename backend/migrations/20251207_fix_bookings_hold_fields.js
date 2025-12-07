/**
 * Migration: Ensure hold-related fields exist
 * - slots.held_expires_at
 * - bookings.idempotency_key
 */

module.exports = {
  up: async (knex) => {
    const hasSlotsHeld = await knex.schema.hasColumn('slots', 'held_expires_at').catch(() => false);
    if (!hasSlotsHeld) {
      await knex.schema.alterTable('slots', (table) => {
        table.dateTime('held_expires_at').nullable().index('slots_held_expires_idx');
      });
      console.log('✓ Added slots.held_expires_at');
    } else {
      console.log('✓ slots.held_expires_at already exists');
    }

    const hasBookingsIdem = await knex.schema.hasColumn('bookings', 'idempotency_key').catch(() => false);
    if (!hasBookingsIdem) {
      await knex.schema.alterTable('bookings', (table) => {
        table.string('idempotency_key', 100).nullable().index('bookings_idempotency_idx');
      });
      console.log('✓ Added bookings.idempotency_key');
    } else {
      console.log('✓ bookings.idempotency_key already exists');
    }
  },

  down: async (knex) => {
    // Be conservative: do not drop columns in down
    console.log('No-op down for 20251207_fix_bookings_hold_fields');
  }
};
