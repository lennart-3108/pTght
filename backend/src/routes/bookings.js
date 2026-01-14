const express = require('express');
const BookingService = require('../services/BookingService');
const { isAuthenticated } = require('../../middleware/auth');

module.exports = function bookingsRoutes(ctx) {
  const router = express.Router();
  const { knex } = ctx;
  const bookingService = new BookingService(knex);

  /**
   * POST /bookings/hold
   * Body: { slot_id, idempotency_key? }
   * DEPRECATED - use /bookings/direct instead
   */
  router.post('/hold', isAuthenticated, async (req, res) => {
    try {
      const { slot_id, idempotency_key } = req.body || {};
      if (!slot_id) return res.status(400).json({ error: 'slot_id is required' });
      const booking = await bookingService.holdSlot({
        userId: req.user.id,
        slotId: parseInt(slot_id),
        idempotencyKey: idempotency_key || null,
      });
      return res.json(booking);
    } catch (error) {
      console.error('[POST /bookings/hold] error:', error);
      const msg = error.message || 'Failed to hold slot';
      const code = msg.includes('not available') ? 409 : 500;
      return res.status(code).json({ error: msg });
    }
  });

  /**
   * POST /bookings/direct
   * Create a booking directly for an asset at a specific time
   * Body: { asset_id, start_time, duration_minutes }
   */
  router.post('/direct', isAuthenticated, async (req, res) => {
    try {
      const { asset_id, start_time, duration_minutes, payment_method, split_cost, split_user_id } = req.body || {};
      
      if (!asset_id || !start_time || !duration_minutes) {
        return res.status(400).json({ error: 'asset_id, start_time, and duration_minutes are required' });
      }

      const startTime = new Date(start_time);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + parseInt(duration_minutes));

      // Get location_id from asset
      const asset = await knex('assets').where({ id: asset_id }).first();
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      // Check for conflicts
      const conflicts = await knex('bookings')
        .where('asset_id', asset_id)
        .whereNull('resold_at')
        .where(function() {
          this.where(function() {
            // Existing booking starts during new booking
            this.where('start_time', '>=', startTime.toISOString())
              .where('start_time', '<', endTime.toISOString());
          }).orWhere(function() {
            // Existing booking ends during new booking
            this.where('end_time', '>', startTime.toISOString())
              .where('end_time', '<=', endTime.toISOString());
          }).orWhere(function() {
            // Existing booking completely overlaps new booking
            this.where('start_time', '<=', startTime.toISOString())
              .where('end_time', '>=', endTime.toISOString());
          });
        });

      if (conflicts.length > 0) {
        return res.status(409).json({ error: 'Time slot already booked' });
      }

      // Create booking
      const [bookingId] = await knex('bookings').insert({
        match_id: 10, // Dummy match ID for direct bookings (NOT NULL constraint)
        slot_id: 1, // Dummy slot ID for direct bookings (NOT NULL constraint)
        asset_id: asset_id,
        location_id: asset.location_id,
        user_id: req.user.id,
        booking_date: startTime.toISOString().split('T')[0],
        start_time: startTime.toTimeString().slice(0, 8),
        end_time: endTime.toTimeString().slice(0, 8),
        status: 'confirmed',
        booking_type: 'direct',
        payment_status: 'paid',
        payment_method: payment_method || 'wallet',
        created_at: knex.fn.now()
      });

      // If split_cost is enabled, create a payment request
      if (split_cost && split_user_id) {
        // Get the booking price (you might need to calculate this based on asset pricing)
        const bookingPrice = 25.00; // TODO: Calculate actual price from asset/duration
        const splitAmount = bookingPrice / 2;

        // Check if payment_requests table exists, if not create it
        const hasTable = await knex.schema.hasTable('payment_requests');
        if (!hasTable) {
          await knex.schema.createTable('payment_requests', (table) => {
            table.increments('id').primary();
            table.integer('booking_id').unsigned().notNullable();
            table.integer('from_user_id').unsigned().notNullable(); // User who created the booking
            table.integer('to_user_id').unsigned().notNullable(); // User who should pay
            table.decimal('amount', 10, 2).notNullable();
            table.string('status').defaultTo('pending'); // pending, paid, declined
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('paid_at').nullable();
            
            table.foreign('booking_id').references('bookings.id').onDelete('CASCADE');
            table.foreign('from_user_id').references('users.id').onDelete('CASCADE');
            table.foreign('to_user_id').references('users.id').onDelete('CASCADE');
          });
        }

        // Create payment request
        await knex('payment_requests').insert({
          booking_id: bookingId,
          from_user_id: req.user.id,
          to_user_id: split_user_id,
          amount: splitAmount,
          status: 'pending',
          created_at: knex.fn.now()
        });
      }

      const booking = await knex('bookings').where({ id: bookingId }).first();
      return res.json(booking);
    } catch (error) {
      console.error('[POST /bookings/direct] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to create booking' });
    }
  });

  /**
   * POST /bookings/:id/confirm
   */
  router.post('/:id/confirm', isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await bookingService.confirmBooking({ bookingId, userId: req.user.id });
      return res.json(booking);
    } catch (error) {
      console.error(`[POST /bookings/${req.params.id}/confirm] error:`, error);
      const msg = error.message || 'Failed to confirm booking';
      let code = 500;
      if (msg.includes('Not authorized')) code = 403;
      else if (msg.includes('Hold expired') || msg.includes('not in held')) code = 409;
      return res.status(code).json({ error: msg });
    }
  });

  /**
   * POST /bookings/:id/cancel
   */
  router.post('/:id/cancel', isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const isAdmin = !!req.user.is_admin;
      const { reason } = req.body || {};
      const booking = await bookingService.cancelBooking({ bookingId, userId: req.user.id, isAdmin, reason });
      return res.json(booking);
    } catch (error) {
      console.error(`[POST /bookings/${req.params.id}/cancel] error:`, error);
      const msg = error.message || 'Failed to cancel booking';
      let code = 500;
      if (msg.includes('Not authorized')) code = 403;
      return res.status(code).json({ error: msg });
    }
  });

  /**
   * GET /bookings/my
   * Returns user's bookings including series bookings
   */
  router.get('/my', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const now = new Date();

      // Get individual bookings (future only)
      const bookings = await knex('bookings as b')
        .leftJoin('assets as a', 'b.asset_id', 'a.id')
        .leftJoin('locations as l', 'a.location_id', 'l.id')
        .leftJoin('sports as s', 'a.sport_id', 's.id')
        .where('b.user_id', userId)
        .where('b.start_time', '>=', now.toISOString())
        .whereNull('b.resold_at') // Exclude resold bookings
        .select(
          'b.*',
          'a.name as asset_name',
          'a.base_price as asset_price',
          'l.name as location_name',
          'l.address as location_address',
          's.name as sport_name'
        )
        .orderBy('b.start_time', 'asc');

      // Get series bookings
      const series = await knex('booking_series as bs')
        .leftJoin('assets as a', 'bs.asset_id', 'a.id')
        .leftJoin('locations as l', 'a.location_id', 'l.id')
        .leftJoin('sports as s', 'a.sport_id', 's.id')
        .where('bs.user_id', userId)
        .select(
          'bs.*',
          'a.name as asset_name',
          'l.name as location_name',
          's.name as sport_name'
        )
        .orderBy('bs.created_at', 'desc');

      // For each series, get count of future bookings
      for (const s of series) {
        const count = await knex('bookings')
          .where('series_id', s.id)
          .where('start_time', '>=', now.toISOString())
          .whereNull('resold_at')
          .count('* as count')
          .first();
        s.future_bookings_count = count.count || 0;
      }

      return res.json({ bookings, series });
    } catch (error) {
      console.error('[GET /bookings/my] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch bookings' });
    }
  });

  /**
   * GET /bookings/:id
   */
  router.get('/:id', isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await bookingService.getBooking(bookingId);
      if (booking.user_id !== req.user.id && !req.user.is_admin) {
        return res.status(403).json({ error: 'Not authorized to view this booking' });
      }
      return res.json(booking);
    } catch (error) {
      console.error(`[GET /bookings/${req.params.id}] error:`, error);
      const msg = error.message || 'Failed to fetch booking';
      return res.status(msg.includes('not found') ? 404 : 500).json({ error: msg });
    }
  });

  /**
   * GET /bookings/match/:matchId - Get booking for a specific match
   */
  router.get('/match/:matchId', isAuthenticated, async (req, res) => {
    try {
      const matchId = parseInt(req.params.matchId);
      
      // Check if user is participant in the match
      const match = await knex('matches').where({ id: matchId }).first();
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }

      // Check if user is home or away participant
      const isHomeUser = match.home_user_id === req.user.id;
      const isAwayUser = match.away_user_id === req.user.id;
      
      // Check if user is team member
      let isTeamMember = false;
      if (match.home_team_id) {
        const homeMember = await knex('team_members')
          .where({ team_id: match.home_team_id, user_id: req.user.id })
          .first();
        if (homeMember) isTeamMember = true;
      }
      if (!isTeamMember && match.away_team_id) {
        const awayMember = await knex('team_members')
          .where({ team_id: match.away_team_id, user_id: req.user.id })
          .first();
        if (awayMember) isTeamMember = true;
      }

      // User must be participant or admin
      if (!isHomeUser && !isAwayUser && !isTeamMember && !req.user.is_admin) {
        return res.status(403).json({ error: 'Not authorized to view this booking' });
      }

      const booking = await knex('bookings')
        .where({ match_id: matchId })
        .whereNull('resold_at')
        .first();
      
      if (!booking) {
        return res.status(404).json({ error: 'No booking found for this match' });
      }

      return res.json(booking);
    } catch (error) {
      console.error(`[GET /bookings/match/${req.params.matchId}] error:`, error);
      return res.status(500).json({ error: 'Failed to fetch booking' });
    }
  });

  /**
   * POST /bookings/series/calculate
   * Body: { asset_id, weekday, time, duration_months }
   * Returns: { total_price, bookings_count }
   */
  router.post('/series/calculate', isAuthenticated, async (req, res) => {
    try {
      const { asset_id, weekday, time, duration_months } = req.body || {};
      if (!asset_id || !weekday || !time || !duration_months) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get asset to find slot duration and price
      const asset = await knex('assets').where({ id: asset_id }).first();
      if (!asset) return res.status(404).json({ error: 'Asset not found' });

      const slotDuration = asset.slot_duration || 60; // minutes
      const basePrice = parseFloat(asset.base_price || 0);

      // Calculate number of weeks in duration_months
      const weeksCount = Math.floor((duration_months * 30.44) / 7); // average weeks per month
      const totalPrice = weeksCount * basePrice;

      return res.json({
        total_price: totalPrice,
        bookings_count: weeksCount,
        weekly_price: basePrice,
        slot_duration: slotDuration
      });
    } catch (error) {
      console.error('[POST /bookings/series/calculate] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to calculate price' });
    }
  });

  /**
   * POST /bookings/series
   * Body: { asset_id, weekday, time, duration_months }
   * Creates recurring bookings and initiates PayPal payment
   */
  router.post('/series', isAuthenticated, async (req, res) => {
    try {
      const { asset_id, weekday, time, duration_months } = req.body || {};
      if (!asset_id || !weekday || !time || !duration_months) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get asset details
      const asset = await knex('assets').where({ id: asset_id }).first();
      if (!asset) return res.status(404).json({ error: 'Asset not found' });

      const slotDuration = asset.slot_duration || 60;
      const basePrice = parseFloat(asset.base_price || 0);

      // Calculate series details
      const weeksCount = Math.floor((duration_months * 30.44) / 7);
      const totalPrice = weeksCount * basePrice;

      // Create series booking record
      const [seriesId] = await knex('booking_series').insert({
        user_id: req.user.id,
        asset_id: asset_id,
        weekday: weekday,
        time: time,
        duration_months: duration_months,
        total_price: totalPrice,
        status: 'pending_payment',
        created_at: knex.fn.now()
      });

      // Generate individual bookings for each week
      const bookings = [];
      const startDate = new Date();
      // Find next occurrence of weekday
      const targetDay = parseInt(weekday); // 1=Mon, 7=Sun
      const today = startDate.getDay() || 7; // Convert Sunday from 0 to 7
      const daysUntilTarget = (targetDay - today + 7) % 7;
      startDate.setDate(startDate.getDate() + daysUntilTarget);

      for (let i = 0; i < weeksCount; i++) {
        const bookingDate = new Date(startDate);
        bookingDate.setDate(startDate.getDate() + (i * 7));
        
        const [hours, minutes] = time.split(':');
        bookingDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        const endTime = new Date(bookingDate);
        endTime.setMinutes(endTime.getMinutes() + slotDuration);

        bookings.push({
          series_id: seriesId,
          asset_id: asset_id,
          user_id: req.user.id,
          start_time: bookingDate.toISOString(),
          end_time: endTime.toISOString(),
          price: basePrice,
          status: 'pending_payment',
          created_at: knex.fn.now()
        });
      }

      if (bookings.length > 0) {
        await knex('bookings').insert(bookings);
      }

      // For now, return success without PayPal integration
      // TODO: Integrate PayPal payment URL generation
      return res.json({
        series_id: seriesId,
        bookings_count: bookings.length,
        total_price: totalPrice,
        message: 'Series booking created. Payment integration coming soon.'
      });
    } catch (error) {
      console.error('[POST /bookings/series] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to create series booking' });
    }
  });

  /**
   * PUT /bookings/:id/resale
   * Toggle resale availability for a booking
   * Body: { available: boolean }
   */
  router.put('/:id/resale', isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const { available } = req.body;

      // Get booking and verify ownership
      const booking = await knex('bookings').where({ id: bookingId }).first();
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      if (booking.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Check if booking is in the future
      if (new Date(booking.start_time) <= new Date()) {
        return res.status(400).json({ error: 'Cannot make past bookings available for resale' });
      }

      // Update resale status
      await knex('bookings')
        .where({ id: bookingId })
        .update({ available_for_resale: !!available });

      const updated = await knex('bookings').where({ id: bookingId }).first();
      return res.json(updated);
    } catch (error) {
      console.error(`[PUT /bookings/${req.params.id}/resale] error:`, error);
      return res.status(500).json({ error: error.message || 'Failed to update resale status' });
    }
  });

  /**
   * POST /bookings/:id/purchase-resale
   * Purchase a booking that's available for resale
   */
  router.post('/:id/purchase-resale', isAuthenticated, async (req, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const buyerId = req.user.id;
      const { payment_method, split_cost, split_user_id } = req.body || {};

      // Get booking
      const booking = await knex('bookings').where({ id: bookingId }).first();
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      if (!booking.available_for_resale) {
        return res.status(400).json({ error: 'This booking is not available for resale' });
      }

      if (booking.user_id === buyerId) {
        return res.status(400).json({ error: 'Cannot purchase your own booking' });
      }

      // Check if booking is still in the future
      if (new Date(booking.start_time) <= new Date()) {
        return res.status(400).json({ error: 'Cannot purchase past bookings' });
      }

      const originalOwnerId = booking.user_id;
      const price = parseFloat(booking.price || 0);

      // Start transaction
      await knex.transaction(async trx => {
        // Update original booking as resold
        await trx('bookings')
          .where({ id: bookingId })
          .update({
            resold_at: trx.fn.now(),
            available_for_resale: false
          });

        // Create new booking for buyer
        const [newBookingId] = await trx('bookings').insert({
          asset_id: booking.asset_id,
          user_id: buyerId,
          start_time: booking.start_time,
          end_time: booking.end_time,
          price: price,
          status: 'confirmed',
          payment_method: payment_method || 'wallet',
          original_owner_id: originalOwnerId,
          created_at: trx.fn.now()
        });

        // Credit original owner
        await trx('users')
          .where({ id: originalOwnerId })
          .increment('credit_balance', price);

        // If split_cost is enabled, create a payment request
        if (split_cost && split_user_id) {
          const splitAmount = price / 2;

          // Check if payment_requests table exists
          const hasTable = await trx.schema.hasTable('payment_requests');
          if (!hasTable) {
            await trx.schema.createTable('payment_requests', (table) => {
              table.increments('id').primary();
              table.integer('booking_id').unsigned().notNullable();
              table.integer('from_user_id').unsigned().notNullable();
              table.integer('to_user_id').unsigned().notNullable();
              table.decimal('amount', 10, 2).notNullable();
              table.string('status').defaultTo('pending');
              table.timestamp('created_at').defaultTo(knex.fn.now());
              table.timestamp('paid_at').nullable();
              
              table.foreign('booking_id').references('bookings.id').onDelete('CASCADE');
              table.foreign('from_user_id').references('users.id').onDelete('CASCADE');
              table.foreign('to_user_id').references('users.id').onDelete('CASCADE');
            });
          }

          // Create payment request
          await trx('payment_requests').insert({
            booking_id: newBookingId,
            from_user_id: buyerId,
            to_user_id: split_user_id,
            amount: splitAmount,
            status: 'pending',
            created_at: knex.fn.now()
          });
        }
      });

      return res.json({ 
        success: true, 
        message: 'Booking purchased successfully',
        credited_amount: price
      });
    } catch (error) {
      console.error(`[POST /bookings/${req.params.id}/purchase-resale] error:`, error);
      return res.status(500).json({ error: error.message || 'Failed to purchase booking' });
    }
  });

  return router;
};

