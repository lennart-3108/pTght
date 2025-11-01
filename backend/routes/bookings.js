const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/bookings
 * Create a new booking for a match with a slot
 * 
 * Body:
 * - match_id: ID of the match
 * - slot_id: ID of the slot to book
 * - payment_method: 'paypal' | 'cash' | 'card'
 * - paypal_transaction_id: (optional) PayPal transaction ID
 * - paypal_payer_email: (optional) PayPal payer email
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { match_id, slot_id, payment_method, paypal_transaction_id, paypal_payer_email, notes } = req.body;

    if (!match_id || !slot_id || !payment_method) {
      return res.status(400).json({ error: 'match_id, slot_id, and payment_method are required' });
    }

    // Get authenticated user ID from JWT token
    const user_id = req.user.id;

    // Fetch slot details
    const slot = await db('slots')
      .join('assets', 'slots.asset_id', 'assets.id')
      .join('locations', 'assets.location_id', 'locations.id')
      .where('slots.id', slot_id)
      .select(
        'slots.*',
        'assets.location_id',
        'assets.id as asset_id',
        'locations.name as location_name',
        'assets.name as asset_name',
        'assets.type as asset_type',
        'assets.surface'
      )
      .first();

    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    // Check if slot is still available
    if (slot.status !== 'available') {
      return res.status(400).json({ error: 'Slot is no longer available' });
    }

    // Fetch match details
    const match = await db('matches').where('id', match_id).first();
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Authorization: Only players in the match can book
    const isHomePlayer = match.home_user_id && match.home_user_id === user_id;
    const isAwayPlayer = match.away_user_id && match.away_user_id === user_id;
    
    if (!isHomePlayer && !isAwayPlayer) {
      return res.status(403).json({ 
        error: 'Nur die Spieler dieses Matches können einen Platz buchen',
        details: 'Sie sind nicht Teil dieses Matches'
      });
    }

    // Check if this match already has a booking
    const existingBooking = await db('bookings')
      .where('match_id', match_id)
      .first();
    
    if (existingBooking) {
      return res.status(400).json({ 
        error: 'Für dieses Match existiert bereits eine Buchung',
        booking_id: existingBooking.id
      });
    }

    // Start transaction
    const result = await db.transaction(async (trx) => {
      // 1. Create booking (without booking_date - use slot's start_time)
      const [bookingId] = await trx('bookings').insert({
        match_id,
        slot_id,
        user_id,
        location_id: slot.location_id,
        asset_id: slot.asset_id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        duration_minutes: slot.duration_minutes || 60,
        price: slot.base_price || 0,
        currency: slot.currency || 'EUR',
        status: payment_method === 'paypal' ? 'confirmed' : 'held',
        payment_intent_id: paypal_transaction_id || null,
        paid_at: payment_method === 'paypal' ? new Date() : null,
        user_notes: notes || null
      });

      // 2. Generate invoice number (format: INV-YYYYMMDD-XXXXX)
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const count = await trx('invoices').count('id as count').first();
      const invoiceNumber = `INV-${today}-${String((count.count || 0) + 1).padStart(5, '0')}`;

      // 3. Create invoice
      const [invoiceId] = await trx('invoices').insert({
        booking_id: bookingId,
        invoice_number: invoiceNumber,
        amount: slot.base_price || 0,
        currency: slot.currency || 'EUR',
        payment_method,
        paypal_transaction_id,
        paypal_payer_email,
        status: payment_method === 'paypal' ? 'paid' : 'issued',
        issued_at: new Date(),
        paid_at: payment_method === 'paypal' ? new Date() : null,
        due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      });

      // 4. Update slot status to booked
      await trx('slots')
        .where('id', slot_id)
        .update({ status: 'booked' });

      // 5. Update match with location info
      await trx('matches')
        .where('id', match_id)
        .update({
          location: `${slot.location_name} - ${slot.asset_name}`,
          kickoff_at: slot.start_time
        });

      return { bookingId, invoiceId, invoiceNumber };
    });

    // Fetch complete booking data to return
    const booking = await db('bookings')
      .join('slots', 'bookings.slot_id', 'slots.id')
      .join('locations', 'bookings.location_id', 'locations.id')
      .join('assets', 'bookings.asset_id', 'assets.id')
      .leftJoin('invoices', 'bookings.id', 'invoices.booking_id')
      .where('bookings.id', result.bookingId)
      .select(
        'bookings.*',
        'locations.name as location_name',
        'locations.address as location_address',
        'locations.city as location_city',
        'assets.name as asset_name',
        'assets.type as asset_type',
        'slots.base_price',
        'slots.currency',
        'invoices.invoice_number',
        'invoices.status as invoice_status'
      )
      .first();

    res.status(201).json({
      success: true,
      booking,
      message: 'Buchung erfolgreich erstellt'
    });

  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create booking',
      details: error.message 
    });
  }
});

/**
 * GET /api/bookings/match/:matchId
 * Get booking for a specific match
 * MUST BE BEFORE /:id route to avoid matching "match" as an ID
 */
