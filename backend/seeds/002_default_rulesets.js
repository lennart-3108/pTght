/**
 * Seed: Default RuleSets for Community Leagues
 * Creates standard rulesets for Football, Tennis, and Darts
 */

exports.seed = async function(knex) {
  // Clear existing rulesets (optional - only for development)
  // await knex('rulesets').del();

  // Get sport IDs
  const football = await knex('sports').where('name', 'like', '%ußball%').orWhere('name', 'Football').first();
  const tennis = await knex('sports').where('name', 'like', '%ennis%').andWhere('name', 'not like', '%Tisch%').first();
  const tableTennis = await knex('sports').where('name', 'like', '%Tischtennis%').orWhere('name', 'Table Tennis').first();

  const rulesets = [];

  // 1. FOOTBALL / FUßBALL - Simple Score
  if (football) {
    rulesets.push({
      sport_id: football.id,
      name: 'Fußball Standard',
      version: 1,
      description: 'Standard Fußball-Regeln mit Toren als Ergebnis',
      is_active: true,
      config: JSON.stringify({
        result_schema: {
          type: 'object',
          required: ['home_score', 'away_score'],
          properties: {
            home_score: {
              type: 'integer',
              minimum: 0,
              maximum: 99,
              description: 'Tore Heimmannschaft'
            },
            away_score: {
              type: 'integer',
              minimum: 0,
              maximum: 99,
              description: 'Tore Auswärtsmannschaft'
            },
            notes: {
              type: 'string',
              maxLength: 500,
              description: 'Optionale Notizen'
            }
          }
        },
        validation_rules: {
          // JSONLogic rules for semantic validation
          and: [
            { '>=': [{ var: 'home_score' }, 0] },
            { '>=': [{ var: 'away_score' }, 0] },
            { '<=': [{ var: 'home_score' }, 99] },
            { '<=': [{ var: 'away_score' }, 99] }
          ]
        },
        match_decision: {
          type: 'simple_score',
          tie_allowed: true // Unentschieden erlaubt
        },
        points_policy: {
          win: 3,
          draw: 1,
          loss: 0
        },
        tie_breakers: ['head2head', 'goal_diff', 'goals_scored', 'goals_conceded'],
        ui_hints: {
          input_mode: 'simple',
          labels: {
            home_score: 'Tore Heim',
            away_score: 'Tore Auswärts'
          }
        }
      })
    });
  }

  // 2. TENNIS - Sets Score (Best of 3)
  if (tennis) {
    rulesets.push({
      sport_id: tennis.id,
      name: 'Tennis Best-of-3',
      version: 1,
      description: 'Tennis Standard (2 Gewinnsätze aus maximal 3 Sätzen)',
      is_active: true,
      config: JSON.stringify({
        result_schema: {
          type: 'object',
          required: ['sets'],
          properties: {
            sets: {
              type: 'array',
              minItems: 2,
              maxItems: 3,
              items: {
                type: 'object',
                required: ['home', 'away'],
                properties: {
                  home: { type: 'integer', minimum: 0, maximum: 7 },
                  away: { type: 'integer', minimum: 0, maximum: 7 }
                }
              }
            },
            notes: {
              type: 'string',
              maxLength: 500
            }
          }
        },
        validation_rules: {
          // Each set must have valid scores
          and: [
            { '>=': [{ var: 'sets.length' }, 2] },
            { '<=': [{ var: 'sets.length' }, 3] }
            // Additional rules: validate set scores (6-4, 7-5, 7-6, etc.)
          ]
        },
        match_decision: {
          type: 'sets_score',
          sets_to_win: 2,
          max_sets: 3,
          tie_allowed: false
        },
        points_policy: {
          win: 2,
          loss: 0
          // No draws in tennis
        },
        tie_breakers: ['head2head', 'sets_diff', 'games_diff'],
        ui_hints: {
          input_mode: 'per_set',
          max_sets: 3,
          sets_to_win: 2,
          labels: {
            set_label: 'Satz',
            home_label: 'Spieler 1',
            away_label: 'Spieler 2'
          },
          help_text: 'Geben Sie die Spielstände für jeden Satz ein (z.B. 6-4, 3-6, 6-2)'
        }
      })
    });

    // Tennis Best-of-5 variant
    rulesets.push({
      sport_id: tennis.id,
      name: 'Tennis Best-of-5',
      version: 1,
      description: 'Tennis Profi-Format (3 Gewinnsätze aus maximal 5 Sätzen)',
      is_active: true,
      config: JSON.stringify({
        result_schema: {
          type: 'object',
          required: ['sets'],
          properties: {
            sets: {
              type: 'array',
              minItems: 3,
              maxItems: 5,
              items: {
                type: 'object',
                required: ['home', 'away'],
                properties: {
                  home: { type: 'integer', minimum: 0, maximum: 7 },
                  away: { type: 'integer', minimum: 0, maximum: 7 }
                }
              }
            },
            notes: { type: 'string', maxLength: 500 }
          }
        },
        validation_rules: {
          and: [
            { '>=': [{ var: 'sets.length' }, 3] },
            { '<=': [{ var: 'sets.length' }, 5] }
          ]
        },
        match_decision: {
          type: 'sets_score',
          sets_to_win: 3,
          max_sets: 5,
          tie_allowed: false
        },
        points_policy: {
          win: 2,
          loss: 0
        },
        tie_breakers: ['head2head', 'sets_diff', 'games_diff'],
        ui_hints: {
          input_mode: 'per_set',
          max_sets: 5,
          sets_to_win: 3,
          labels: {
            set_label: 'Satz',
            home_label: 'Spieler 1',
            away_label: 'Spieler 2'
          }
        }
      })
    });
  }

  // 3. TABLE TENNIS / TISCHTENNIS - Best of 5
  if (tableTennis) {
    rulesets.push({
      sport_id: tableTennis.id,
      name: 'Tischtennis Best-of-5',
      version: 1,
      description: 'Tischtennis Standard (3 Gewinnsätze aus maximal 5 Sätzen)',
      is_active: true,
      config: JSON.stringify({
        result_schema: {
          type: 'object',
          required: ['sets'],
          properties: {
            sets: {
              type: 'array',
              minItems: 3,
              maxItems: 5,
              items: {
                type: 'object',
                required: ['home', 'away'],
                properties: {
                  home: { type: 'integer', minimum: 0, maximum: 21 },
                  away: { type: 'integer', minimum: 0, maximum: 21 }
                }
              }
            },
            notes: { type: 'string', maxLength: 500 }
          }
        },
        validation_rules: {
          and: [
            { '>=': [{ var: 'sets.length' }, 3] },
            { '<=': [{ var: 'sets.length' }, 5] }
          ]
        },
        match_decision: {
          type: 'sets_score',
          sets_to_win: 3,
          max_sets: 5,
          tie_allowed: false,
          min_points_per_set: 11,
          must_win_by_2: true
        },
        points_policy: {
          win: 2,
          loss: 0
        },
        tie_breakers: ['head2head', 'sets_diff', 'points_diff'],
        ui_hints: {
          input_mode: 'per_set',
          max_sets: 5,
          sets_to_win: 3,
          labels: {
            set_label: 'Satz',
            home_label: 'Spieler 1',
            away_label: 'Spieler 2'
          },
          help_text: 'Sätze bis 11 Punkte (Abstand mind. 2 Punkte)'
        }
      })
    });
  }

  // Insert all rulesets
  if (rulesets.length > 0) {
    await knex('rulesets').insert(rulesets);
    console.log(`✅ Inserted ${rulesets.length} default rulesets`);
  } else {
    console.log('⚠️  No sports found to create rulesets for');
  }
};
