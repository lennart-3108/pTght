/**
 * Result Decision Service
 * Determines match winner and calculates points based on ruleset configuration
 */
class ResultDecision {
  /**
   * Determine match outcome and points for both teams
   * @param {Object} ruleset - RuleSet from database
   * @param {Object} resultData - Validated result data
   * @returns {Object} { winner: 'home'|'away'|'draw', homePoints: number, awayPoints: number, metadata: Object }
   */
  decide(ruleset, resultData) {
    const config = typeof ruleset.config === 'string' 
      ? JSON.parse(ruleset.config) 
      : ruleset.config;

    const decisionType = config.match_decision?.type;

    switch (decisionType) {
      case 'simple_score':
        return this.decideSimpleScore(config, resultData);
      
      case 'sets_score':
        return this.decideSetsScore(config, resultData);
      
      default:
        throw new Error(`Unknown match decision type: ${decisionType}`);
    }
  }

  /**
   * Decide simple score match (e.g., football)
   */
  decideSimpleScore(config, data) {
    const { home_score, away_score } = data;
    const pointsPolicy = config.points_policy || { win: 3, draw: 1, loss: 0 };

    let winner;
    let homePoints;
    let awayPoints;

    if (home_score > away_score) {
      winner = 'home';
      homePoints = pointsPolicy.win;
      awayPoints = pointsPolicy.loss;
    } else if (away_score > home_score) {
      winner = 'away';
      homePoints = pointsPolicy.loss;
      awayPoints = pointsPolicy.win;
    } else {
      winner = 'draw';
      homePoints = pointsPolicy.draw || 1;
      awayPoints = pointsPolicy.draw || 1;
    }

    return {
      winner,
      homePoints,
      awayPoints,
      metadata: {
        home_score,
        away_score,
        goal_diff: home_score - away_score
      }
    };
  }

  /**
   * Decide sets-based match (e.g., tennis, table tennis)
   */
  decideSetsScore(config, data) {
    const { sets } = data;
    const pointsPolicy = config.points_policy || { win: 2, loss: 0 };

    // Count set wins
    let homeWins = 0;
    let awayWins = 0;
    let homeGamesTotal = 0;
    let awayGamesTotal = 0;

    sets.forEach(set => {
      if (set.home > set.away) {
        homeWins++;
      } else if (set.away > set.home) {
        awayWins++;
      }
      homeGamesTotal += set.home;
      awayGamesTotal += set.away;
    });

    let winner;
    let homePoints;
    let awayPoints;

    if (homeWins > awayWins) {
      winner = 'home';
      homePoints = pointsPolicy.win;
      awayPoints = pointsPolicy.loss;
    } else if (awayWins > homeWins) {
      winner = 'away';
      homePoints = pointsPolicy.loss;
      awayPoints = pointsPolicy.win;
    } else {
      // Should not happen with proper validation, but handle gracefully
      winner = 'draw';
      homePoints = pointsPolicy.draw || 0;
      awayPoints = pointsPolicy.draw || 0;
    }

    return {
      winner,
      homePoints,
      awayPoints,
      metadata: {
        home_sets: homeWins,
        away_sets: awayWins,
        sets_diff: homeWins - awayWins,
        home_games: homeGamesTotal,
        away_games: awayGamesTotal,
        games_diff: homeGamesTotal - awayGamesTotal,
        sets: sets
      }
    };
  }

  /**
   * Calculate standings statistics for a team based on result
   * @param {Object} decision - Decision object from decide()
   * @param {string} perspective - 'home' or 'away'
   * @returns {Object} Stats to add to standings (wins, losses, draws, points, etc.)
   */
  getStandingsUpdate(decision, perspective) {
    const isHome = perspective === 'home';
    const points = isHome ? decision.homePoints : decision.awayPoints;

    const update = {
      played: 1,
      points: points,
      wins: 0,
      draws: 0,
      losses: 0
    };

    if (decision.winner === perspective) {
      update.wins = 1;
    } else if (decision.winner === 'draw') {
      update.draws = 1;
    } else {
      update.losses = 1;
    }

    // Add sport-specific stats
    if (decision.metadata.home_score !== undefined) {
      // Simple score (e.g., football)
      const goalsFor = isHome ? decision.metadata.home_score : decision.metadata.away_score;
      const goalsAgainst = isHome ? decision.metadata.away_score : decision.metadata.home_score;
      
      update.goals_for = goalsFor;
      update.goals_against = goalsAgainst;
      update.goal_diff = goalsFor - goalsAgainst;
    }

    if (decision.metadata.home_sets !== undefined) {
      // Sets-based (e.g., tennis)
      const setsFor = isHome ? decision.metadata.home_sets : decision.metadata.away_sets;
      const setsAgainst = isHome ? decision.metadata.away_sets : decision.metadata.home_sets;
      const gamesFor = isHome ? decision.metadata.home_games : decision.metadata.away_games;
      const gamesAgainst = isHome ? decision.metadata.away_games : decision.metadata.home_games;

      update.sets_for = setsFor;
      update.sets_against = setsAgainst;
      update.sets_diff = setsFor - setsAgainst;
      update.games_for = gamesFor;
      update.games_against = gamesAgainst;
      update.games_diff = gamesFor - gamesAgainst;
    }

    return update;
  }
}

module.exports = new ResultDecision();