router.get('/match/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;

    const booking = await db('bookings')
      .join('slots', 'bookings.slot_id', 'slots.id')
      .join('locations', 'bookings.location_id', 'locations.id')
      .join('assets', 'bookings.asset_id', 'assets.id')
      .leftJoin('invoices', 'bookings.id', 'invoices.booking_id')
      .where('bookings.match_id', matchId)
      .select(
        'bookings.*',
        'locations.name as location_name',
        'locations.address as location_address',
        'locations.city as location_city',
        'assets.name as asset_name',
        'assets.type as asset_type',
        'assets.surface',
        'slots.base_price',
        'slots.currency',
        'invoices.invoice_number',
        'invoices.status as invoice_status'
      )
      .first();

    if (!booking) {
      return res.status(404).json({ error: 'No booking found for this match' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Get match booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/**
 * GET /api/bookings/:id
 * Get booking details by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { matchId } = req.params;

    const booking = await db('bookings')
      .join('slots', 'bookings.slot_id', 'slots.id')
      .join('locations', 'bookings.location_id', 'locations.id')
      .join('assets', 'bookings.asset_id', 'assets.id')
      .leftJoin('invoices', 'bookings.id', 'invoices.booking_id')
      .where('bookings.match_id', matchId)
      .select(
        'bookings.*',
        'locations.name as location_name',
        'locations.address as location_address',
        'locations.city as location_city',
        'assets.name as asset_name',
        'assets.type as asset_type',
        'assets.surface',
        'slots.base_price',
        'slots.currency',
        'invoices.invoice_number',
        'invoices.status as invoice_status'
      )
      .first();

    if (!booking) {
      return res.status(404).json({ error: 'No booking found for this match' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/**
 * PATCH /api/bookings/:id/cancel
 * Cancel a booking
 */
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    await db.transaction(async (trx) => {
      // Update booking status
      await trx('bookings')
        .where('id', id)
        .update({ 
          status: 'cancelled',
          updated_at: new Date()
        });

      // Get slot_id
      const booking = await trx('bookings').where('id', id).first();
      
      // Release the slot
      await trx('slots')
        .where('id', booking.slot_id)
        .update({ status: 'available' });

      // Update invoice status
      await trx('invoices')
        .where('booking_id', id)
        .update({ status: 'cancelled' });
    });

    res.json({ success: true, message: 'Buchung storniert' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * POST /api/bookings/manual
 * Create a manual booking (for location managers)
 */
router.post('/manual', authenticateToken, async (req, res) => {
  try {
    const { asset_id, user_id, start_time, end_time, price, notes } = req.body;

    // Validate input
    if (!asset_id || !user_id || !start_time || !end_time) {
      return res.status(400).json({ error: 'Asset, User, Start- und Endzeit sind erforderlich' });
    }

    // Verify location manager permissions
    const asset = await db('assets')
      .join('locations', 'assets.location_id', 'locations.id')
      .where('assets.id', asset_id)
      .select('locations.owner_id', 'assets.id', 'assets.name')
      .first();

    if (!asset) {
      return res.status(404).json({ error: 'Asset nicht gefunden' });
    }

    if (asset.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Nur Location Manager können manuelle Buchungen erstellen' });
    }

    // Verify user exists
    const user = await db('users').where('id', user_id).first();
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Check for conflicts
    const conflict = await db('bookings')
      .where('asset_id', asset_id)
      .where('status', '!=', 'cancelled')
      .where(function() {
        this.whereBetween('start_time', [start_time, end_time])
          .orWhereBetween('end_time', [start_time, end_time])
          .orWhere(function() {
            this.where('start_time', '<=', start_time)
              .where('end_time', '>=', end_time);
          });
      })
      .first();

    if (conflict) {
      return res.status(409).json({ error: 'Zeitslot bereits gebucht' });
    }

    // Create booking
    const [bookingId] = await db('bookings').insert({
      asset_id,
      user_id,
      start_time,
      end_time,
      price: price || 0,
      status: 'confirmed',
      booking_type: 'manual',
      notes,
      created_at: new Date(),
      updated_at: new Date()
    });

    const booking = await db('bookings')
      .where('bookings.id', bookingId)
      .join('assets', 'bookings.asset_id', 'assets.id')
      .join('users', 'bookings.user_id', 'users.id')
      .select(
        'bookings.*',
        'assets.name as asset_name',
        'users.username',
        'users.email'
      )
      .first();

    res.status(201).json({ 
      success: true, 
      message: 'Manuelle Buchung erstellt',
      booking 
    });
  } catch (error) {
    console.error('Manual booking error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Buchung' });
  }
});

/**
 * GET /api/bookings/list
 * List bookings for location manager
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const { location_id, limit = 50 } = req.query;

    // Verify ownership
    if (location_id) {
      const location = await db('locations').where('id', location_id).first();
      if (!location || location.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
    }

    const bookings = await db('bookings')
      .join('assets', 'bookings.asset_id', 'assets.id')
      .join('locations', 'assets.location_id', 'locations.id')
      .join('users', 'bookings.user_id', 'users.id')
      .where('locations.owner_id', req.user.id)
      .modify((qb) => {
        if (location_id) {
          qb.where('locations.id', location_id);
        }
      })
      .select(
        'bookings.*',
        'assets.name as asset_name',
        'locations.name as location_name',
        'users.username',
        'users.email'
      )
      .orderBy('bookings.start_time', 'desc')
      .limit(limit);

    res.json({ bookings });
  } catch (error) {
    console.error('List bookings error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Buchungen' });
  }
});

module.exports = router;
