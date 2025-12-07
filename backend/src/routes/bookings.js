const express = require('express');
const BookingService = require('../services/BookingService');

module.exports = function bookingsRoutes(ctx) {
  const router = express.Router();
  const { knex } = ctx;
  const bookingService = new BookingService(knex);

  // Require auth helper similar to other routes (assuming ctx.auth middleware populates req.user)
  function requireAuth(req, res, next) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  /**
   * POST /bookings/hold
   * Body: { slot_id, idempotency_key? }
   */
  router.post('/hold', requireAuth, async (req, res) => {
    try {
      const { slot_id, idempotency_key } = req.body || {};
      if (!slot_id) return res.status(400).json({ error: 'slot_id is required' });
      const booking = await bookingService.holdSlot({
        userId: req.user.id,
        slotId: parseInt(slot_id),
        idempotencyKey: idempotency_key || null,
      });
      return res.json(booking);
    } catch (error) {
      console.error('[POST /bookings/hold] error:', error);
      const msg = error.message || 'Failed to hold slot';
      const code = msg.includes('not available') ? 409 : 500;
      return res.status(code).json({ error: msg });
    }
  });

  /**
   * POST /bookings/:id/confirm
   */
  router.post('/:id/confirm', requireAuth, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await bookingService.confirmBooking({ bookingId, userId: req.user.id });
      return res.json(booking);
    } catch (error) {
      console.error(`[POST /bookings/${req.params.id}/confirm] error:`, error);
      const msg = error.message || 'Failed to confirm booking';
      let code = 500;
      if (msg.includes('Not authorized')) code = 403;
      else if (msg.includes('Hold expired') || msg.includes('not in held')) code = 409;
      return res.status(code).json({ error: msg });
    }
  });

  /**
   * POST /bookings/:id/cancel
   */
  router.post('/:id/cancel', requireAuth, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const isAdmin = !!req.user.is_admin;
      const { reason } = req.body || {};
      const booking = await bookingService.cancelBooking({ bookingId, userId: req.user.id, isAdmin, reason });
      return res.json(booking);
    } catch (error) {
      console.error(`[POST /bookings/${req.params.id}/cancel] error:`, error);
      const msg = error.message || 'Failed to cancel booking';
      let code = 500;
      if (msg.includes('Not authorized')) code = 403;
      return res.status(code).json({ error: msg });
    }
  });

  /**
   * GET /bookings/me
   */
  router.get('/me', requireAuth, async (req, res) => {
    try {
      const { status, startDate, endDate } = req.query || {};
      const bookings = await bookingService.listUserBookings(req.user.id, { status, startDate, endDate });
      return res.json(bookings);
    } catch (error) {
      console.error('[GET /bookings/me] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch bookings' });
    }
  });

  /**
   * GET /bookings/:id
   */
  router.get('/:id', requireAuth, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await bookingService.getBooking(bookingId);
      if (booking.user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'Not authorized to view this booking' });
      }
      return res.json(booking);
    } catch (error) {
      console.error(`[GET /bookings/${req.params.id}] error:`, error);
      const msg = error.message || 'Failed to fetch booking';
      return res.status(msg.includes('not found') ? 404 : 500).json({ error: msg });
    }
  });

  return router;
};
