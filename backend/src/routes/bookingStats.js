const express = require('express');

module.exports = function bookingStatsRoutes(ctx) {
  const router = express.Router();
  const knex = (ctx.knex && ctx.knex.client) ? ctx.knex : (ctx.db && ctx.db.knex ? ctx.db.knex : null);

  if (!knex) {
    router.use((req, res) => res.status(500).json({ error: 'DB_NOT_AVAILABLE' }));
    return router;
  }

  function requireAdmin(req, res, next) {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  }

  // GET /booking-stats/summary
  router.get('/summary', requireAdmin, async (req, res) => {
    try {
      // Total bookings
      const totalRow = await knex('bookings').count({ c: '*' }).first();
      const total = Number(totalRow.c || 0);
      // Confirmed
      const confirmedRow = await knex('bookings').where('status', 'confirmed').count({ c: '*' }).first();
      const confirmed = Number(confirmedRow.c || 0);
      // Cancelled
      const cancelledRow = await knex('bookings').where('status', 'cancelled').count({ c: '*' }).first();
      const cancelled = Number(cancelledRow.c || 0);
      // Volume by day
      const volume = await knex('bookings')
        .select(knex.raw("DATE(start_time) as day"))
        .count({ count: '*' })
        .where('status', 'confirmed')
        .groupByRaw('DATE(start_time)')
        .orderBy('day', 'asc');

      return res.json({ total, confirmed, cancelled, volume });
    } catch (err) {
      console.error('[GET /booking-stats/summary] error:', err);
      return res.status(500).json({ error: err.message || 'Failed to compute summary' });
    }
  });

  // GET /booking-stats/by-location
  router.get('/by-location', requireAdmin, async (req, res) => {
    try {
      const rows = await knex('bookings as b')
        .join('locations as l', 'b.location_id', 'l.id')
        .select(
          'b.location_id',
          knex.raw('COUNT(*) as total_bookings'),
          knex.raw("SUM(CASE WHEN b.status='confirmed' THEN 1 ELSE 0 END) as confirmed"),
          knex.raw("SUM(CASE WHEN b.status='cancelled' THEN 1 ELSE 0 END) as cancelled"),
          'l.name as location_name',
          'l.city as location_city'
        )
        .groupBy('b.location_id', 'l.name', 'l.city')
        .orderBy('total_bookings', 'desc');

      return res.json(rows);
    } catch (err) {
      console.error('[GET /booking-stats/by-location] error:', err);
      return res.status(500).json({ error: err.message || 'Failed to compute stats by location' });
    }
  });

  // GET /booking-stats/live
  router.get('/live', requireAdmin, async (req, res) => {
    try {
      // open holds: bookings held and slots held
      const openHoldsRow = await knex('bookings').where('status', 'held').count({ c: '*' }).first();
      const openHolds = Number(openHoldsRow.c || 0);
      const slotsHeldRow = await knex('slots').where('status', 'held').count({ c: '*' }).first();
      const slotsHeld = Number(slotsHeldRow.c || 0);
      // active slots: held + booked
      const activeSlotsRow = await knex('slots').whereIn('status', ['held', 'booked']).count({ c: '*' }).first();
      const activeSlots = Number(activeSlotsRow.c || 0);
      // available slots
      const availableSlotsRow = await knex('slots').where('status', 'available').count({ c: '*' }).first();
      const availableSlots = Number(availableSlotsRow.c || 0);

      return res.json({ openHolds, slotsHeld, activeSlots, availableSlots });
    } catch (err) {
      console.error('[GET /booking-stats/live] error:', err);
      return res.status(500).json({ error: err.message || 'Failed to compute live stats' });
    }
  });

  return router;
};
