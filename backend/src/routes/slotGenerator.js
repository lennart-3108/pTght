const express = require('express');
const SlotService = require('../services/SlotService');
const { isAuthenticated } = require('../../middleware/auth');

module.exports = function slotGeneratorRoutes(ctx) {
  const router = express.Router();
  const knex = (ctx.knex && ctx.knex.client) ? ctx.knex : (ctx.db && ctx.db.knex ? ctx.db.knex : null);
  const slotService = new SlotService(knex);

  if (!knex) {
    router.use((req, res) => res.status(500).json({ error: 'DB_NOT_AVAILABLE' }));
    return router;
  }

  const requireAuth = isAuthenticated;

  // GET /slots/generate/preview
  // Params: asset_id, start_date, end_date, start_hour, end_hour, duration, interval, buffer_before, buffer_after
  router.get('/generate/preview', async (req, res) => {
    try {
      const { asset_id, start_date, end_date, start_hour = 8, end_hour = 22, duration = 60, interval = 60, buffer_before = 5, buffer_after = 5 } = req.query;
      if (!asset_id || !start_date || !end_date) {
        return res.status(400).json({ error: 'asset_id, start_date, end_date are required' });
      }
      const start = new Date(`${start_date}T${String(start_hour).padStart(2,'0')}:00:00`);
      const end = new Date(`${end_date}T${String(end_hour).padStart(2,'0')}:00:00`);
      const preview = [];
      let cursor = new Date(start);
      while (cursor < end) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor.getTime() + duration * 60 * 1000);
        preview.push({
          asset_id: parseInt(asset_id),
          start_time: slotStart.toISOString().slice(0,19).replace('T',' '),
          end_time: slotEnd.toISOString().slice(0,19).replace('T',' '),
          duration_minutes: duration,
          buffer_before: buffer_before,
          buffer_after: buffer_after,
          status: 'available',
          currency: 'EUR'
        });
        cursor = new Date(cursor.getTime() + interval * 60 * 1000);
      }
      return res.json({ preview, count: preview.length });
    } catch (err) {
      console.error('[GET /slots/generate/preview] error:', err);
      return res.status(500).json({ error: err.message || 'Failed to generate preview' });
    }
  });

  // POST /slots/generate
  router.post('/generate', requireAuth, async (req, res) => {
    try {
      const { asset_id, start_date, end_date, start_hour = 8, end_hour = 22, duration = 60, interval = 60, buffer_before = 5, buffer_after = 5, base_price = 0 } = req.body || {};
      if (!asset_id || !start_date || !end_date) {
        return res.status(400).json({ error: 'asset_id, start_date, end_date are required' });
      }
      const start = new Date(`${start_date}T${String(start_hour).padStart(2,'0')}:00:00`);
      const end = new Date(`${end_date}T${String(end_hour).padStart(2,'0')}:00:00`);

      // Build candidate slots and filter duplicates using DB check
      const candidates = [];
      let cursor = new Date(start);
      while (cursor < end) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor.getTime() + duration * 60 * 1000);
        candidates.push({
          asset_id: parseInt(asset_id),
          start_time: slotStart.toISOString().slice(0,19).replace('T',' '),
          end_time: slotEnd.toISOString().slice(0,19).replace('T',' '),
          duration_minutes: duration,
          buffer_before,
          buffer_after,
          status: 'available',
          currency: 'EUR',
          base_price,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        });
        cursor = new Date(cursor.getTime() + interval * 60 * 1000);
      }

      // Fetch existing slots keys to avoid duplicates
      const existing = await knex('slots')
        .where({ asset_id })
        .whereBetween('start_time', [candidates[0].start_time, candidates[candidates.length - 1].start_time])
        .select('start_time');
      const existingKeys = new Set(existing.map(s => s.start_time));
      const toInsert = candidates.filter(s => !existingKeys.has(s.start_time));

      if (toInsert.length === 0) {
        return res.status(200).json({ message: 'No new slots created (all slots already exist)', created: 0, total: candidates.length, skipped: candidates.length });
      }

      await knex('slots').insert(toInsert);
      return res.status(201).json({ message: 'Slots generated successfully', created: toInsert.length, total: candidates.length, skipped: candidates.length - toInsert.length });
    } catch (err) {
      console.error('[POST /slots/generate] error:', err);
      const msg = err.message || 'Failed to generate slots';
      const code = msg.includes('UNIQUE') ? 409 : 500;
      return res.status(code).json({ error: msg });
    }
  });

  // DELETE /slots/generate
  router.delete('/generate', requireAuth, async (req, res) => {
    try {
      const { asset_id, start_date, end_date } = req.body || {};
      if (!asset_id || !start_date || !end_date) {
        return res.status(400).json({ error: 'asset_id, start_date, end_date are required' });
      }
      const start = new Date(`${start_date}T00:00:00`);
      const end = new Date(`${end_date}T23:59:59`);

      let query = knex('slots').where({ asset_id }).whereBetween('start_time', [start, end]).andWhere('status', 'available');
      const deleted = await query.delete();
      return res.json({ message: 'Slots deleted successfully', deleted });
    } catch (err) {
      console.error('[DELETE /slots/generate] error:', err);
      return res.status(500).json({ error: err.message || 'Failed to delete slots' });
    }
  });

  return router;
};
