/**
 * Community League Service v2
 * Handles lazy creation and management of community leagues with mini-leagues
 *
 * Concept:
 * - community_leagues: Umbrella leagues per sport + city (lazy creation)
 * - Mini-leagues: Auto-generated leagues with max participants from sports.league_members
 * - Users join community league → assigned to next available mini-league
 * - 6-month seasons (Spring/Fall start), weekly games, round-robin with home/away
 */

const moment = require('moment-timezone');

function resolveKnex(db) {
  if (!db) return null;

  // Direct knex instance
  if (typeof db === 'function' && db.client) return db;
  if (db.client && typeof db.raw === 'function') return db;

  // Adapter with knex property
  if (db.knex && db.knex.client) return db.knex;

  // Try common patterns
  if (db.db && typeof db.db === 'function' && db.db.client) return db.db;
  if (db.db && db.db.knex && db.db.knex.client) return db.db.knex;

  return null;
}

/**
 * Get max participants for a sport's mini-leagues
 * @param {Object} knex - Knex instance
 * @param {number} sportId - Sport ID
 * @returns {Promise<number>} Max participants (default: 10)
 */
async function getMaxParticipantsForSport(knex, sportId) {
  const sport = await knex('sports').where({ id: sportId }).select('league_members').first();
  return sport?.league_members || 10;
}

/**
 * Calculate season dates (exactly 6 months, starting at next official Spring/Fall begin)
 * Always returns future seasons, never past ones
 * @returns {Object} { start: moment, end: moment }
 */
function calculateSeasonDates() {
  const now = moment();
  const currentMonth = now.month() + 1; // 1-12
  const currentYear = now.year();

  let seasonStart, seasonEnd;

  if (currentMonth >= 3 && currentMonth <= 8) {
    // Spring/Summer season (March-August)
    seasonStart = moment().year(currentYear).month(2).date(1); // March 1 this year
    seasonEnd = moment().year(currentYear).month(7).date(31); // August 31 this year
  } else {
    // Fall/Winter season (September-February)
    seasonStart = moment().year(currentYear).month(8).date(1); // September 1 this year
    seasonEnd = moment().year(currentYear + 1).month(1).date(28); // February 28 next year
  }

  // If current season hasn't started yet, use it; otherwise, use next season
  if (now.isBefore(seasonStart)) {
    return { start: seasonStart, end: seasonEnd };
  } else {
    // Calculate next season
    if (currentMonth >= 3 && currentMonth <= 8) {
      // Next is Fall
      seasonStart = moment().year(currentYear).month(8).date(1); // September 1 this year
      seasonEnd = moment().year(currentYear + 1).month(1).date(28); // February 28 next year
    } else {
      // Next is Spring
      seasonStart = moment().year(currentYear + 1).month(2).date(1); // March 1 next year
      seasonEnd = moment().year(currentYear + 1).month(7).date(31); // August 31 next year
    }
    return { start: seasonStart, end: seasonEnd };
  }
}

/**
 * Get or create a community league (umbrella) for sport + city
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @param {number} sportId - Sport ID
 * @param {number} cityId - City ID
 * @returns {Promise<Object>} Community league object
 */
async function getOrCreateCommunityLeague(dbOrCtx, sportId, cityId) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  // Check if community league already exists
  let communityLeague = await knex('community_leagues')
    .where({ sport_id: sportId, city_id: cityId })
    .first();

  if (communityLeague) {
    return communityLeague;
  }

  // Lazy creation: Create community league when first user joins
  const [communityLeagueId] = await knex('community_leagues').insert({
    sport_id: sportId,
    city_id: cityId,
    active: true,
    created_at: new Date(),
    updated_at: new Date()
  });

  communityLeague = await knex('community_leagues')
    .where({ id: communityLeagueId })
    .first();

  return communityLeague;
}

/**
 * Join a community league - assigns user to next available mini-league
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @param {number} userId - User ID
 * @param {number} sportId - Sport ID
 * @param {number} cityId - City ID
 * @returns {Promise<Object>} Join result with assigned mini-league
 */
