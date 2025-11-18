const Ajv = require('ajv');
const jsonLogic = require('json-logic-js');

const ajv = new Ajv({ allErrors: true });

/**
 * RuleSet Validator Service
 * Validates match results against sport-specific rulesets using:
 * 1. JSON Schema validation (structure)
 * 2. JSON Logic validation (semantic rules)
 */
class RulesetValidator {
  /**
   * Validate result data against a ruleset
   * @param {Object} ruleset - RuleSet from database (with config JSON)
   * @param {Object} resultData - Result data to validate
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validate(ruleset, resultData) {
    const config = typeof ruleset.config === 'string' 
      ? JSON.parse(ruleset.config) 
      : ruleset.config;

    const errors = [];

    // Step 1: JSON Schema Validation
    const schemaValid = this.validateSchema(config.result_schema, resultData);
    if (!schemaValid.valid) {
      errors.push(...schemaValid.errors.map(err => ({
        type: 'schema',
        message: err.message,
        path: err.instancePath || err.dataPath,
        params: err.params
      })));
    }

    // Step 2: JSON Logic Semantic Validation
    if (config.validation_rules) {
      const logicValid = this.validateLogic(config.validation_rules, resultData);
      if (!logicValid.valid) {
        errors.push(...logicValid.errors);
      }
    }

    // Step 3: Sport-Specific Validation
    const sportValid = this.validateSportRules(config, resultData);
    if (!sportValid.valid) {
      errors.push(...sportValid.errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * JSON Schema validation
   */
  validateSchema(schema, data) {
    const validate = ajv.compile(schema);
    const valid = validate(data);

    return {
      valid,
      errors: valid ? [] : validate.errors || []
    };
  }

  /**
   * JSON Logic semantic validation
   */
  validateLogic(rules, data) {
    try {
      const result = jsonLogic.apply(rules, data);
      
      if (result === true) {
        return { valid: true, errors: [] };
      }

      return {
        valid: false,
        errors: [{
          type: 'logic',
          message: 'Validation rules not satisfied',
          rule: JSON.stringify(rules)
        }]
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          type: 'logic_error',
          message: `Logic evaluation error: ${error.message}`
        }]
      };
    }
  }

  /**
   * Sport-specific validation rules
   */
  validateSportRules(config, data) {
    const errors = [];
    const decisionType = config.match_decision?.type;

    switch (decisionType) {
      case 'simple_score':
        return this.validateSimpleScore(config, data);
      
      case 'sets_score':
        return this.validateSetsScore(config, data);
      
      default:
        errors.push({
          type: 'config',
          message: `Unknown match decision type: ${decisionType}`
        });
        return { valid: false, errors };
    }
  }

  /**
   * Validate simple score format (e.g., football: 3-2)
   */
  validateSimpleScore(config, data) {
    const errors = [];

    // Check required fields
    if (data.home_score === undefined || data.away_score === undefined) {
      errors.push({
        type: 'simple_score',
        message: 'home_score and away_score are required'
      });
      return { valid: false, errors };
    }

    // Check tie allowed
    const tieAllowed = config.match_decision?.tie_allowed ?? true;
    if (!tieAllowed && data.home_score === data.away_score) {
      errors.push({
        type: 'simple_score',
        message: 'Tie not allowed for this sport'
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate sets-based score (e.g., tennis, table tennis)
   */
  validateSetsScore(config, data) {
    const errors = [];
    const { sets_to_win, max_sets, min_points_per_set, must_win_by_2 } = config.match_decision;

    if (!data.sets || !Array.isArray(data.sets)) {
      errors.push({
        type: 'sets_score',
        message: 'Sets array is required'
      });
      return { valid: false, errors };
    }

    const sets = data.sets;

    // Validate set count
    if (sets.length < sets_to_win) {
      errors.push({
        type: 'sets_score',
        message: `At least ${sets_to_win} sets required to determine winner`
      });
    }

    if (sets.length > max_sets) {
      errors.push({
        type: 'sets_score',
        message: `Maximum ${max_sets} sets allowed`
      });
    }

    // Count wins
    let homeWins = 0;
    let awayWins = 0;

    sets.forEach((set, idx) => {
      // Check minimum points if configured
      if (min_points_per_set) {
        const maxPoints = Math.max(set.home, set.away);
        if (maxPoints < min_points_per_set) {
          errors.push({
            type: 'sets_score',
            message: `Set ${idx + 1}: Winning score must be at least ${min_points_per_set}`,
            set: idx + 1
          });
        }
      }

      // Check win-by-2 rule
      if (must_win_by_2) {
        const diff = Math.abs(set.home - set.away);
        if (diff < 2) {
          errors.push({
            type: 'sets_score',
            message: `Set ${idx + 1}: Must win by at least 2 points`,
            set: idx + 1
          });
        }
      }

      // Count set winners
      if (set.home > set.away) homeWins++;
      else if (set.away > set.home) awayWins++;
    });

    // Check if someone won
    const maxWins = Math.max(homeWins, awayWins);
    if (maxWins < sets_to_win) {
      errors.push({
        type: 'sets_score',
        message: `No clear winner: ${sets_to_win} sets needed to win (current: ${maxWins})`,
        homeWins,
        awayWins
      });
    }

    // Check for premature ending (winner emerged but more sets played)
    if (homeWins >= sets_to_win && awayWins >= sets_to_win) {
      errors.push({
        type: 'sets_score',
        message: 'Invalid: Both players have winning number of sets',
        homeWins,
        awayWins
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Helper: Get validation error messages formatted for user display
   */
  formatErrors(errors) {
    return errors.map(err => {
      switch (err.type) {
        case 'schema':
          return `Strukturfehler: ${err.message} (${err.path || 'root'})`;
        case 'logic':
          return `Regelverletzung: ${err.message}`;
        case 'simple_score':
        case 'sets_score':
          return `Sportregelfehler: ${err.message}`;
        default:
          return err.message || 'Unbekannter Fehler';
      }
    });
  }
}

module.exports = new RulesetValidator();
