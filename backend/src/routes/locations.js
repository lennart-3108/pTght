/**
 * Location Routes
 * API endpoints for location management
 */

const express = require('express');
const { isAuthenticated } = require('../../middleware/auth');
const LocationService = require('../services/LocationService');

function resolveKnex(db) {
  if (db?.client && typeof db.raw === "function") return db;
  if (db?.knex?.client) return db.knex;
  try { return require("../../db"); } catch { /* no-op */ }
  throw new Error("No knex instance available");
}

module.exports = function locationRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;
  const knex = resolveKnex(db);
  const locationService = new LocationService(knex);

  /**
   * GET /locations/availability - Find locations with available slots (must be before /:id)
   */
  router.get('/availability', async (req, res) => {
    try {
      const { sport_id, city_id, datetime, duration = 60 } = req.query;
      
      if (!sport_id || !city_id || !datetime) {
        return res.status(400).json({ error: 'sport_id, city_id, and datetime are required' });
      }

      // Get city name
      const city = await knex('cities').where({ id: parseInt(city_id) }).first();
      console.log('[availability] city lookup result:', city);
      if (!city) {
        return res.status(404).json({ error: 'City not found' });
      }

      // Find all locations in this city
      const locations = await knex('locations')
        .where({ city: city.name, status: 'active' })
        .select('*');

      console.log(`[availability] Found ${locations.length} locations in ${city.name}`);

      const results = [];

      for (const location of locations) {
        // Get assets at this location that support the selected sport
        const assets = await knex('assets')
          .where({ location_id: location.id, status: 'active' })
          .select('*');

        // Filter assets that support the sport
        const suitableAssets = assets.filter(asset => {
          if (!asset.supported_sports) return false;
          const sports = typeof asset.supported_sports === 'string' 
            ? JSON.parse(asset.supported_sports) 
            : asset.supported_sports;
          return Array.isArray(sports) && sports.includes(parseInt(sport_id));
        });

        if (suitableAssets.length === 0) continue;

        // Check availability for each asset
        const requestDate = new Date(datetime);
        const endDate = new Date(requestDate.getTime() + duration * 60000);

        let availableCount = 0;
        let hourlyRate = null;

        for (const asset of suitableAssets) {
          // Check if asset has pricing
          const pricing = await knex('pricing')
            .where({ asset_id: asset.id })
            .first();

          if (pricing && hourlyRate === null) {
            hourlyRate = pricing.hourly_rate || pricing.base_price;
          }

          // Check for conflicting bookings
          const conflicts = await knex('bookings')
            .where({ asset_id: asset.id })
            .where(function() {
              this.where(function() {
                this.where('start_datetime', '<=', datetime)
                  .where('end_datetime', '>', datetime);
              }).orWhere(function() {
                this.where('start_datetime', '<', endDate.toISOString())
                  .where('end_datetime', '>=', endDate.toISOString());
              }).orWhere(function() {
                this.where('start_datetime', '>=', datetime)
                  .where('end_datetime', '<=', endDate.toISOString());
              });
            })
            .whereIn('status', ['confirmed', 'pending'])
            .count('* as count')
            .first();

          if (!conflicts || conflicts.count === 0) {
            availableCount++;
          }
        }

        if (availableCount > 0) {
          results.push({
            ...location,
            available_slots: availableCount,
            hourly_rate: hourlyRate,
            total_assets: suitableAssets.length
          });
        }
      }

      return res.json(results);
    } catch (error) {
      console.error('[availability] error:', error);
      return res.status(500).json({ error: 'Failed to check availability', details: error.message });
    }
  });

  /**
   * GET /locations - Search/list locations
   */
  router.get('/', async (req, res) => {
    try {
      const filters = {
        city: req.query.city,
        country: req.query.country,
        latitude: req.query.lat,
        longitude: req.query.lng,
        radius_km: req.query.radius,
      };

      const locations = await locationService.searchLocations(filters);
      return res.json(locations);
    } catch (error) {
      console.error('[GET /locations] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch locations' });
    }
  });

  /**
   * GET /locations/cities - Get list of unique cities
   */
  router.get('/cities', async (req, res) => {
    try {
      const cities = await knex('locations')
        .distinct('city')
        .whereNotNull('city')
        .where('city', '!=', '')
        .where('status', 'active')
        .orderBy('city', 'asc')
        .pluck('city');
      
      return res.json(cities);
    } catch (error) {
      console.error('[GET /locations/cities] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch cities' });
    }
  });

  /**
   * GET /locations/:id - Get location by ID
   */
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const includeAssets = req.query.include_assets === 'true';
      
      const location = await locationService.getLocationById(parseInt(id), includeAssets);
      
      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }
      
      return res.json(location);
    } catch (error) {
      console.error(`[GET /locations/${req.params.id}] error:`, error);
      return res.status(500).json({ error: error.message || 'Failed to fetch location' });
    }
  });

  /**
   * GET /locations/owner/me - Get current user's locations
   */
  router.get('/owner/me', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const locations = await locationService.getLocationsByOwner(userId);
      return res.json(locations);
    } catch (error) {
      console.error('[GET /locations/owner/me] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch locations' });
    }
  });

  /**
   * POST /locations - Create new location
   */
  router.post('/', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const location = await locationService.createLocation(userId, req.body);
      return res.status(201).json(location);
    } catch (error) {
      console.error('[POST /locations] error:', error);
      const status = error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500;
      return res.status(status).json({ error: error.message || 'Failed to create location' });
    }
  });

  /**
   * PUT /locations/:id - Update location
   */
  router.put('/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const location = await locationService.updateLocation(parseInt(id), userId, req.body);
      return res.json(location);
    } catch (error) {
      console.error(`[PUT /locations/${req.params.id}] error:`, error);
      const status = error.message.includes('not found') || error.message.includes('access denied') ? 404 : 
                     error.message.includes('Invalid') ? 400 : 500;
      return res.status(status).json({ error: error.message || 'Failed to update location' });
    }
  });

  /**
   * DELETE /locations/:id - Delete location (soft delete)
   */
  router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const result = await locationService.deleteLocation(parseInt(id), userId);
      return res.json(result);
    } catch (error) {
      console.error(`[DELETE /locations/${req.params.id}] error:`, error);
      const status = error.message.includes('not found') || error.message.includes('access denied') ? 404 :
                     error.message.includes('active bookings') ? 409 : 500;
      return res.status(status).json({ error: error.message || 'Failed to delete location' });
    }
  });

  return router;
};