async function joinCommunityLeague(dbOrCtx, userId, sportId, cityId) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  return await knex.transaction(async (trx) => {
    // Check if user is already in any mini-league for this community
    const existingMembership = await trx('user_leagues as ul')
      .join('leagues as l', 'l.id', 'ul.league_id')
      .join('community_leagues as cl', 'cl.id', 'l.community_league_id')
      .where({
        'ul.user_id': userId,
        'cl.sport_id': sportId,
        'cl.city_id': cityId
      })
      .first();

    if (existingMembership) {
      throw new Error('User is already member of a mini-league in this community league');
    }

    // Get or create community league
    const communityLeague = await getOrCreateCommunityLeague({ db: trx }, sportId, cityId);

    // Get max participants for this sport
    const maxParticipants = await getMaxParticipantsForSport(trx, sportId);

    // Find next available mini-league (with < maxParticipants members)
    const availableMiniLeague = await trx('leagues as l')
      .leftJoin('user_leagues as ul', 'ul.league_id', 'l.id')
      .where({
        'l.community_league_id': communityLeague.id,
        'l.is_community_mini_league': true,
        'l.active': true
      })
      .groupBy('l.id', 'l.name', 'l.sport_id', 'l.city_id', 'l.community_league_id', 'l.is_community_mini_league', 'l.active', 'l.created_at', 'l.updated_at')
      .havingRaw(`COUNT(ul.user_id) < ${maxParticipants}`)
      .orderBy('l.id')
      .first();

    let assignedMiniLeague;

    if (availableMiniLeague) {
      // Assign to existing mini-league
      assignedMiniLeague = availableMiniLeague;
    } else {
      // Create new mini-league
      const sport = await trx('sports').where({ id: sportId }).first();
      const city = await trx('cities').where({ id: cityId }).first();

      if (!sport || !city) {
        throw new Error('Sport or city not found');
      }

      // Count existing mini-leagues for this community to determine number
      const miniLeagueCount = await trx('leagues')
        .where({
          community_league_id: communityLeague.id,
          is_community_mini_league: true
        })
        .count('* as count')
        .first();

      const miniLeagueNumber = (miniLeagueCount?.count || 0) + 1;
      const communityLeagueName = `${sport.name} Community Liga - ${city.name}`;
      const miniLeagueName = `${communityLeagueName} ${miniLeagueNumber}`;

      // Calculate season dates
      const { start: seasonStart, end: seasonEnd } = calculateSeasonDates();

      const [miniLeagueId] = await trx('leagues').insert({
        name: miniLeagueName,
        sport_id: sportId,
        city_id: cityId,
        community_league_id: communityLeague.id,
        is_community_mini_league: true,
        active: true,
        status: 'active',
        start_date: seasonStart.format('YYYY-MM-DD'),
        end_date: seasonEnd.format('YYYY-MM-DD'),
        created_at: new Date(),
        updated_at: new Date()
      });

      assignedMiniLeague = await trx('leagues').where({ id: miniLeagueId }).first();
    }

    // Add user to the mini-league
    await trx('user_leagues').insert({
      user_id: userId,
      league_id: assignedMiniLeague.id,
      joined_at: new Date()
    });

    const memberCount = await trx('user_leagues')
      .where({ league_id: assignedMiniLeague.id })
      .count('* as count')
      .first()
      .then(r => r.count);

    return {
      communityLeague,
      miniLeague: assignedMiniLeague,
      memberCount: memberCount,
      maxParticipants: maxParticipants
    };
  });
}

/**
 * Get all active community leagues
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @returns {Promise<Array>} Array of community leagues with sport/city details
 */
async function getCommunityLeagues(dbOrCtx) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  return await knex('community_leagues as cl')
    .join('sports as s', 's.id', 'cl.sport_id')
    .join('cities as c', 'c.id', 'cl.city_id')
    .where({ 'cl.active': true })
    .select(
      'cl.id',
      'cl.sport_id',
      'cl.city_id',
      'cl.active',
      'cl.created_at',
      'cl.updated_at',
      's.name as sport_name',
      'c.name as city_name'
    )
    .orderBy('s.name', 'c.name');
}

/**
 * Get user's community league memberships
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of user's mini-league memberships
 */
async function getUserCommunityLeagues(dbOrCtx, userId) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  return await knex('user_leagues as ul')
    .join('leagues as l', 'l.id', 'ul.league_id')
    .join('community_leagues as cl', 'cl.id', 'l.community_league_id')
    .join('sports as s', 's.id', 'cl.sport_id')
    .join('cities as c', 'c.id', 'cl.city_id')
    .where({ 'ul.user_id': userId, 'l.active': true })
    .select(
      'l.id as mini_league_id',
      'l.name as mini_league_name',
      'cl.id as community_league_id',
      's.name as sport_name',
      'c.name as city_name',
      'ul.joined_at'
    );
}

