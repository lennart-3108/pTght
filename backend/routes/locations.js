const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');

console.log('DEBUG locations.js: authenticateToken=', typeof authenticateToken, ', optionalAuth=', typeof optionalAuth);

/**
 * Location & Booking Routes
 * 
 * Provides endpoints for:
 * - Listing and searching locations
 * - Managing assets (courts, fields)
 * - Querying available slots
 * - Creating and managing bookings
 */

module.exports = (db) => {
  
  // GET /api/locations/my-locations - Get locations owned by current user (must be before /:id)
  router.get('/my-locations', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      
      const locations = await db('locations')
        .where({ owner_id: userId })
        .orderBy('name');
      
      res.json(locations);
    } catch (err) {
      console.error('GET /my-locations error:', err);
      res.status(500).json({ error: 'Failed to fetch user locations' });
    }
  });
  
  // GET /api/locations - List all active locations
  router.get('/', optionalAuth, async (req, res) => {
    try {
      const { city, sport_id, search, status = 'active' } = req.query;
      
      let query = db('locations')
        .select('locations.*')
        .where('locations.status', status)
        .orderBy('locations.name');
      
      // Filter by city
      if (city) {
        query = query.where('locations.city', city);
      }
      
      // Search by name
      if (search) {
        query = query.where('locations.name', 'like', `%${search}%`);
      }
      
      // Filter by sport (via assets)
      if (sport_id) {
        query = query
          .join('assets', 'locations.id', 'assets.location_id')
          .whereRaw(`JSON_SEARCH(assets.supported_sports, 'one', ?) IS NOT NULL`, [sport_id])
          .distinct();
      }
      
      const locations = await query;
      res.json(locations);
    } catch (err) {
      console.error('GET /locations error:', err);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  });
  
  // GET /api/locations/:id - Get single location with details
  router.get('/:id', optionalAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const location = await db('locations')
        .where({ id })
        .first();
      
      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }
      
      // Get assets for this location
      const assets = await db('assets')
        .where({ location_id: id, status: 'active' })
        .orderBy('display_order');
      
      location.assets = assets;
      res.json(location);
    } catch (err) {
      console.error('GET /locations/:id error:', err);
      res.status(500).json({ error: 'Failed to fetch location' });
    }
  });
  
  // GET /api/locations/:id/assets - Get assets for a location
  router.get('/:id/assets', optionalAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { sport_id, type, indoor } = req.query;
      
      let query = db('assets')
        .where({ location_id: id, status: 'active' })
        .orderBy('display_order');
      
      // Filter by sport
      if (sport_id) {
        query = query.whereRaw(
          `JSON_SEARCH(supported_sports, 'one', ?) IS NOT NULL`,
          [sport_id]
        );
      }
      
      // Filter by type
      if (type) {
        query = query.where({ type });
      }
      
      // Filter by indoor/outdoor
      if (indoor !== undefined) {
        query = query.where({ indoor: indoor === 'true' });
      }
      
      const assets = await query;
      res.json(assets);
    } catch (err) {
      console.error('GET /locations/:id/assets error:', err);
      res.status(500).json({ error: 'Failed to fetch assets' });
    }
  });
  
  // GET /api/assets/:id/slots - Get available slots for an asset
  router.get('/assets/:id/slots', optionalAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { date, duration = 60, sport_id } = req.query;
      
      if (!date) {
        return res.status(400).json({ error: 'date parameter required (YYYY-MM-DD)' });
      }
      
      // Parse date range for the requested day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      let query = db('slots')
        .where({ asset_id: id })
        .whereBetween('start_time', [startOfDay.toISOString(), endOfDay.toISOString()])
        .whereIn('status', ['available', 'held']) // show held slots too (might expire)
        .orderBy('start_time');
      
      // Filter by sport if specified
      if (sport_id) {
        query = query.where(function() {
          this.where({ sport_id }).orWhereNull('sport_id');
        });
      }
      
      // Filter by duration (allow +/- 30 min flexibility)
      const minDuration = Number(duration) - 30;
      const maxDuration = Number(duration) + 30;
      query = query.whereBetween('duration_minutes', [minDuration, maxDuration]);
      
      const slots = await query;
      
      // Check if held slots have expired and mark them available
      const now = new Date();
      const availableSlots = slots.map(slot => {
        if (slot.status === 'held' && slot.held_expires_at && new Date(slot.held_expires_at) < now) {
          slot.status = 'available';
          slot.held_by_user_id = null;
          slot.held_at = null;
          slot.held_expires_at = null;
        }
        return slot;
      });
      
      res.json(availableSlots);
    } catch (err) {
      console.error('GET /assets/:id/slots error:', err);
      res.status(500).json({ error: 'Failed to fetch slots' });
    }
  });
  
  // POST /api/bookings - Create a new booking
  router.post('/bookings', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        slot_id,
        location_id,
        asset_id,
        duration_minutes,
        match_id,
        team_id,
        league_id,
        user_notes,
        idempotency_key
      } = req.body;
      
      if (!slot_id || !location_id || !asset_id) {
        return res.status(400).json({ error: 'slot_id, location_id, and asset_id required' });
      }
      
      // Check idempotency
      if (idempotency_key) {
        const existing = await db('bookings')
          .where({ idempotency_key })
          .first();
        
        if (existing) {
          return res.json(existing); // Return existing booking
        }
      }
      
      // Get slot details
      const slot = await db('slots')
        .where({ id: slot_id })
        .first();
      
      if (!slot) {
        return res.status(404).json({ error: 'Slot not found' });
      }
      
      // Check if slot is available
      if (slot.status !== 'available') {
        return res.status(409).json({ error: 'Slot is not available' });
      }
      
      // Check if slot is in the past
      if (new Date(slot.start_time) < new Date()) {
        return res.status(400).json({ error: 'Cannot book slots in the past' });
      }
      
      // Start transaction
      const trx = await db.transaction();
      
      try {
        // Place hold on slot (10 minute TTL)
        const heldExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        await trx('slots')
          .where({ id: slot_id, status: 'available' })
          .update({
            status: 'held',
            held_at: new Date(),
            held_expires_at: heldExpiresAt,
            held_by_user_id: userId
          });
        
        // Create booking record
        const [bookingId] = await trx('bookings').insert({
          slot_id,
          location_id,
          asset_id,
          user_id: userId,
          match_id: match_id || null,
          team_id: team_id || null,
          league_id: league_id || null,
          status: 'held',
          start_time: slot.start_time,
          end_time: slot.end_time,
          duration_minutes: slot.duration_minutes,
          price: slot.base_price,
          currency: slot.currency || 'EUR',
          platform_fee: 0, // TODO: calculate platform fee
          owner_payout: slot.base_price, // TODO: calculate after fee
          user_notes: user_notes || null,
          idempotency_key: idempotency_key || `booking_${Date.now()}_${userId}`,
          created_at: new Date(),
          updated_at: new Date()
        });
        
        // Link booking back to slot
        await trx('slots')
          .where({ id: slot_id })
          .update({ booking_id: bookingId });
        
        await trx.commit();
        
        // Fetch created booking
        const booking = await db('bookings')
          .where({ id: bookingId })
          .first();
        
        res.status(201).json(booking);
        
      } catch (err) {
        await trx.rollback();
        throw err;
      }
      
    } catch (err) {
      console.error('POST /bookings error:', err);
      res.status(500).json({ error: err.message || 'Failed to create booking' });
    }
  });
  
  // GET /api/bookings - Get user's bookings
  router.get('/bookings', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, future_only } = req.query;
      
      let query = db('bookings')
        .select(
          'bookings.*',
          'locations.name as location_name',
          'assets.name as asset_name'
        )
        .join('locations', 'bookings.location_id', 'locations.id')
        .join('assets', 'bookings.asset_id', 'assets.id')
        .where({ 'bookings.user_id': userId })
        .orderBy('bookings.start_time', 'desc');
      
      if (status) {
        query = query.where({ 'bookings.status': status });
      }
      
      if (future_only === 'true') {
        query = query.where('bookings.start_time', '>=', new Date());
      }
      
      const bookings = await query;
      res.json(bookings);
    } catch (err) {
      console.error('GET /bookings error:', err);
      res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  });
  
  // GET /api/bookings/:id - Get single booking
  router.get('/bookings/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const booking = await db('bookings')
        .select(
          'bookings.*',
          'locations.name as location_name',
          'locations.address as location_address',
          'locations.city as location_city',
          'assets.name as asset_name',
          'assets.type as asset_type'
        )
        .join('locations', 'bookings.location_id', 'locations.id')
        .join('assets', 'bookings.asset_id', 'assets.id')
        .where({ 'bookings.id': id })
        .first();
      
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      
      // Check ownership (or admin)
      if (booking.user_id !== userId && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      res.json(booking);
    } catch (err) {
      console.error('GET /bookings/:id error:', err);
      res.status(500).json({ error: 'Failed to fetch booking' });
    }
  });
  
  // PATCH /api/bookings/:id - Update booking (confirm payment, cancel, etc.)
  router.patch('/bookings/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { status, cancellation_reason, payment_intent_id } = req.body;
      
      // Get booking
      const booking = await db('bookings')
        .where({ id })
        .first();
      
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      
      // Check ownership
      if (booking.user_id !== userId && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const updates = { updated_at: new Date() };
      
      // Handle status transitions
      if (status) {
        if (status === 'cancelled') {
          updates.status = 'cancelled';
          updates.cancelled_at = new Date();
          if (cancellation_reason) {
            updates.cancellation_reason = cancellation_reason;
          }
          
          // Release the slot
          await db('slots')
            .where({ id: booking.slot_id })
            .update({
              status: 'available',
              booking_id: null,
              held_at: null,
              held_expires_at: null,
              held_by_user_id: null
            });
        } else if (status === 'paid') {
          updates.status = 'paid';
          updates.paid_at = new Date();
          if (payment_intent_id) {
            updates.payment_intent_id = payment_intent_id;
          }
          
          // Mark slot as booked
          await db('slots')
            .where({ id: booking.slot_id })
            .update({ status: 'booked' });
        } else {
          updates.status = status;
        }
      }
      
      await db('bookings')
        .where({ id })
        .update(updates);
      
      // Fetch updated booking
      const updated = await db('bookings')
        .where({ id })
        .first();
      
      res.json(updated);
    } catch (err) {
      console.error('PATCH /bookings/:id error:', err);
      res.status(500).json({ error: 'Failed to update booking' });
    }
  });
  
  // POST /api/locations - Create a new location (admin/owner only)
  router.post('/', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        name,
        description,
        address,
        city,
        postal_code,
        country,
        latitude,
        longitude,
        phone,
        email,
        website,
        timezone,
        opening_hours,
        photos
      } = req.body;
      
      if (!name || !city) {
        return res.status(400).json({ error: 'name and city required' });
      }
      
      const [locationId] = await db('locations').insert({
        owner_id: userId,
        name,
        description: description || null,
        address: address || null,
        city,
        postal_code: postal_code || null,
        country: country || 'Germany',
        latitude: latitude || null,
        longitude: longitude || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        timezone: timezone || 'Europe/Berlin',
        opening_hours: opening_hours ? JSON.stringify(opening_hours) : null,
        photos: photos ? JSON.stringify(photos) : null,
        status: 'draft',
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      const location = await db('locations')
        .where({ id: locationId })
        .first();
      
      res.status(201).json(location);
    } catch (err) {
      console.error('POST /locations error:', err);
      res.status(500).json({ error: 'Failed to create location' });
    }
  });
  
  // PATCH /api/locations/:id - Update location (owner only)
  router.patch('/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // Check ownership
      const location = await db('locations')
        .where({ id })
        .first();
      
      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }
      
      if (location.owner_id !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const {
        name,
        description,
        address,
        city,
        postal_code,
        phone,
        email,
        website,
        opening_hours,
        status,
        photos
      } = req.body;
      
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (address !== undefined) updates.address = address;
      if (city !== undefined) updates.city = city;
      if (postal_code !== undefined) updates.postal_code = postal_code;
      if (phone !== undefined) updates.phone = phone;
      if (email !== undefined) updates.email = email;
      if (website !== undefined) updates.website = website;
      if (opening_hours !== undefined) updates.opening_hours = typeof opening_hours === 'string' ? opening_hours : JSON.stringify(opening_hours);
      if (status !== undefined) updates.status = status;
      if (photos !== undefined) updates.photos = JSON.stringify(photos);
      updates.updated_at = new Date();
      
      await db('locations')
        .where({ id })
        .update(updates);
      
      const updated = await db('locations')
        .where({ id })
        .first();
      
      res.json(updated);
    } catch (err) {
      console.error('PATCH /locations/:id error:', err);
      res.status(500).json({ error: 'Failed to update location' });
    }
  });
  
  // POST /api/locations/:locationId/assets - Create asset (owner only)
  router.post('/:locationId/assets', authenticateToken, async (req, res) => {
    try {
      const { locationId } = req.params;
      const userId = req.user.id;
      
      // Check ownership
      const location = await db('locations')
        .where({ id: locationId })
        .first();
      
      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }
      
      if (location.owner_id !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const {
        name,
        asset_type,
        sport_id,
        dimensions,
        surface_type,
        indoor,
        status,
        description,
        base_price_per_hour
      } = req.body;
      
      if (!name || !asset_type) {
        return res.status(400).json({ error: 'Name and asset_type required' });
      }
      
      const [assetId] = await db('assets').insert({
        location_id: locationId,
        name,
        asset_type,
        sport_id: sport_id || null,
        dimensions: dimensions || null,
        surface_type: surface_type || null,
        indoor: indoor || false,
        status: status || 'active',
        description: description || null,
        base_price_per_hour: base_price_per_hour || 0,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      const asset = await db('assets')
        .where({ id: assetId })
        .first();
      
      res.status(201).json(asset);
    } catch (err) {
      console.error('POST /assets error:', err);
      res.status(500).json({ error: 'Failed to create asset' });
    }
  });
  
  // PATCH /api/locations/assets/:assetId - Update asset (owner only)
  router.patch('/assets/:assetId', authenticateToken, async (req, res) => {
    try {
      const { assetId } = req.params;
      const userId = req.user.id;
      
      // Check ownership via location
      const asset = await db('assets')
        .join('locations', 'assets.location_id', 'locations.id')
        .where('assets.id', assetId)
        .select('assets.*', 'locations.owner_id')
        .first();
      
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      
      if (asset.owner_id !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const {
        name,
        asset_type,
        sport_id,
        dimensions,
        surface_type,
        indoor,
        status,
        description,
        base_price_per_hour
      } = req.body;
      
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (asset_type !== undefined) updates.asset_type = asset_type;
      if (sport_id !== undefined) updates.sport_id = sport_id;
      if (dimensions !== undefined) updates.dimensions = dimensions;
      if (surface_type !== undefined) updates.surface_type = surface_type;
      if (indoor !== undefined) updates.indoor = indoor;
      if (status !== undefined) updates.status = status;
      if (description !== undefined) updates.description = description;
      if (base_price_per_hour !== undefined) updates.base_price_per_hour = base_price_per_hour;
      updates.updated_at = new Date();
      
      await db('assets')
        .where({ id: assetId })
        .update(updates);
      
      const updated = await db('assets')
        .where({ id: assetId })
        .first();
      
      res.json(updated);
    } catch (err) {
      console.error('PATCH /assets/:assetId error:', err);
      res.status(500).json({ error: 'Failed to update asset' });
    }
  });
  
  // DELETE /api/locations/assets/:assetId - Delete asset (owner only)
  router.delete('/assets/:assetId', authenticateToken, async (req, res) => {
    try {
      const { assetId } = req.params;
      const userId = req.user.id;
      
      // Check ownership via location
      const asset = await db('assets')
        .join('locations', 'assets.location_id', 'locations.id')
        .where('assets.id', assetId)
        .select('assets.*', 'locations.owner_id')
        .first();
      
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      
      if (asset.owner_id !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      await db('assets')
        .where({ id: assetId })
        .delete();
      
      res.json({ message: 'Asset deleted' });
    } catch (err) {
      console.error('DELETE /assets/:assetId error:', err);
      res.status(500).json({ error: 'Failed to delete asset' });
    }
  });
  
  // POST /api/assets/:assetId/slots - Create time slot (owner only)
  router.post('/assets/:assetId/slots', authenticateToken, async (req, res) => {
    try {
      const { assetId } = req.params;
      const userId = req.user.id;
      
      // Check ownership via location
      const asset = await db('assets')
        .join('locations', 'assets.location_id', 'locations.id')
        .where('assets.id', assetId)
        .select('assets.*', 'locations.owner_id')
        .first();
      
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      
      if (asset.owner_id !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const { start_time, end_time, base_price, status } = req.body;
      
      if (!start_time || !end_time) {
        return res.status(400).json({ error: 'start_time and end_time required' });
      }
      
      const start = new Date(start_time);
      const end = new Date(end_time);
      const duration = (end - start) / (1000 * 60); // minutes
      
      const [slotId] = await db('booking_slots').insert({
        asset_id: assetId,
        start_time: start,
        end_time: end,
        duration_minutes: duration,
        base_price: base_price || asset.base_price_per_hour,
        currency: 'EUR',
        status: status || 'available',
        created_at: new Date()
      });
      
      const slot = await db('booking_slots')
        .where({ id: slotId })
        .first();
      
      res.status(201).json(slot);
    } catch (err) {
      console.error('POST /slots error:', err);
      res.status(500).json({ error: 'Failed to create slot' });
    }
  });
  
  // GET /api/slots/search-available - Search for available slots
  router.get('/slots/search-available', optionalAuth, async (req, res) => {
    try {
      const { date, time, duration = 60, sport_id, city_id, limit = 10 } = req.query;
      
      if (!date || !time) {
        return res.status(400).json({ error: 'date and time required' });
      }
      
      const searchDateTime = new Date(`${date}T${time}:00`);
      const durationMin = parseInt(duration);
      
      let query = db('booking_slots')
        .join('assets', 'booking_slots.asset_id', 'assets.id')
        .join('locations', 'assets.location_id', 'locations.id')
        .leftJoin('sports', 'assets.sport_id', 'sports.id')
        .where('booking_slots.status', 'available')
        .where('booking_slots.start_time', '>=', searchDateTime)
        .where('booking_slots.duration_minutes', '>=', durationMin)
        .where('locations.status', 'active')
        .select(
          'booking_slots.*',
          'assets.name as asset_name',
          'assets.asset_type',
          'locations.name as location_name',
          'locations.city',
          'locations.address',
          'sports.name as sport_name'
        )
        .orderBy('booking_slots.start_time')
        .limit(parseInt(limit));
      
      if (sport_id) {
        query = query.where('assets.sport_id', sport_id);
      }
      
      if (city_id) {
        query = query.where('locations.city', city_id);
      }
      
      const slots = await query;
      res.json(slots);
    } catch (err) {
      console.error('GET /slots/search-available error:', err);
      res.status(500).json({ error: 'Failed to search slots' });
    }
  });
  
  return router;
};
