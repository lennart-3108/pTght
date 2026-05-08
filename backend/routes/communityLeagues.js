/**
 * Community Leagues v2 API Routes
 * Handles community league operations: listing, joining, user memberships
 */

const express = require('express');
const router = express.Router();
const communityLeagueService = require('../src/services/communityLeagueService');

/**
 * GET /api/community-leagues
 * Get all active community leagues
 */
router.get('/', async (req, res) => {
  try {
    const communityLeagues = await communityLeagueService.getCommunityLeagues(req);
    res.json({ communityLeagues });
  } catch (error) {
    console.error('[CommunityLeagues] Error fetching community leagues:', error);
    res.status(500).json({ error: 'Failed to fetch community leagues' });
  }
});

/**
 * POST /api/community-leagues/join
 * Join a community league (requires authentication)
 * Body: { sportId: number, cityId: number }
 */
router.post('/join', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { sportId, cityId } = req.body;

    if (!sportId || !cityId) {
      return res.status(400).json({
        error: 'sportId and cityId are required',
        required: ['sportId', 'cityId']
      });
    }

    // Validate sport exists
    const sport = await req.db('sports').where({ id: sportId }).first();
    if (!sport) {
      return res.status(400).json({ error: 'Invalid sport ID' });
    }

    // Validate city exists
    const city = await req.db('cities').where({ id: cityId }).first();
    if (!city) {
      return res.status(400).json({ error: 'Invalid city ID' });
    }

    const joinResult = await communityLeagueService.joinCommunityLeague(req, userId, sportId, cityId);

    res.json({
      success: true,
      message: 'Successfully joined community league',
      data: joinResult
    });

  } catch (error) {
    console.error('[CommunityLeagues] Error joining community league:', error);

    if (error.message.includes('already member')) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to join community league' });
  }
});

/**
 * GET /api/community-leagues/my
 * Get current user's community league memberships (requires authentication)
 */
router.get('/my', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const memberships = await communityLeagueService.getUserCommunityLeagues(req, userId);
    res.json({ memberships });

  } catch (error) {
    console.error('[CommunityLeagues] Error fetching user memberships:', error);
    res.status(500).json({ error: 'Failed to fetch community league memberships' });
  }
});

/**
 * GET /api/community-leagues/:communityLeagueId/mini-leagues
 * Get mini-leagues for a specific community league
 */
router.get('/:communityLeagueId/mini-leagues', async (req, res) => {
  try {
    const { communityLeagueId } = req.params;
    const communityLeagueIdNum = parseInt(communityLeagueId, 10);

    if (isNaN(communityLeagueIdNum)) {
      return res.status(400).json({ error: 'Invalid community league ID' });
    }

    // Verify community league exists
    const communityLeague = await req.db('community_leagues')
      .where({ id: communityLeagueIdNum, active: true })
      .first();

    if (!communityLeague) {
      return res.status(404).json({ error: 'Community league not found' });
    }

    const miniLeagues = await communityLeagueService.getMiniLeagues(req, communityLeagueIdNum);
    res.json({ miniLeagues });

  } catch (error) {
    console.error('[CommunityLeagues] Error fetching mini-leagues:', error);
    res.status(500).json({ error: 'Failed to fetch mini-leagues' });
  }
});

/**
 * POST /api/community-leagues/mini-leagues/:miniLeagueId/pairings
 * Create weekly pairings for a mini-league (admin only)
 */
router.post('/mini-leagues/:miniLeagueId/pairings', async (req, res) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.is_admin;

    if (!userId || !isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { miniLeagueId } = req.params;
    const miniLeagueIdNum = parseInt(miniLeagueId, 10);

    if (isNaN(miniLeagueIdNum)) {
      return res.status(400).json({ error: 'Invalid mini-league ID' });
    }

    // Verify mini-league exists and is active
    const miniLeague = await req.db('leagues')
      .where({ id: miniLeagueIdNum, active: true })
      .first();

    if (!miniLeague) {
      return res.status(404).json({ error: 'Mini-league not found' });
    }

    const createdMatches = await communityLeagueService.createWeeklyPairings(req, miniLeagueIdNum);

    res.json({
      success: true,
      message: `Created ${createdMatches.length} pairings for next week`,
      matches: createdMatches
    });

  } catch (error) {
    console.error('[CommunityLeagues] Error creating pairings:', error);
    res.status(500).json({ error: 'Failed to create pairings' });
  }
});

module.exports = router;