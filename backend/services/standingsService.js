const db = require('../db');
const resultDecision = require('./resultDecision');

/**
 * Standings Service
 * Updates league standings table when match results are confirmed/adjudicated
 */
class StandingsService {
  /**
   * Update standings for a specific match result
   * @param {number} resultId - ID of the result that was accepted/adjudicated
   */
  async updateStandingsForResult(resultId) {
    // Get result with match and ruleset details
    const result = await db('results')
      .select(
        'results.*',
        'matches.league_id',
        'matches.home_team_id',
        'matches.away_team_id',
        'matches.season_id',
        'rulesets.config as ruleset_config'
      )
      .leftJoin('matches', 'results.match_id', 'matches.id')
      .leftJoin('rulesets', 'results.ruleset_id', 'rulesets.id')
      .where('results.id', resultId)
      .first();

    if (!result) {
      throw new Error(`Result ${resultId} not found`);
    }

    if (!['accepted', 'adjudicated'].includes(result.status)) {
      throw new Error(`Cannot update standings for result with status: ${result.status}`);
    }

    // Parse data
    const resultData = JSON.parse(result.result_data);
    const metadata = JSON.parse(result.metadata);
    const ruleset = { config: result.ruleset_config };

    // Get decision for standings calculation
    const decision = {
      winner: result.winner,
      homePoints: result.home_points,
      awayPoints: result.away_points,
      metadata
    };

    // Update standings for both teams
    await this.updateTeamStanding(
      result.league_id,
      result.season_id,
      result.home_team_id,
      decision,
      'home'
    );

    await this.updateTeamStanding(
      result.league_id,
      result.season_id,
      result.away_team_id,
      decision,
      'away'
    );

    return {
      league_id: result.league_id,
      season_id: result.season_id,
      teams_updated: [result.home_team_id, result.away_team_id]
    };
  }

  /**
   * Update standings for a single team
   */
  async updateTeamStanding(leagueId, seasonId, teamId, decision, perspective) {
    // Get current standing or create new
    let standing = await db('standings')
      .where({
        league_id: leagueId,
        season_id: seasonId,
        team_id: teamId
      })
      .first();

    // Calculate updates from decision
    const updates = resultDecision.getStandingsUpdate(decision, perspective);

    if (standing) {
      // Update existing standing
      await db('standings')
        .where({ id: standing.id })
        .update({
          played: standing.played + updates.played,
          wins: standing.wins + updates.wins,
          draws: standing.draws + updates.draws,
          losses: standing.losses + updates.losses,
          points: standing.points + updates.points,
          
          // Sport-specific stats (simple_score)
          goals_for: (standing.goals_for || 0) + (updates.goals_for || 0),
          goals_against: (standing.goals_against || 0) + (updates.goals_against || 0),
          goal_diff: (standing.goal_diff || 0) + (updates.goal_diff || 0),
          
          // Sport-specific stats (sets_score)
          sets_for: (standing.sets_for || 0) + (updates.sets_for || 0),
          sets_against: (standing.sets_against || 0) + (updates.sets_against || 0),
          sets_diff: (standing.sets_diff || 0) + (updates.sets_diff || 0),
          games_for: (standing.games_for || 0) + (updates.games_for || 0),
          games_against: (standing.games_against || 0) + (updates.games_against || 0),
          games_diff: (standing.games_diff || 0) + (updates.games_diff || 0),
          
          updated_at: new Date()
        });
    } else {
      // Create new standing
      await db('standings').insert({
        league_id: leagueId,
        season_id: seasonId,
        team_id: teamId,
        played: updates.played,
        wins: updates.wins,
        draws: updates.draws,
        losses: updates.losses,
        points: updates.points,
        
        // Simple score stats
        goals_for: updates.goals_for || null,
        goals_against: updates.goals_against || null,
        goal_diff: updates.goal_diff || null,
        
        // Sets score stats
        sets_for: updates.sets_for || null,
        sets_against: updates.sets_against || null,
        sets_diff: updates.sets_diff || null,
        games_for: updates.games_for || null,
        games_against: updates.games_against || null,
        games_diff: updates.games_diff || null,
        
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }

  /**
   * Recalculate standings for entire league (from scratch)
   * Useful for fixing inconsistencies or handling rule changes
   */
  async recalculateLeagueStandings(leagueId, seasonId) {
    // Clear existing standings
    await db('standings')
      .where({ league_id: leagueId, season_id: seasonId })
      .delete();

    // Get all accepted/adjudicated results for this league/season
    const results = await db('results')
      .select(
        'results.*',
        'matches.home_team_id',
        'matches.away_team_id',
        'rulesets.config as ruleset_config'
      )
      .leftJoin('matches', 'results.match_id', 'matches.id')
      .leftJoin('rulesets', 'results.ruleset_id', 'rulesets.id')
      .where('matches.league_id', leagueId)
      .where('matches.season_id', seasonId)
      .whereIn('results.status', ['accepted', 'adjudicated'])
      .orderBy('results.created_at', 'asc');

    // Process each result
    for (const result of results) {
      const metadata = JSON.parse(result.metadata);
      const decision = {
        winner: result.winner,
        homePoints: result.home_points,
        awayPoints: result.away_points,
        metadata
      };

      await this.updateTeamStanding(
        leagueId,
        seasonId,
        result.home_team_id,
        decision,
        'home'
      );

      await this.updateTeamStanding(
        leagueId,
        seasonId,
        result.away_team_id,
        decision,
        'away'
      );
    }

    return {
      league_id: leagueId,
      season_id: seasonId,
      results_processed: results.length
    };
  }

  /**
   * Get current standings for a league
   */
  async getStandings(leagueId, seasonId, options = {}) {
    const query = db('standings')
      .select(
        'standings.*',
        'teams.name as team_name'
      )
      .leftJoin('teams', 'standings.team_id', 'teams.id')
      .where('standings.league_id', leagueId);

    if (seasonId) {
      query.where('standings.season_id', seasonId);
    }

    // Apply sorting based on sport type
    // Default: points desc, goal_diff desc, goals_for desc
    const orderBy = options.orderBy || [
      { column: 'points', order: 'desc' },
      { column: 'goal_diff', order: 'desc' },
      { column: 'goals_for', order: 'desc' },
      { column: 'sets_diff', order: 'desc' },
      { column: 'games_diff', order: 'desc' }
    ];

    orderBy.forEach(sort => {
      query.orderBy(sort.column, sort.order);
    });

    const standings = await query;

    // Add position/rank
    return standings.map((standing, idx) => ({
      ...standing,
      position: idx + 1
    }));
  }
}

module.exports = new StandingsService();
