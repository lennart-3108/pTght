const express = require('express');
const SuggestService = require('../services/SuggestService');

module.exports = function suggestRoutes(ctx) {
  const router = express.Router();
  const knex = (ctx.knex && ctx.knex.client) ? ctx.knex : (ctx.db && ctx.db.knex ? ctx.db.knex : null);

  if (!knex) {
    router.use((req, res) => res.status(500).json({ error: 'DB_NOT_AVAILABLE' }));
    return router;
  }

  const service = new SuggestService(knex);

  // GET /suggest/next
  router.get('/next', async (req, res) => {
    try {
      const { city_id: cityId, sport, from, to, duration } = req.query || {};
      const result = await service.nextFreeSlot({ cityId, sport, from, to, duration: duration ? parseInt(duration) : undefined });
      return res.json(result ? { slot: result } : { slot: null });
    } catch (err) {
      console.error('[GET /suggest/next] error:', err);
      return res.status(500).json({ error: err.message || 'Failed to suggest next slot' });
    }
  });

  // GET /suggest/top
  router.get('/top', async (req, res) => {
    try {
      const { city_id: cityId, sport, limit } = req.query || {};
      const rows = await service.bestSlots({ cityId, sport, limit: limit ? parseInt(limit) : undefined });
      return res.json({ slots: rows });
    } catch (err) {
      console.error('[GET /suggest/top] error:', err);
      return res.status(500).json({ error: err.message || 'Failed to suggest top slots' });
    }
  });

  return router;
};
