/**
 * Migration: Add payment fields to bookings
 * - payment_intent_id (string)
 * - payment_status (string: unpaid|pending|paid|refunded)
 */

module.exports = {
  up: async (knex) => {
    const hasIntent = await knex.schema.hasColumn('bookings', 'payment_intent_id').catch(() => false);
    const hasStatus = await knex.schema.hasColumn('bookings', 'payment_status').catch(() => false);

    if (!hasIntent) {
      await knex.schema.alterTable('bookings', (table) => {
        table.string('payment_intent_id', 100).nullable().index('bookings_payment_intent_idx');
      });
      console.log('✓ Added bookings.payment_intent_id');
    } else {
      console.log('✓ bookings.payment_intent_id already exists');
    }

    if (!hasStatus) {
      await knex.schema.alterTable('bookings', (table) => {
        table.string('payment_status', 20).defaultTo('unpaid').index('bookings_payment_status_idx');
      });
      console.log('✓ Added bookings.payment_status');
    } else {
      console.log('✓ bookings.payment_status already exists');
    }
  },

  down: async (knex) => {
    // Non-destructive down: do not drop columns
    console.log('No-op down for 20251207_add_payment_fields_to_bookings');
  }
};
