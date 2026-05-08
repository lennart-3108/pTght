/**
 * Weekly Community League Pairing Job
 * Runs weekly to create pairings for all active mini-leagues in community leagues
 * Prioritizes opponents not played or least played against
 */

const communityLeagueService = require('../services/communityLeagueService');

function resolveKnex(db) {
  if (!db) throw new Error('No db');
  if (typeof db === 'function' && db.client) return db;
  if (db.client && typeof db.raw === 'function') return db;
  if (db.knex && db.knex.client) return db.knex;
  throw new Error('Unsupported db adapter');
}

/**
 * Run weekly pairing for all active community league mini-leagues
 * @param {Object} db - Database connection
 * @param {Function} onLog - Logging function
 * @returns {Promise<Object>} Results summary
 */
async function runWeeklyCommunityPairing(db, onLog = () => {}) {
  const k = resolveKnex(db);

  onLog('[weeklyCommunityPairing] Starting weekly pairing job...');

  try {
    // Get all active community leagues
    const communityLeagues = await communityLeagueService.getCommunityLeagues({ db: k });

    let totalMatchesCreated = 0;
    let processedMiniLeagues = 0;

    for (const communityLeague of communityLeagues) {
      onLog(`[weeklyCommunityPairing] Processing community league: ${communityLeague.sport_name} - ${communityLeague.city_name}`);

      // Get all mini-leagues for this community league
      const miniLeagues = await communityLeagueService.getMiniLeagues({ db: k }, communityLeague.id);

      for (const miniLeague of miniLeagues) {
        try {
          onLog(`[weeklyCommunityPairing] Creating pairings for mini-league: ${miniLeague.name} (${miniLeague.member_count} members)`);

          // Create weekly pairings for this mini-league
          const createdMatches = await communityLeagueService.createWeeklyPairings({ db: k }, miniLeague.id);

          totalMatchesCreated += createdMatches.length;
          processedMiniLeagues++;

          onLog(`[weeklyCommunityPairing] Created ${createdMatches.length} matches for mini-league ${miniLeague.id}`);

        } catch (error) {
          onLog(`[weeklyCommunityPairing] Error processing mini-league ${miniLeague.id}: ${error.message}`);
        }
      }
    }

    onLog(`[weeklyCommunityPairing] Completed. Processed ${processedMiniLeagues} mini-leagues, created ${totalMatchesCreated} matches.`);

    return {
      success: true,
      processedMiniLeagues,
      totalMatchesCreated
    };

  } catch (error) {
    onLog(`[weeklyCommunityPairing] Job failed: ${error.message}`);
    throw error;
  }
}

module.exports = { runWeeklyCommunityPairing };