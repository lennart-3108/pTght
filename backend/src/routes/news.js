/**
 * News/Feed routes - matches with photos, likes, sorted by popularity
 */
const express = require('express');
const router = express.Router();

// Middleware
const { isAuthenticated } = require('../middleware/auth');

/**
 * GET /api/news/feed
 * Query params:
 * - filter: 'popular' | 'home' | 'all'
 * - days: number of days to include (default: 7)
 * - limit: matches per day (default: 3)
 * - page: for pagination on "alle anzeigen" page
 */
router.get('/feed', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const knex = db && (db.knex || db);
    if (!knex) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

    const filter = req.query.filter || 'popular';
    const days = parseInt(req.query.days) || 7;
    const limitPerDay = parseInt(req.query.limit) || 3;
    const page = parseInt(req.query.page) || 1;
    const userId = req.user?.id || null;

    // Base query: completed or upcoming matches with photos
    let query = knex('matches as m')
      .select([
        'm.id',
        'm.kickoff_at',
        'm.kickoff_end_at',
        'm.home_user_id',
        'm.away_user_id',
        'm.home_score',
        'm.away_score',
        'm.status',
        'm.photos',
        'm.cover_photo',
        knex.raw('COALESCE(m.likes, 0) as likes'),
        'l.name as league',
        's.name as sport',
        'c.name as city',
        'st.name as state',
        'co.name as country'
      ])
      .leftJoin('leagues as l', 'l.id', 'm.league_id')
      .leftJoin('sports as s', 's.id', 'l.sport_id')
      .leftJoin('cities as c', 'c.id', 'l.city_id')
      .leftJoin('states as st', 'st.id', 'c.state_id')
      .leftJoin('countries as co', 'co.id', 'c.country_id')
      .whereIn('m.status', ['completed', 'scheduled', 'confirmed'])
      .whereNotNull('m.photos');

    // Date filter: last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    query.where('m.kickoff_at', '>=', startDate.toISOString());

    // Apply filter
    if (filter === 'home' && userId) {
      // User's city from profile
      const userProfile = await knex('users')
        .select('city_id')
        .where('id', userId)
        .first();
      
      if (userProfile?.city_id) {
        query.where('c.id', userProfile.city_id);
      }
    }
    // 'popular' and 'all' don't need additional filters

    // Get all matches
    const allMatches = await query;

    // Group by day
    const matchesByDay = {};
    allMatches.forEach(match => {
      const date = new Date(match.kickoff_at).toISOString().split('T')[0];
      if (!matchesByDay[date]) matchesByDay[date] = [];
      matchesByDay[date].push(match);
    });

    // Sort within each day by likes (descending), then by created_at (newest first)
    const result = [];
    Object.keys(matchesByDay)
      .sort((a, b) => new Date(b) - new Date(a)) // Newest days first
      .forEach(date => {
        const dayMatches = matchesByDay[date]
          .sort((a, b) => {
            if (b.likes !== a.likes) return b.likes - a.likes; // Most likes first
            return new Date(b.kickoff_at) - new Date(a.kickoff_at); // Newest first
          })
          .slice(0, limitPerDay); // Top 3 per day
        
        result.push({
          date,
          matches: dayMatches
        });
      });

    // Enrich with user names
    for (const dayGroup of result) {
      for (const match of dayGroup.matches) {
        if (match.home_user_id) {
          const homeUser = await knex('users')
            .select('firstname', 'lastname', 'name', 'email')
            .where('id', match.home_user_id)
            .first();
          
          if (homeUser) {
            const parts = [];
            if (homeUser.firstname) parts.push(homeUser.firstname);
            if (homeUser.lastname) parts.push(homeUser.lastname);
            match.home = parts.length > 0 ? parts.join(' ') : (homeUser.name || homeUser.email || `User ${match.home_user_id}`);
          }
        }
        
        if (match.away_user_id) {
          const awayUser = await knex('users')
            .select('firstname', 'lastname', 'name', 'email')
            .where('id', match.away_user_id)
            .first();
          
          if (awayUser) {
            const parts = [];
            if (awayUser.firstname) parts.push(awayUser.firstname);
            if (awayUser.lastname) parts.push(awayUser.lastname);
            match.away = parts.length > 0 ? parts.join(' ') : (awayUser.name || awayUser.email || `User ${match.away_user_id}`);
          }
        }
      }
    }

    res.json(result);
  } catch (err) {
    console.error('[GET /news/feed] error:', err);
    res.status(500).json({ error: 'FEED_LOAD_FAILED' });
  }
});

/**
 * POST /api/matches/:id/photos
 * Upload photos for a match (requires auth + participation)
 */
router.post('/matches/:id/photos', isAuthenticated, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const knex = db && (db.knex || db);
    if (!knex) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

    const matchId = parseInt(req.params.id);
    const { photos, coverPhoto } = req.body;

    // Check if user is participant
    const match = await knex('matches')
      .where('id', matchId)
      .first();

    if (!match) {
      return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
    }

    const userId = req.user.id;
    if (match.home_user_id !== userId && match.away_user_id !== userId) {
      return res.status(403).json({ error: 'NOT_PARTICIPANT' });
    }

    // Update photos
    const updateData = {};
    if (photos) {
      updateData.photos = JSON.stringify(photos);
    }
    if (coverPhoto) {
      updateData.cover_photo = coverPhoto;
    }

    await knex('matches')
      .where('id', matchId)
      .update(updateData);

    res.json({ success: true });
  } catch (err) {
    console.error('[POST /matches/:id/photos] error:', err);
    res.status(500).json({ error: 'PHOTO_UPLOAD_FAILED' });
  }
});

/**
 * POST /api/matches/:id/like
 * Toggle like on a match
 */
router.post('/matches/:id/like', isAuthenticated, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const knex = db && (db.knex || db);
    if (!knex) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

    const matchId = parseInt(req.params.id);
    const userId = req.user.id;

    // Check if like exists
    const existingLike = await knex('match_likes')
      .where({ match_id: matchId, user_id: userId })
      .first();

    if (existingLike) {
      // Unlike
      await knex('match_likes')
        .where({ match_id: matchId, user_id: userId })
        .delete();
      
      await knex('matches')
        .where('id', matchId)
        .decrement('likes', 1);
      
      res.json({ liked: false });
    } else {
      // Like
      await knex('match_likes').insert({
        match_id: matchId,
        user_id: userId,
        created_at: new Date().toISOString()
      });
      
      await knex('matches')
        .where('id', matchId)
        .increment('likes', 1);
      
      res.json({ liked: true });
    }
  } catch (err) {
    console.error('[POST /matches/:id/like] error:', err);
    res.status(500).json({ error: 'LIKE_FAILED' });
  }
});

module.exports = router;
