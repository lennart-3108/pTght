/**
 * Community League Service
 * Handles lazy creation and management of community leagues
 * 
 * Concept:
 * - Community leagues are created on-demand (when first user tries to join)
 * - They must be published by admin before visible/joinable
 * - One league per location × sport combination
 * - Efficient: Only creates leagues that are actually needed
 */

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
 * Get or create a community league for a location + sport combination
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @param {number} locationId - Location ID
 * @param {number} sportId - Sport ID
 * @param {Object} options - Options: { autoPublish: false }
 * @returns {Promise<Object>} League object
 */
async function getOrCreateCommunityLeague(dbOrCtx, locationId, sportId, options = {}) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  const { autoPublish = false } = options;

  // Check if league already exists
  const existing = await knex('leagues')
    .where({
      location_id: locationId,
      sport_id: sportId,
      level: 'community'
    })
    .first();

  if (existing) {
    return existing;
  }

  // Get location and sport details for league name
  const location = await knex('locations').where({ id: locationId }).first();
  const sport = await knex('sports').where({ id: sportId }).first();

  if (!location || !sport) {
    throw new Error('Location or sport not found');
  }

  // Get city_id from city name
  let cityId = null;
  if (location.city) {
    const city = await knex('cities').where({ name: location.city }).first();
    if (city) cityId = city.id;
  }

  // Create new community league
  const year = new Date().getFullYear();
  const [leagueId] = await knex('leagues').insert({
    name: `${sport.name} Community Liga - ${location.name}`,
    location_id: locationId,
    sport_id: sportId,
    city_id: cityId,
    level: 'community',
    published: autoPublish ? true : false, // Admin must publish
    status: 'inactive', // Will be activated when first match is created
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const league = await knex('leagues').where({ id: leagueId }).first();
  
  // Create season for the league
  const hasSeasons = await knex.schema.hasTable('seasons');
  if (hasSeasons) {
    await knex('seasons').insert({
      league_id: leagueId,
      name: String(year),
      starts_at: `${year}-01-01`,
      ends_at: `${year}-12-31`,
      is_active: 1
    }).catch(e => {
      console.warn('[communityLeagueService] Failed to create season:', e.message);
    });
  }

  return league;
}

/**
 * Get all community leagues for a location
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @param {number} locationId - Location ID
 * @param {Object} options - Options: { publishedOnly: true }
 * @returns {Promise<Array>} Array of leagues
 */
async function getCommunityLeaguesByLocation(dbOrCtx, locationId, options = {}) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  const { publishedOnly = true } = options;

  const query = knex('leagues')
    .where({
      location_id: locationId,
      level: 'community'
    });

  if (publishedOnly) {
    query.where({ published: true });
  }

  return query.select('*');
}

/**
 * Get all community leagues for a sport
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @param {number} sportId - Sport ID
 * @param {Object} options - Options: { publishedOnly: true }
 * @returns {Promise<Array>} Array of leagues
 */
async function getCommunityLeaguesBySport(dbOrCtx, sportId, options = {}) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  const { publishedOnly = true } = options;

  const query = knex('leagues')
    .where({
      sport_id: sportId,
      level: 'community'
    });

  if (publishedOnly) {
    query.where({ published: true });
  }

  return query.select('*');
}

/**
 * Check if a league is a community league
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @param {number} leagueId - League ID
 * @returns {Promise<boolean>}
 */
async function isCommunityLeague(dbOrCtx, leagueId) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) return false;

  const league = await knex('leagues')
    .where({ id: leagueId })
    .first();

  return league && league.level === 'community';
}

/**
 * Publish/unpublish a community league (admin only)
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @param {number} leagueId - League ID
 * @param {boolean} published - Published state
 * @returns {Promise<Object>} Updated league
 */
async function setCommunityLeaguePublished(dbOrCtx, leagueId, published) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  await knex('leagues')
    .where({ id: leagueId, level: 'community' })
    .update({
      published,
      updated_at: new Date().toISOString()
    });

  return knex('leagues').where({ id: leagueId }).first();
}

/**
 * Get community league statistics
 * @param {Object} dbOrCtx - Database connection or ctx object
 * @returns {Promise<Object>} Statistics
 */
async function getCommunityLeagueStats(dbOrCtx) {
  const knex = resolveKnex(dbOrCtx.db || dbOrCtx);
  if (!knex) throw new Error('Database connection required');

  const [total, published, withMembers] = await Promise.all([
    knex('leagues').where({ level: 'community' }).count('* as count').first(),
    knex('leagues').where({ level: 'community', published: true }).count('* as count').first(),
    knex('leagues as l')
      .leftJoin('user_leagues as ul', 'ul.league_id', 'l.id')
      .where({ 'l.level': 'community' })
      .whereNotNull('ul.user_id')
      .countDistinct('l.id as count')
      .first()
  ]);

  return {
    total: total?.count || 0,
    published: published?.count || 0,
    withMembers: withMembers?.count || 0
  };
}

module.exports = {
  getOrCreateCommunityLeague,
  getCommunityLeaguesByLocation,
  getCommunityLeaguesBySport,
  isCommunityLeague,
  setCommunityLeaguePublished,
  getCommunityLeagueStats
};
