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
   * GET /slots/search - Search available time slots dynamically
   * Calculates availability based on assets and existing bookings
   * Also includes slots available for resale
   * Query params: 
   * - datetime (ISO or 'YYYY-MM-DDTHH:MM:SS')
   * - duration (minutes, default 60)
   * - city (optional)
   * - sport_id (optional)
   */
  router.get('/search', async (req, res) => {
    try {
      console.log('[GET /slots/search] Request received:', req.query);
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
      const targetDate = new Date(dateStr);

      console.log('[GET /slots/search] Searching for date:', dateStr, 'city:', city);

      // Find matching assets
      let assetsQuery = knex('assets')
        .join('locations', 'assets.location_id', 'locations.id')
        .select(
          'assets.id as asset_id',
          'assets.name as asset_name',
          'assets.type as asset_type',
          'assets.surface',
          'assets.slot_duration',
          'assets.supported_sports',
          'locations.id as location_id',
          'locations.name as location_name',
          'locations.city',
          'locations.address'
        )
        .where('assets.status', 'active');

      // Filter by city
      if (city) {
        assetsQuery = assetsQuery.where('locations.city', city);
      }

      // Filter by sport_id
      if (sport_id) {
        assetsQuery = assetsQuery.where(function() {
          this.whereRaw(`json_extract(assets.supported_sports, '$') LIKE ?`, [`%"${sport_id}"%`])
            .orWhereNull('assets.supported_sports');
        });
      }

      const assets = await assetsQuery;
      console.log('[GET /slots/search] Found assets:', assets.length);

      if (assets.length === 0) {
        return res.json([]);
      }

      // Get all bookings for these assets on this date
      const assetIds = assets.map(a => a.asset_id);
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const bookings = await knex('bookings')
        .whereIn('asset_id', assetIds)
        .where('start_time', '>=', dayStart.toISOString())
        .where('start_time', '<=', dayEnd.toISOString())
        .whereNull('resold_at')
        .select('id', 'asset_id', 'start_time', 'end_time', 'available_for_resale');

      // Also fetch resale bookings separately
      const resaleBookings = bookings.filter(b => b.available_for_resale);

      // Generate available time slots for each asset
      const availableSlots = [];
      const openHour = 8;  // Opening time
      const closeHour = 22; // Closing time

      for (const asset of assets) {
        const baseSlotDuration = 30; // Base slot duration is always 30 minutes
        const assetBookings = bookings.filter(b => b.asset_id === asset.asset_id && !b.available_for_resale);

        // Generate all possible 30-min base slots for the day (8:00-22:00)
        const baseSlots = [];
        for (let hour = openHour; hour < closeHour; hour++) {
          for (let minute = 0; minute < 60; minute += baseSlotDuration) {
            const slotStart = new Date(targetDate);
            slotStart.setHours(hour, minute, 0, 0);
            
            const slotEnd = new Date(slotStart);
            slotEnd.setMinutes(slotEnd.getMinutes() + baseSlotDuration);

            // Don't create slots that end after closing
            if (slotEnd.getHours() > closeHour || (slotEnd.getHours() === closeHour && slotEnd.getMinutes() > 0)) {
              continue;
            }

            // Check if slot is already booked
            const isBooked = assetBookings.some(booking => {
              const bookingStart = new Date(booking.start_time);
              const bookingEnd = new Date(booking.end_time);
              // Check for overlap
              return (slotStart < bookingEnd && slotEnd > bookingStart);
            });

            baseSlots.push({
              start: slotStart,
              end: slotEnd,
              available: !isBooked
            });
          }
        }

        // Now combine consecutive available base slots to match requested duration
        // requestedDuration must be a multiple of 30
        const slotsNeeded = Math.ceil(requestedDuration / baseSlotDuration);
        
        for (let i = 0; i <= baseSlots.length - slotsNeeded; i++) {
          // Check if we have slotsNeeded consecutive available slots
          let allAvailable = true;
          for (let j = 0; j < slotsNeeded; j++) {
            if (!baseSlots[i + j] || !baseSlots[i + j].available) {
              allAvailable = false;
              break;
            }
            // Also check continuity (end of one slot = start of next)
            if (j > 0 && baseSlots[i + j - 1].end.getTime() !== baseSlots[i + j].start.getTime()) {
              allAvailable = false;
              break;
            }
          }

          if (allAvailable) {
            const combinedSlotStart = baseSlots[i].start;
            const combinedSlotEnd = baseSlots[i + slotsNeeded - 1].end;
            
            availableSlots.push({
              id: null,
              booking_id: null,
              is_resale: false,
              location_id: asset.location_id,
              location_name: asset.location_name,
              asset_id: asset.asset_id,
              asset_name: asset.asset_name,
              asset_type: asset.asset_type,
              surface: asset.surface,
              sport_name: null,
              start_time: combinedSlotStart.toISOString(),
              end_time: combinedSlotEnd.toISOString(),
              duration_minutes: requestedDuration,
              base_price: 25.0, // Default price per hour (will be adjusted by duration)
              currency: 'EUR',
              city: asset.city,
              address: asset.address,
              status: 'available'
            });
          }
        }
      }

      // Add resale slots
      const resaleSlots = resaleBookings.map(booking => {
        const asset = assets.find(a => a.asset_id === booking.asset_id);
        if (!asset) return null;

        const startTime = new Date(booking.start_time);
        const endTime = new Date(booking.end_time);
        const duration = Math.floor((endTime - startTime) / (1000 * 60));

        return {
          id: null,
          booking_id: booking.id,
          is_resale: true,
          location_id: asset.location_id,
          location_name: asset.location_name,
          asset_id: asset.asset_id,
          asset_name: asset.asset_name,
          asset_type: asset.asset_type,
          surface: asset.surface,
          sport_name: null,
          start_time: booking.start_time,
          end_time: booking.end_time,
          duration_minutes: duration,
          base_price: 25.0,
          currency: 'EUR',
          city: asset.city,
          address: asset.address,
          status: 'resale'
        };
      }).filter(Boolean);

      // Combine and sort by start_time
      const allSlots = [...availableSlots, ...resaleSlots].sort((a, b) => 
        new Date(a.start_time) - new Date(b.start_time)
      );

      return res.json(allSlots.slice(0, 50)); // Limit to 50 results
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