/**
 * Get mini-leagues for a community league
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @param {number} communityLeagueId - Community league ID
 * @returns {Promise<Array>} Array of mini-leagues with member counts
 */
async function getMiniLeagues(dbOrCtx, communityLeagueId) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  const miniLeagues = await knex('leagues as l')
    .leftJoin('user_leagues as ul', 'ul.league_id', 'l.id')
    .where({ 'l.community_league_id': communityLeagueId, 'l.active': true })
    .groupBy('l.id', 'l.name', 'l.sport_id', 'l.city_id', 'l.community_league_id', 'l.active', 'l.start_date', 'l.end_date', 'l.created_at', 'l.updated_at')
    .select(
      'l.id',
      'l.name',
      'l.start_date',
      'l.end_date',
      knex.raw('COUNT(ul.user_id) as member_count')
    )
    .orderBy('l.id');

  return miniLeagues;
}

/**
 * Auto-pairing for weekly games in mini-leagues
 * Prioritizes opponents not played or least played against
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @param {number} miniLeagueId - Mini-league ID
 * @returns {Promise<Array>} Array of created matches
 */
async function createWeeklyPairings(dbOrCtx, miniLeagueId) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  return await knex.transaction(async (trx) => {
    // Get active members of the mini-league
    const members = await trx('user_leagues as ul')
      .join('users as u', 'u.id', 'ul.user_id')
      .where({ 'ul.league_id': miniLeagueId })
      .select('u.id', 'u.firstname', 'u.lastname');

    if (members.length < 2) {
      return []; // Need at least 2 players
    }

    // Get existing matches in this league to track played opponents
    const existingMatches = await trx('matches')
      .where({ league_id: miniLeagueId })
      .whereNotNull('home_score') // Only completed matches
      .whereNotNull('away_score')
      .select('home_user_id', 'away_user_id');

    // Build opponent play count matrix
    const playCounts = {};
    members.forEach(member => {
      playCounts[member.id] = {};
      members.forEach(opponent => {
        if (member.id !== opponent.id) {
          playCounts[member.id][opponent.id] = 0;
        }
      });
    });

    existingMatches.forEach(match => {
      if (playCounts[match.home_user_id] && playCounts[match.home_user_id][match.away_user_id] !== undefined) {
        playCounts[match.home_user_id][match.away_user_id]++;
      }
      if (playCounts[match.away_user_id] && playCounts[match.away_user_id][match.home_user_id] !== undefined) {
        playCounts[match.away_user_id][match.home_user_id]++;
      }
    });

    // Generate pairings: prioritize opponents with lowest play count
    const pairings = [];
    const availablePlayers = [...members.map(m => m.id)];

    while (availablePlayers.length >= 2) {
      const player1 = availablePlayers.shift();

      // Find opponent with lowest play count against player1
      let bestOpponent = null;
      let lowestCount = Infinity;

      availablePlayers.forEach(player2 => {
        const count = playCounts[player1][player2];
        if (count < lowestCount) {
          lowestCount = count;
          bestOpponent = player2;
        }
      });

      if (bestOpponent) {
        pairings.push([player1, bestOpponent]);
        availablePlayers.splice(availablePlayers.indexOf(bestOpponent), 1);
      }
    }

    // Create matches for next week
    const nextWeek = moment().add(1, 'week').startOf('week').add(3, 'days'); // Next Wednesday
    const createdMatches = [];

    for (const [homeId, awayId] of pairings) {
      const [matchId] = await trx('matches').insert({
        league_id: miniLeagueId,
        home_user_id: homeId,
        away_user_id: awayId,
        kickoff_at: nextWeek.toDate(),
        status: 'scheduled',
        created_at: new Date(),
        updated_at: new Date()
      });

      createdMatches.push(await trx('matches').where({ id: matchId }).first());
    }

    return createdMatches;
  });
}

module.exports = {
  getOrCreateCommunityLeague,
  joinCommunityLeague,
  getCommunityLeagues,
  getUserCommunityLeagues,
  getMiniLeagues,
  createWeeklyPairings
};
