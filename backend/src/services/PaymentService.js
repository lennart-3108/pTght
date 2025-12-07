const { randomUUID } = require('crypto');

class PaymentService {
  constructor(db) {
    this.db = db; // knex
  }

  async initiatePayment({ bookingId, userId }) {
    return await this.db.transaction(async (trx) => {
      const booking = await trx('bookings').where({ id: bookingId }).first();
      if (!booking) throw new Error('Booking not found');
      if (booking.user_id !== userId) throw new Error('Not authorized to initiate payment for this booking');
      if (!['held', 'confirmed'].includes(booking.status)) throw new Error('Booking must be held or confirmed to initiate payment');

      const payment_intent_id = booking.payment_intent_id || randomUUID();
      await trx('bookings').where({ id: bookingId }).update({
        payment_status: 'pending',
        payment_intent_id,
        updated_at: trx.fn.now(),
      });

      return { payment_intent_id };
    });
  }

  async completePayment({ bookingId, userId }) {
    return await this.db.transaction(async (trx) => {
      const booking = await trx('bookings').where({ id: bookingId }).first();
      if (!booking) throw new Error('Booking not found');
      if (booking.user_id !== userId) throw new Error('Not authorized to complete payment for this booking');
      if (booking.payment_status !== 'pending') throw new Error('Payment not in pending state');

      await trx('bookings').where({ id: bookingId }).update({
        payment_status: 'paid',
        updated_at: trx.fn.now(),
      });

      const updated = await trx('bookings').where({ id: bookingId }).first();
      return updated;
    });
  }

  async refundPayment({ bookingId, adminUserId, isAdmin }) {
    if (!isAdmin) throw new Error('Admin access required');
    return await this.db.transaction(async (trx) => {
      const booking = await trx('bookings').where({ id: bookingId }).first();
      if (!booking) throw new Error('Booking not found');

      await trx('bookings').where({ id: bookingId }).update({
        payment_status: 'refunded',
        updated_at: trx.fn.now(),
      });

      return await trx('bookings').where({ id: bookingId }).first();
    });
  }
}

module.exports = PaymentService;
