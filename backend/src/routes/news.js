/**
 * News/Notifications routes
 */
const express = require('express');
const { createMiddleware } = require('./middleware');

function resolveKnex(db) {
  if (db?.client && typeof db.raw === 'function') return db;
  if (db?.knex?.client) return db.knex;
  try { return require('../../db'); } catch { return null; }
}

module.exports = (ctx) => {
  const router = express.Router();
  const { db } = ctx;
  const { requireAuth } = createMiddleware(ctx);
  let knexInstance = null;

  function getKnex() {
    knexInstance = knexInstance || resolveKnex(db);
    if (!knexInstance) throw new Error('DB_NOT_AVAILABLE');
    return knexInstance;
  }

  /**
   * GET /api/news
   * Returns user notifications (friend requests, schedule proposals, etc.)
   */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const knex = getKnex();
      if (!knex) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 50;

      // Get notifications with additional data
      const notifications = await knex('notifications as n')
        .select([
          'n.id',
          'n.type',
          'n.match_id as matchId',
          'n.from_user_id as fromUserId',
          'n.proposal_id as proposalId',
          'n.title',
          'n.message as details',
          'n.created_at as timestamp',
          'n.is_read as isRead'
        ])
        .where('n.user_id', userId)
        .orderBy('n.created_at', 'desc')
        .limit(limit);

      // Enrich with additional data
      for (const notif of notifications) {
        // Get match info if available
        if (notif.matchId) {
          const match = await knex('matches as m')
            .select([
              'm.id',
              'l.id as leagueId',
              'l.name as leagueName',
              's.name as sportName'
            ])
            .leftJoin('leagues as l', 'l.id', 'm.league_id')
            .leftJoin('sports as s', 's.id', 'l.sport_id')
            .where('m.id', notif.matchId)
            .first();

          if (match) {
            notif.leagueId = match.leagueId;
            notif.leagueName = match.leagueName;
            notif.sportName = match.sportName;
          }
        }

        // Get user info if available
        if (notif.fromUserId) {
          const user = await knex('users')
            .select(['id', 'firstname', 'lastname', 'email', 'avatar_url'])
            .where('id', notif.fromUserId)
            .first();

          if (user) {
            const parts = [];
            if (user.firstname) parts.push(user.firstname);
            if (user.lastname) parts.push(user.lastname);
            notif.fromUserName = parts.length > 0 ? parts.join(' ') : (user.email || `User ${user.id}`);
            notif.fromName = notif.fromUserName;
            notif.avatarUrl = user.avatar_url;
          }
        }

        // For schedule proposals, get proposer info
        if (notif.type === 'schedule_proposal' && notif.proposalId) {
          const proposal = await knex('match_schedule_proposals')
            .where('id', notif.proposalId)
            .first();

          if (proposal) {
            notif.proposerUserId = proposal.proposer_user_id;
            
            const proposer = await knex('users')
              .select(['id', 'firstname', 'lastname', 'email', 'avatar_url'])
              .where('id', proposal.proposer_user_id)
              .first();

            if (proposer) {
              const parts = [];
              if (proposer.firstname) parts.push(proposer.firstname);
              if (proposer.lastname) parts.push(proposer.lastname);
              notif.proposerName = parts.length > 0 ? parts.join(' ') : (proposer.email || `User ${proposer.id}`);
              notif.avatarUrl = proposer.avatar_url;
            }
          }
        }
      }

      res.json({ items: notifications });
    } catch (err) {
      console.error('[GET /news] error:', err);
      res.status(500).json({ error: 'NOTIFICATIONS_LOAD_FAILED' });
    }
  });

  /**
   * GET /api/news/feed
   * Query params:
   * - filter: 'popular' | 'home' | 'all'
   * - days: number of days to include (default: 7)
   * - limit: matches per day (default: 3)
   */
  router.get('/feed', async (req, res) => {
    try {
      const knex = getKnex();
      if (!knex) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

      const filter = req.query.filter || 'popular';
      const days = parseInt(req.query.days) || 7;
      const limitPerDay = parseInt(req.query.limit) || 3;
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
        const userProfile = await knex('users')
          .select('city_id')
          .where('id', userId)
          .first();
        
        if (userProfile?.city_id) {
          query.where('c.id', userProfile.city_id);
        }
      }

      // Get all matches
      const allMatches = await query;

      // Group by day
      const matchesByDay = {};
      allMatches.forEach(match => {
        const date = new Date(match.kickoff_at).toISOString().split('T')[0];
        if (!matchesByDay[date]) matchesByDay[date] = [];
        matchesByDay[date].push(match);
      });

      // Sort within each day
      const result = [];
      Object.keys(matchesByDay)
        .sort((a, b) => new Date(b) - new Date(a))
        .forEach(date => {
          const dayMatches = matchesByDay[date]
            .sort((a, b) => {
              if (b.likes !== a.likes) return b.likes - a.likes;
              return new Date(b.kickoff_at) - new Date(a.kickoff_at);
            })
            .slice(0, limitPerDay);
          
          result.push({ date, matches: dayMatches });
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

  return router;
};
