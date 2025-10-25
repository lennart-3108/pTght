/**
 * Slot Routes
 * API endpoints for slot management
 */

const express = require('express');
const { isAuthenticated } = require('../../middleware/auth');
const SlotService = require('../services/SlotService');

function resolveKnex(db) {
  if (db?.client && typeof db.raw === "function") return db;
  if (db?.knex?.client) return db.knex;
  try { return require("../../db"); } catch { /* no-op */ }
  throw new Error("No knex instance available");
}

module.exports = function slotRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;
  const knex = resolveKnex(db);
  const slotService = new SlotService(knex);

  /**
   * GET /slots - Search slots
   */
  router.get('/', async (req, res) => {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        city: req.query.city,
        sport_id: req.query.sport_id,
        min_price: req.query.min_price,
        max_price: req.query.max_price,
        indoor: req.query.indoor === 'true' ? true : req.query.indoor === 'false' ? false : undefined,
        surface: req.query.surface,
        latitude: req.query.lat,
        longitude: req.query.lng,
        radius_km: req.query.radius,
      };

      const slots = await slotService.searchSlots(filters);
      return res.json(slots);
    } catch (error) {
      console.error('[GET /slots] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch slots' });
    }
  });

  /**
   * GET /slots/search - Search available slots by date, time, duration and filters
   * Query params: 
   * - datetime (ISO or 'YYYY-MM-DDTHH:MM:SS')
   * - duration (minutes, default 60)
   * - city (optional)
   * - sport_id (optional)
   */
  router.get('/search', async (req, res) => {
    try {
      const { datetime, duration, city, sport_id } = req.query;
      
      if (!datetime) {
        return res.status(400).json({ error: 'datetime parameter is required' });
      }

      const requestedDuration = parseInt(duration) || 60;
      const targetDateTime = new Date(datetime);
      
      if (isNaN(targetDateTime.getTime())) {
        return res.status(400).json({ error: 'Invalid datetime format' });
      }

      // Extract date for querying
      const dateStr = targetDateTime.toISOString().split('T')[0];

      // Search for available slots
      let query = knex('slots')
        .join('assets', 'slots.asset_id', 'assets.id')
        .join('locations', 'assets.location_id', 'locations.id')
        .select(
          'slots.id',
          'slots.start_time',
          'slots.end_time',
          'slots.duration_minutes',
          'slots.base_price',
          'slots.currency',
          'slots.status',
          'assets.id as asset_id',
          'assets.name as asset_name',
          'assets.type as asset_type',
          'assets.surface',
          'assets.indoor',
          'assets.supported_sports',
          'locations.id as location_id',
          'locations.name as location_name',
          'locations.city',
          'locations.address'
        )
        .where('slots.status', 'available')
        .where('slots.duration_minutes', '>=', requestedDuration)
        .whereRaw('DATE(slots.start_time) = ?', [dateStr]);

      // Filter by city
      if (city) {
        query = query.where('locations.city', city);
      }

      // Filter by sport_id
      if (sport_id) {
        query = query.whereRaw(`json_extract(assets.supported_sports, '$') LIKE ?`, [`%"${sport_id}"%`]);
      }

      const slots = await query
        .orderBy('slots.start_time', 'asc')
        .limit(50);

      // Return empty array if no slots found (200 OK, not 404)
      if (slots.length === 0) {
        return res.json([]);
      }

      // Format results
      const formattedSlots = slots.map(slot => {
        // Get first sport from supported_sports
        let sportName = null;
        try {
          const sports = slot.supported_sports ? JSON.parse(slot.supported_sports) : [];
          if (sports.length > 0) {
            // Sports are stored as IDs, we'd need to look them up
            // For now, just indicate if sports are supported
            sportName = sports.length > 0 ? 'Sport verfügbar' : null;
          }
        } catch (e) {
          // Ignore parse errors
        }

        return {
          id: slot.id,
          location_id: slot.location_id,
          location_name: slot.location_name,
          asset_id: slot.asset_id,
          asset_name: slot.asset_name,
          asset_type: slot.asset_type,
          surface: slot.surface,
          indoor: slot.indoor,
          sport_name: sportName,
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_minutes: slot.duration_minutes,
          base_price: parseFloat(slot.base_price || 0),
          currency: slot.currency || 'EUR',
          city: slot.city,
          address: slot.address,
          status: slot.status
        };
      });

      return res.json(formattedSlots);
    } catch (error) {
      console.error('[GET /slots/search] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to search slots' });
    }
  });

  /**
   * GET /slots/:id - Get slot by ID
```  /**
   * GET /slots/:id - Get slot by ID
   */
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const slot = await slotService.getSlotById(parseInt(id));
      
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }
      
      return res.json(slot);
    } catch (error) {
      console.error(`[GET /slots/${req.params.id}] error:`, error);
      return res.status(500).json({ error: error.message || 'Failed to fetch slot' });
    }
  });

  /**
   * GET /slots/asset/:assetId - Get available slots for an asset
   */
  router.get('/asset/:assetId', async (req, res) => {
    try {
      const { assetId } = req.params;
      const { start_date, end_date, sport_id, visibility } = req.query;
      
      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }
      
      const filters = { sport_id, visibility };
      const slots = await slotService.getAvailableSlots(
        parseInt(assetId),
        start_date,
        end_date,
        filters
      );
      
      return res.json(slots);
    } catch (error) {
      console.error(`[GET /slots/asset/${req.params.assetId}] error:`, error);
      return res.status(500).json({ error: error.message || 'Failed to fetch slots' });
    }
  });

  /**
   * POST /slots - Create new slot
   */
  router.post('/', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const { asset_id, ...slotData } = req.body;
      
      if (!asset_id) {
        return res.status(400).json({ error: 'asset_id is required' });
      }
      
      const slot = await slotService.createSlot(asset_id, userId, slotData);
      return res.status(201).json(slot);
    } catch (error) {
      console.error('[POST /slots] error:', error);
      const status = error.message.includes('required') || 
                     error.message.includes('Invalid') ||
                     error.message.includes('overlap') ? 400 :
                     error.message.includes('not found') || error.message.includes('access denied') ? 404 : 500;
      return res.status(status).json({ error: error.message || 'Failed to create slot' });
    }
  });

  /**
   * PUT /slots/:id - Update slot
   */
  router.put('/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const slot = await slotService.updateSlot(parseInt(id), userId, req.body);
      return res.json(slot);
    } catch (error) {
      console.error(`[PUT /slots/${req.params.id}] error:`, error);
      const status = error.message.includes('not found') || error.message.includes('access denied') ? 404 :
                     error.message.includes('booked') || error.message.includes('held') || 
                     error.message.includes('Invalid') || error.message.includes('overlap') ? 400 : 500;
      return res.status(status).json({ error: error.message || 'Failed to update slot' });
    }
  });

  /**
   * DELETE /slots/:id - Delete slot
   */
  router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const result = await slotService.deleteSlot(parseInt(id), userId);
      return res.json(result);
    } catch (error) {
      console.error(`[DELETE /slots/${req.params.id}] error:`, error);
      const status = error.message.includes('not found') || error.message.includes('access denied') ? 404 :
                     error.message.includes('booked') || error.message.includes('held') ? 409 : 500;
      return res.status(status).json({ error: error.message || 'Failed to delete slot' });
    }
  });

  /**
   * POST /slots/:id/block - Block a slot
   */
  router.post('/:id/block', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;
      
      const slot = await slotService.blockSlot(parseInt(id), userId, reason);
      return res.json(slot);
    } catch (error) {
      console.error(`[POST /slots/${req.params.id}/block] error:`, error);
      const status = error.message.includes('not found') || error.message.includes('access denied') ? 404 :
                     error.message.includes('booked') ? 400 : 500;
      return res.status(status).json({ error: error.message || 'Failed to block slot' });
    }
  });

  return router;
};
