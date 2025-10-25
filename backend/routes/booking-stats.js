const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/booking-stats/overview
 * Get overall booking statistics
 */
router.get('/overview', async (req, res) => {
  try {
    const { locationId, startDate, endDate } = req.query;
    
    let query = db('bookings')
      .join('slots', 'bookings.slot_id', 'slots.id')
      .where('bookings.status', '!=', 'cancelled');

    if (locationId) {
      query = query.where('bookings.location_id', locationId);
    }
    if (startDate) {
      query = query.where('bookings.start_time', '>=', startDate);
    }
    if (endDate) {
      query = query.where('bookings.start_time', '<=', endDate);
    }

    const stats = await query
      .select(
        db.raw('COUNT(*) as total_bookings'),
        db.raw('SUM(slots.base_price) as total_revenue'),
        db.raw('AVG(slots.base_price) as average_booking_value')
      )
      .first();

    res.json(stats);
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: 'Failed to fetch overview statistics' });
  }
});

/**
 * GET /api/booking-stats/by-location
 * Get booking statistics grouped by location
 */
router.get('/by-location', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = db('bookings')
      .join('slots', 'bookings.slot_id', 'slots.id')
      .join('locations', 'bookings.location_id', 'locations.id')
      .where('bookings.status', '!=', 'cancelled');

    if (startDate) {
      query = query.where('bookings.start_time', '>=', startDate);
    }
    if (endDate) {
      query = query.where('bookings.start_time', '<=', endDate);
    }

    const stats = await query
      .groupBy('bookings.location_id', 'locations.name', 'locations.city')
      .select(
        'bookings.location_id',
        'locations.name as location_name',
        'locations.city',
        db.raw('COUNT(*) as booking_count'),
        db.raw('SUM(slots.base_price) as total_revenue')
      )
      .orderBy('booking_count', 'desc');

    res.json(stats);
  } catch (error) {
    console.error('Get location stats error:', error);
    res.status(500).json({ error: 'Failed to fetch location statistics' });
  }
});

/**
 * GET /api/booking-stats/by-asset
 * Get booking statistics grouped by asset
 */
router.get('/by-asset', async (req, res) => {
  try {
    const { locationId, startDate, endDate } = req.query;
    
    let query = db('bookings')
      .join('slots', 'bookings.slot_id', 'slots.id')
      .join('assets', 'bookings.asset_id', 'assets.id')
      .join('locations', 'bookings.location_id', 'locations.id')
      .where('bookings.status', '!=', 'cancelled');

    if (locationId) {
      query = query.where('bookings.location_id', locationId);
    }
    if (startDate) {
      query = query.where('bookings.start_time', '>=', startDate);
    }
    if (endDate) {
      query = query.where('bookings.start_time', '<=', endDate);
    }

    const stats = await query
      .groupBy('bookings.asset_id', 'assets.name', 'assets.asset_type', 'locations.name')
      .select(
        'bookings.asset_id',
        'assets.name as asset_name',
        'assets.asset_type',
        'locations.name as location_name',
        db.raw('COUNT(*) as booking_count'),
        db.raw('SUM(slots.base_price) as total_revenue'),
        db.raw('AVG(slots.base_price) as avg_price')
      )
      .orderBy('booking_count', 'desc');

    res.json(stats);
  } catch (error) {
    console.error('Get asset stats error:', error);
    res.status(500).json({ error: 'Failed to fetch asset statistics' });
  }
});

/**
 * GET /api/booking-stats/utilization
 * Calculate asset utilization rate
 */
router.get('/utilization', async (req, res) => {
  try {
    const { locationId, assetId, startDate, endDate } = req.query;
    
    // Get total available slots
    let totalSlotsQuery = db('slots')
      .where('slots.status', 'available')
      .orWhere('slots.status', 'booked');

    if (assetId) {
      totalSlotsQuery = totalSlotsQuery.where('slots.asset_id', assetId);
    }
    if (locationId) {
      totalSlotsQuery = totalSlotsQuery.where('slots.location_id', locationId);
    }
    if (startDate) {
      totalSlotsQuery = totalSlotsQuery.where('slots.start_time', '>=', startDate);
    }
    if (endDate) {
      totalSlotsQuery = totalSlotsQuery.where('slots.start_time', '<=', endDate);
    }

    const totalSlots = await totalSlotsQuery.count('* as count').first();

    // Get booked slots
    let bookedSlotsQuery = db('slots')
      .where('slots.status', 'booked');

    if (assetId) {
      bookedSlotsQuery = bookedSlotsQuery.where('slots.asset_id', assetId);
    }
    if (locationId) {
      bookedSlotsQuery = bookedSlotsQuery.where('slots.location_id', locationId);
    }
    if (startDate) {
      bookedSlotsQuery = bookedSlotsQuery.where('slots.start_time', '>=', startDate);
    }
    if (endDate) {
      bookedSlotsQuery = bookedSlotsQuery.where('slots.start_time', '<=', endDate);
    }

    const bookedSlots = await bookedSlotsQuery.count('* as count').first();

    const utilizationRate = totalSlots.count > 0 
      ? ((bookedSlots.count / totalSlots.count) * 100).toFixed(2)
      : 0;

    res.json({
      total_slots: totalSlots.count,
      booked_slots: bookedSlots.count,
      available_slots: totalSlots.count - bookedSlots.count,
      utilization_rate: parseFloat(utilizationRate)
    });
  } catch (error) {
    console.error('Get utilization error:', error);
    res.status(500).json({ error: 'Failed to calculate utilization' });
  }
});

/**
 * GET /api/booking-stats/monthly
 * Get monthly booking trends
 */
router.get('/monthly', async (req, res) => {
  try {
    const { locationId, year } = req.query;
    const targetYear = year || new Date().getFullYear();
    
    let query = db('bookings')
      .join('slots', 'bookings.slot_id', 'slots.id')
      .where('bookings.status', '!=', 'cancelled')
      .whereBetween('bookings.start_time', [
        `${targetYear}-01-01`,
        `${targetYear}-12-31 23:59:59`
      ]);

    if (locationId) {
      query = query.where('bookings.location_id', locationId);
    }

    const stats = await query
      .select(
        db.raw('STRFTIME("%m", bookings.start_time) as month'),
        db.raw('COUNT(*) as booking_count'),
        db.raw('SUM(slots.base_price) as revenue')
      )
      .groupBy(db.raw('STRFTIME("%m", bookings.start_time)'))
      .orderBy('month');

    // Fill in missing months with 0
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, '0');
      const found = stats.find(s => s.month === month);
      return {
        month: month,
        booking_count: found ? found.booking_count : 0,
        revenue: found ? found.revenue : 0
      };
    });

    res.json(monthlyData);
  } catch (error) {
    console.error('Get monthly stats error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly statistics' });
  }
});

module.exports = router;
