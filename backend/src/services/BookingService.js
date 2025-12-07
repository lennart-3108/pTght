/**
 * BookingService
 * Implements booking lifecycle: hold -> confirm -> cancel
 * Follows style of AssetService/SlotService using Knex via ctx
 */

class BookingService {
  constructor(db) {
    this.db = db; // knex instance
  }

  // Helper: now plus minutes
  _nowPlusMinutes(minutes) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    // format as ISO 8601 without milliseconds to match other code style
    return new Date(d).toISOString().slice(0, 19).replace('T', ' ');
  }

  async holdSlot({ userId, slotId, idempotencyKey }) {
    return await this.db.transaction(async (trx) => {
      // Load slot with asset & location
      const slot = await trx('slots as s')
        .join('assets as a', 's.asset_id', 'a.id')
        .join('locations as l', 's.location_id', 'l.id')
        .select('s.*', trx.raw('a.id as asset_id'), trx.raw('l.id as location_id'))
        .where('s.id', slotId)
        .first();

      if (!slot) throw new Error('Slot not found');
      // Status must be available; held expiry either null or past
      const isAvailable = slot.status === 'available';
      const heldExpired = !slot.held_expires_at || new Date(slot.held_expires_at) < new Date();
      if (!isAvailable || !heldExpired) {
        throw new Error('Slot not available for hold');
      }

      // Update slot to held with expiry
      const heldUntil = this._nowPlusMinutes(10);
      await trx('slots')
        .where({ id: slotId })
        .update({ status: 'held', held_expires_at: heldUntil, updated_at: trx.fn.now() });

      // Upsert booking row for this slot & user
      // Try find existing held booking with same idempotency key (if provided)
      let booking;
      if (idempotencyKey) {
        booking = await trx('bookings')
          .where({ slot_id: slotId, user_id: userId, idempotency_key: idempotencyKey })
          .first();
      }

      if (booking) {
        // Refresh times/status if needed
        await trx('bookings').where({ id: booking.id }).update({ status: 'held', updated_at: trx.fn.now() });
      } else {
        const bookingData = {
          user_id: userId,
          slot_id: slotId,
          asset_id: slot.asset_id,
          location_id: slot.location_id,
          status: 'held',
          start_time: slot.start_time,
          end_time: slot.end_time,
          currency: slot.currency || 'EUR',
          amount: slot.base_price || null,
          idempotency_key: idempotencyKey || null,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        };
        const [id] = await trx('bookings').insert(bookingData);
        booking = await trx('bookings').where({ id }).first();
      }

      return booking;
    });
  }

  async confirmBooking({ bookingId, userId }) {
    return await this.db.transaction(async (trx) => {
      const booking = await trx('bookings').where({ id: bookingId }).first();
      if (!booking) throw new Error('Booking not found');
      if (booking.user_id !== userId) throw new Error('Not authorized to confirm this booking');
      if (booking.status !== 'held') throw new Error('Booking is not in held status');

      const slot = await trx('slots').where({ id: booking.slot_id }).first();
      if (!slot) throw new Error('Slot not found');
      if (slot.status !== 'held') throw new Error('Slot is not held');
      if (!slot.held_expires_at || new Date(slot.held_expires_at) <= new Date()) {
        throw new Error('Hold expired');
      }

      await trx('bookings').where({ id: bookingId }).update({ status: 'confirmed', updated_at: trx.fn.now() });
      await trx('slots').where({ id: booking.slot_id }).update({ status: 'booked', held_expires_at: null, updated_at: trx.fn.now() });

      return await trx('bookings').where({ id: bookingId }).first();
    });
  }

  async cancelBooking({ bookingId, userId, isAdmin = false, reason = null }) {
    return await this.db.transaction(async (trx) => {
      const booking = await trx('bookings').where({ id: bookingId }).first();
      if (!booking) throw new Error('Booking not found');
      if (!isAdmin && booking.user_id !== userId) throw new Error('Not authorized to cancel this booking');

      await trx('bookings').where({ id: bookingId }).update({ status: 'cancelled', cancellation_reason: reason, updated_at: trx.fn.now() });

      const slot = await trx('slots').where({ id: booking.slot_id }).first();
      if (slot) {
        // Free slot back to available
        await trx('slots').where({ id: slot.id }).update({ status: 'available', held_expires_at: null, updated_at: trx.fn.now() });
      }

      return await trx('bookings').where({ id: bookingId }).first();
    });
  }

  async getBooking(id) {
    const row = await this.db('bookings as b')
      .leftJoin('slots as s', 'b.slot_id', 's.id')
      .leftJoin('assets as a', 'b.asset_id', 'a.id')
      .leftJoin('locations as l', 'b.location_id', 'l.id')
      .select(
        'b.*',
        this.db.raw('s.start_time as slot_start_time'),
        this.db.raw('s.end_time as slot_end_time'),
        this.db.raw('a.name as asset_name'),
        this.db.raw('l.name as location_name'),
        this.db.raw('l.city as location_city')
      )
      .where('b.id', id)
      .first();
    if (!row) throw new Error('Booking not found');
    return row;
  }

  async listUserBookings(userId, filters = {}) {
    let query = this.db('bookings as b')
      .leftJoin('slots as s', 'b.slot_id', 's.id')
      .leftJoin('assets as a', 'b.asset_id', 'a.id')
      .leftJoin('locations as l', 'b.location_id', 'l.id')
      .select(
        'b.*',
        this.db.raw('s.start_time as slot_start_time'),
        this.db.raw('s.end_time as slot_end_time'),
        this.db.raw('a.name as asset_name'),
        this.db.raw('l.name as location_name'),
        this.db.raw('l.city as location_city')
      )
      .where('b.user_id', userId);

    if (filters.status) query = query.where('b.status', filters.status);
    if (filters.startDate) query = query.where('b.start_time', '>=', filters.startDate);
    if (filters.endDate) query = query.where('b.start_time', '<=', filters.endDate);

    return await query.orderBy('b.created_at', 'desc');
  }
}

module.exports = BookingService;
