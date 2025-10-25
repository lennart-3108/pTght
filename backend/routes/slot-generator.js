const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * Generate slots for an asset based on its booking rules
 * POST /api/slots/generate
 * Body: { assetId, startDate, endDate, operatingHours }
 */
router.post('/generate', authenticateToken, async (req, res) => {
  const { assetId, startDate, endDate, operatingHours } = req.body;

  if (!assetId || !startDate || !endDate) {
    return res.status(400).json({ 
      error: 'assetId, startDate, and endDate are required' 
    });
  }

  try {
    // Get asset with booking rules
    const asset = await db('assets')
      .where('id', assetId)
      .first();

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Verify user owns the location
    const location = await db('locations')
      .where('id', asset.location_id)
      .first();

    if (location.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to generate slots for this asset' });
    }

    // Default operating hours if not provided
    const defaultHours = operatingHours || {
      monday: { open: '08:00', close: '22:00' },
      tuesday: { open: '08:00', close: '22:00' },
      wednesday: { open: '08:00', close: '22:00' },
      thursday: { open: '08:00', close: '22:00' },
      friday: { open: '08:00', close: '22:00' },
      saturday: { open: '09:00', close: '21:00' },
      sunday: { open: '09:00', close: '20:00' }
    };

    const minDuration = asset.min_booking_duration || 60;
    const maxDuration = asset.max_booking_duration || 120;
    const interval = asset.slot_interval || 15;
    const basePrice = 25.00; // Default price, can be customized per asset

    const slots = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate slots for each day
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
      const hours = defaultHours[dayName];

      if (!hours || !hours.open) continue; // Skip if location is closed

      const [openHour, openMin] = hours.open.split(':').map(Number);
      const [closeHour, closeMin] = hours.close.split(':').map(Number);

      const dayStart = new Date(date);
      dayStart.setHours(openHour, openMin, 0, 0);

      const dayEnd = new Date(date);
      dayEnd.setHours(closeHour, closeMin, 0, 0);

      // Generate slots with different durations
      let currentTime = new Date(dayStart);

      while (currentTime < dayEnd) {
        // Generate slots for min and max duration
        for (const duration of [minDuration, maxDuration]) {
          const slotEnd = new Date(currentTime);
          slotEnd.setMinutes(slotEnd.getMinutes() + duration);

          // Only create slot if it fits within operating hours
          if (slotEnd <= dayEnd) {
            const price = duration === minDuration ? basePrice : basePrice * (duration / minDuration);
            
            slots.push({
              asset_id: assetId,
              location_id: asset.location_id,
              start_time: currentTime.toISOString().replace('T', ' ').substring(0, 19),
              end_time: slotEnd.toISOString().replace('T', ' ').substring(0, 19),
              duration_minutes: duration,
              base_price: Math.round(price * 100) / 100,
              currency: 'EUR',
              status: 'available'
            });
          }
        }

        // Move to next interval
        currentTime.setMinutes(currentTime.getMinutes() + interval);
      }
    }

    // Check for existing slots to avoid duplicates
    const existingSlots = await db('slots')
      .where('asset_id', assetId)
      .whereBetween('start_time', [
        start.toISOString().replace('T', ' ').substring(0, 19),
        end.toISOString().replace('T', ' ').substring(0, 19)
      ])
      .select('start_time', 'end_time');

    const existingSet = new Set(
      existingSlots.map(s => `${s.start_time}|${s.end_time}`)
    );

    const newSlots = slots.filter(
      s => !existingSet.has(`${s.start_time}|${s.end_time}`)
    );

    if (newSlots.length === 0) {
      return res.json({
        message: 'No new slots created (all slots already exist)',
        created: 0,
        total: slots.length
      });
    }

    // Batch insert new slots
    await db('slots').insert(newSlots);

    res.json({
      message: 'Slots generated successfully',
      created: newSlots.length,
      total: slots.length,
      skipped: slots.length - newSlots.length
    });

  } catch (err) {
    console.error('Error generating slots:', err);
    res.status(500).json({ error: 'Failed to generate slots', details: err.message });
  }
});

/**
 * Get available slots for booking
 * GET /api/slots/available?assetId=1&date=2025-10-25&duration=60
 */
router.get('/available', async (req, res) => {
  const { assetId, date, duration } = req.query;

  if (!assetId || !date) {
    return res.status(400).json({ error: 'assetId and date are required' });
  }

  try {
    const durationMin = parseInt(duration) || 60;
    
    // Get all available slots for the date
    const slots = await db('slots')
      .join('assets', 'slots.asset_id', 'assets.id')
      .join('locations', 'assets.location_id', 'locations.id')
      .where('slots.asset_id', assetId)
      .where('slots.status', 'available')
      .whereRaw('date(slots.start_time) = ?', [date])
      .where('slots.duration_minutes', '>=', durationMin)
      .select(
        'slots.*',
        'assets.name as asset_name',
        'assets.type as asset_type',
        'locations.name as location_name'
      )
      .orderBy('slots.start_time');

    res.json(slots);

  } catch (err) {
    console.error('Error fetching available slots:', err);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

/**
 * Delete slots for an asset (for cleaning up)
 * DELETE /api/slots/asset/:assetId
 */
router.delete('/asset/:assetId', authenticateToken, async (req, res) => {
  const { assetId } = req.params;
  const { startDate, endDate } = req.query;

  try {
    // Get asset and verify ownership
    const asset = await db('assets')
      .where('id', assetId)
      .first();

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const location = await db('locations')
      .where('id', asset.location_id)
      .first();

    if (location.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let query = db('slots')
      .where('asset_id', assetId)
      .where('status', 'available'); // Only delete available slots

    if (startDate && endDate) {
      query = query.whereBetween('start_time', [startDate, endDate]);
    }

    const deleted = await query.delete();

    res.json({ 
      message: 'Slots deleted successfully',
      deleted 
    });

  } catch (err) {
    console.error('Error deleting slots:', err);
    res.status(500).json({ error: 'Failed to delete slots' });
  }
});

module.exports = router;
