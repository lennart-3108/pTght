const express = require('express');
const PaymentService = require('../services/PaymentService');

module.exports = function paymentsRoutes(ctx) {
  const router = express.Router();
  const knex = (ctx.knex && ctx.knex.client) ? ctx.knex : (ctx.db && ctx.db.knex ? ctx.db.knex : null);

  if (!knex) {
    router.use((req, res) => res.status(500).json({ error: 'DB_NOT_AVAILABLE' }));
    return router;
  }

  const service = new PaymentService(knex);

  function requireAuth(req, res, next) {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }
  function requireAdmin(req, res, next) {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  }

  // POST /payments/initiate
  router.post('/initiate', requireAuth, async (req, res) => {
    try {
      const { booking_id } = req.body || {};
      if (!booking_id) return res.status(400).json({ error: 'booking_id is required' });
      const result = await service.initiatePayment({ bookingId: parseInt(booking_id), userId: req.user.id });
      return res.json(result);
    } catch (err) {
      console.error('[POST /payments/initiate] error:', err);
      const msg = err.message || 'Failed to initiate payment';
      let code = 500;
      if (msg.includes('Not authorized')) code = 403;
      else if (msg.includes('must be held') || msg.includes('Booking not')) code = 409;
      return res.status(code).json({ error: msg });
    }
  });

  // POST /payments/complete
  router.post('/complete', requireAuth, async (req, res) => {
    try {
      const { booking_id } = req.body || {};
      if (!booking_id) return res.status(400).json({ error: 'booking_id is required' });
      const updated = await service.completePayment({ bookingId: parseInt(booking_id), userId: req.user.id });
      return res.json(updated);
    } catch (err) {
      console.error('[POST /payments/complete] error:', err);
      const msg = err.message || 'Failed to complete payment';
      let code = 500;
      if (msg.includes('Not authorized')) code = 403;
      else if (msg.includes('pending')) code = 409;
      return res.status(code).json({ error: msg });
    }
  });

  // POST /payments/:bookingId/refund
  router.post('/:bookingId/refund', requireAdmin, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.bookingId);
      const updated = await service.refundPayment({ bookingId, adminUserId: req.user.id, isAdmin: !!req.user.is_admin });
      return res.json(updated);
    } catch (err) {
      console.error(`[POST /payments/${req.params.bookingId}/refund] error:`, err);
      const msg = err.message || 'Failed to refund payment';
      let code = 500;
      if (msg.includes('Admin access')) code = 403;
      return res.status(code).json({ error: msg });
    }
  });

  return router;
};
