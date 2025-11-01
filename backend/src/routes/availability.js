const express = require('express');
const router = express.Router();

// GET /locations/availability - Find locations with available slots
router.get('/locations/availability', async (req, res) => {
  try {
    const { sport_id, city_id, datetime, duration = 60 } = req.query;
    
    if (!sport_id || !city_id || !datetime) {
      return res.status(400).json({ error: 'sport_id, city_id, and datetime are required' });
    }

    const db = req.app.get('db');
    const knex = db.knex;

    // Get city name
    const city = await knex('cities').where({ id: city_id }).first();
    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    // Find all locations in this city
    const locations = await knex('locations')
      .where({ city: city.name, status: 'active' })
      .select('*');

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

    res.json(results);
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ error: 'Failed to check availability', details: error.message });
  }
});

module.exports = router;
