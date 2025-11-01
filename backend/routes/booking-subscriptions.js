const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/booking-subscriptions
 * Create a recurring booking subscription
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      asset_id, 
      user_id, 
      frequency, // 'weekly' or 'monthly'
      day_of_week, // 0-6 for weekly (0 = Sunday)
      day_of_month, // 1-31 for monthly
      start_time, // HH:mm format
      end_time, // HH:mm format
      price,
      start_date,
      end_date,
      notes
    } = req.body;

    // Validate input
    if (!asset_id || !user_id || !frequency || !start_time || !end_time || !start_date) {
      return res.status(400).json({ error: 'Asset, User, Frequenz, Zeit und Startdatum sind erforderlich' });
    }

    if (frequency === 'weekly' && (day_of_week === undefined || day_of_week === null)) {
      return res.status(400).json({ error: 'Wochentag erforderlich für wöchentliche Abos' });
    }

    if (frequency === 'monthly' && !day_of_month) {
      return res.status(400).json({ error: 'Tag im Monat erforderlich für monatliche Abos' });
    }

    // Verify location manager permissions
    const asset = await db('assets')
      .join('locations', 'assets.location_id', 'locations.id')
      .where('assets.id', asset_id)
      .select('locations.owner_id', 'assets.id', 'assets.name', 'locations.name as location_name')
      .first();

    if (!asset) {
      return res.status(404).json({ error: 'Asset nicht gefunden' });
    }

    if (asset.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Nur Location Manager können Abos erstellen' });
    }

    // Verify user exists
    const user = await db('users').where('id', user_id).first();
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Create subscription
    const [subscriptionId] = await db('booking_subscriptions').insert({
      asset_id,
      user_id,
      frequency,
      day_of_week: frequency === 'weekly' ? day_of_week : null,
      day_of_month: frequency === 'monthly' ? day_of_month : null,
      start_time,
      end_time,
      price: price || 0,
      start_date,
      end_date,
      status: 'active',
      notes,
      created_by: req.user.id,
      created_at: new Date(),
      updated_at: new Date()
    });

    const subscription = await db('booking_subscriptions')
      .where('booking_subscriptions.id', subscriptionId)
      .join('assets', 'booking_subscriptions.asset_id', 'assets.id')
      .join('users', 'booking_subscriptions.user_id', 'users.id')
      .select(
        'booking_subscriptions.*',
        'assets.name as asset_name',
        'users.username',
        'users.email'
      )
      .first();

    res.status(201).json({ 
      success: true, 
      message: 'Abo-Buchung erstellt',
      subscription 
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Abos' });
  }
});

/**
 * GET /api/booking-subscriptions/list
 * List all subscriptions for location manager
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const { location_id, status } = req.query;

    // Build query
    let query = db('booking_subscriptions')
      .join('assets', 'booking_subscriptions.asset_id', 'assets.id')
      .join('locations', 'assets.location_id', 'locations.id')
      .join('users', 'booking_subscriptions.user_id', 'users.id')
      .where('locations.owner_id', req.user.id);

    if (location_id) {
      // Verify ownership
      const location = await db('locations').where('id', location_id).first();
      if (!location || location.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
      query = query.where('locations.id', location_id);
    }

    if (status) {
      query = query.where('booking_subscriptions.status', status);
    }

    const subscriptions = await query
      .select(
        'booking_subscriptions.*',
        'assets.name as asset_name',
        'locations.name as location_name',
        'users.username',
        'users.email'
      )
      .orderBy('booking_subscriptions.created_at', 'desc');

    res.json({ subscriptions });
  } catch (error) {
    console.error('List subscriptions error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Abos' });
  }
});

/**
 * DELETE /api/booking-subscriptions/:id
 * Cancel a subscription
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const subscription = await db('booking_subscriptions')
      .join('assets', 'booking_subscriptions.asset_id', 'assets.id')
      .join('locations', 'assets.location_id', 'locations.id')
      .where('booking_subscriptions.id', id)
      .where('locations.owner_id', req.user.id)
      .select('booking_subscriptions.id')
      .first();

    if (!subscription) {
      return res.status(404).json({ error: 'Abo nicht gefunden oder keine Berechtigung' });
    }

    // Update status to cancelled
    await db('booking_subscriptions')
      .where('id', id)
      .update({
        status: 'cancelled',
        updated_at: new Date()
      });

    res.json({ success: true, message: 'Abo storniert' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Fehler beim Stornieren des Abos' });
  }
});

/**
 * POST /api/booking-subscriptions/:id/generate
 * Generate bookings for a subscription (utility endpoint for testing/manual generation)
 */
router.post('/:id/generate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { months = 1 } = req.body; // Generate bookings for next X months

    // Verify ownership
    const subscription = await db('booking_subscriptions')
      .join('assets', 'booking_subscriptions.asset_id', 'assets.id')
      .join('locations', 'assets.location_id', 'locations.id')
      .where('booking_subscriptions.id', id)
      .where('locations.owner_id', req.user.id)
      .select('booking_subscriptions.*')
      .first();

    if (!subscription) {
      return res.status(404).json({ error: 'Abo nicht gefunden oder keine Berechtigung' });
    }

    if (subscription.status !== 'active') {
      return res.status(400).json({ error: 'Abo ist nicht aktiv' });
    }

    const bookingsCreated = [];
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + months);

    let currentDate = new Date(subscription.start_date);
    if (currentDate < now) {
      currentDate = now;
    }

    // Generate bookings
    while (currentDate <= endDate) {
      let shouldCreateBooking = false;

      if (subscription.frequency === 'weekly') {
        shouldCreateBooking = currentDate.getDay() === subscription.day_of_week;
      } else if (subscription.frequency === 'monthly') {
        shouldCreateBooking = currentDate.getDate() === subscription.day_of_month;
      }

      if (shouldCreateBooking) {
        // Check if subscription end_date is reached
        if (subscription.end_date && currentDate > new Date(subscription.end_date)) {
          break;
        }

        // Create booking datetime
        const [startHour, startMinute] = subscription.start_time.split(':');
        const [endHour, endMinute] = subscription.end_time.split(':');
        
        const bookingStart = new Date(currentDate);
        bookingStart.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
        
        const bookingEnd = new Date(currentDate);
        bookingEnd.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

        // Check if booking already exists
        const existingBooking = await db('bookings')
          .where('asset_id', subscription.asset_id)
          .where('user_id', subscription.user_id)
          .where('start_time', bookingStart.toISOString())
          .where('subscription_id', id)
          .first();

        if (!existingBooking) {
          // Create booking
          const [bookingId] = await db('bookings').insert({
            asset_id: subscription.asset_id,
            user_id: subscription.user_id,
            subscription_id: id,
            start_time: bookingStart.toISOString(),
            end_time: bookingEnd.toISOString(),
            price: subscription.price,
            status: 'confirmed',
            booking_type: 'subscription',
            notes: `Abo-Buchung (${subscription.frequency})`,
            created_at: new Date(),
            updated_at: new Date()
          });

          bookingsCreated.push(bookingId);
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({ 
      success: true, 
      message: `${bookingsCreated.length} Buchungen erstellt`,
      bookings_created: bookingsCreated.length
    });
  } catch (error) {
    console.error('Generate bookings error:', error);
    res.status(500).json({ error: 'Fehler beim Generieren der Buchungen' });
  }
});

module.exports = router;
