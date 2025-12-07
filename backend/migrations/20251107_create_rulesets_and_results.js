/**
 * Migration: RuleSet System for Community Leagues
 * 
 * Creates tables for the flexible, versionable ruleset system:
 * - rulesets: Sport-specific rules for result validation and scoring
 * - results: Match results with validation states
 * - audit_logs: Track all changes for compliance
 */

exports.up = async function(knex) {
  // 1. RULESETS table - versionable sport rules
  await knex.schema.createTableIfNotExists('rulesets', table => {
    table.increments('id').primary();
    table.integer('sport_id').unsigned().references('id').inTable('sports').onDelete('CASCADE');
    
    table.string('name', 200).notNullable(); // e.g., "Fußball Standard", "Tennis Best-of-3"
    table.integer('version').notNullable().defaultTo(1);
    table.text('description');
    
    // Core config as JSONB - contains all rule logic
    table.json('config').notNullable(); 
    /* config structure:
    {
      result_schema: {...},        // JSON Schema for result input
      validation_rules: {...},     // JSONLogic rules for semantic validation
      match_decision: {            // How to determine winner
        type: "simple_score|sets_score|legs_score|custom",
        ...
      },
      points_policy: {             // League points calculation
        win: 3,
        draw: 1,
        loss: 0
      },
      tie_breakers: ["head2head", "goal_diff", "goals_scored"],
      ui_hints: {                  // Frontend rendering hints
        input_mode: "simple|per_set|legs",
        max_sets: 5,
        ...
      }
    }
    */
    
    table.boolean('is_active').defaultTo(true);
    table.integer('created_by_user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    
    // Indices
    table.index(['sport_id', 'is_active']);
    table.index(['version']);
    table.unique(['sport_id', 'name', 'version']); // Prevent duplicate versions
  });

  // 2. Add ruleset_id to matches table (if column doesn't exist)
  const hasRulesetId = await knex.schema.hasColumn('matches', 'ruleset_id');
  if (!hasRulesetId) {
    await knex.schema.table('matches', table => {
      table.integer('ruleset_id').unsigned().references('id').inTable('rulesets').onDelete('SET NULL');
      table.index(['ruleset_id']);
    });
  }

  // 3. RESULTS table - match results with validation states
  await knex.schema.createTableIfNotExists('results', table => {
    table.increments('id').primary();
    
    // References
    table.integer('match_id').unsigned().notNullable()
      .references('id').inTable('matches').onDelete('CASCADE');
    table.integer('reported_by_user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    
    // Result data
    table.json('raw_payload').notNullable(); // Exactly what user entered
    table.json('canonical_payload'); // Normalized, validated form
    table.integer('winner_team_id').unsigned()
      .references('id').inTable('teams').onDelete('SET NULL');
    
    // Lifecycle status (values: pending, accepted, disputed, adjudicated)
    table.string('status', 50).defaultTo('pending');
    
    // Evidence & notes
    table.json('evidence_urls'); // Array of image/video URLs
    table.text('user_notes');
    table.text('admin_notes');
    
    // Timestamps
    table.timestamp('reported_at').defaultTo(knex.fn.now());
    table.timestamp('confirmed_at');
    table.timestamp('adjudicated_at');
    table.integer('adjudicated_by_user_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    
    // Idempotency
    table.string('idempotency_key', 100).unique();
    
    table.timestamps(true, true);
    
    // Indices
    table.index(['match_id']);
    table.index(['reported_by_user_id']);
    table.index(['status']);
    table.index(['reported_at']);
  });

  // 4. AUDIT_LOGS table - track all changes
  await knex.schema.createTableIfNotExists('audit_logs', table => {
    table.increments('id').primary();
    
    table.integer('actor_user_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    
    table.string('object_type', 50).notNullable(); // 'result', 'ruleset', 'standing', etc.
    table.integer('object_id').unsigned().notNullable();
    
    table.string('action', 50).notNullable(); // 'created', 'confirmed', 'adjudicated', etc.
    table.json('details'); // Additional context
    table.string('ip_address', 50);
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indices
    table.index(['object_type', 'object_id']);
    table.index(['actor_user_id']);
    table.index(['created_at']);
  });

  // 5. Update standings table if it exists (add more tracking fields)
  const hasStandings = await knex.schema.hasTable('standings');
  if (hasStandings) {
    const hasLastUpdated = await knex.schema.hasColumn('standings', 'last_result_id');
    if (!hasLastUpdated) {
      await knex.schema.table('standings', table => {
        table.integer('last_result_id').unsigned()
          .references('id').inTable('results').onDelete('SET NULL');
        table.timestamp('last_updated_at').defaultTo(knex.fn.now());
      });
    }
  }
};

exports.down = async function(knex) {
  // Drop in reverse order
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('results');
  
  const hasMatches = await knex.schema.hasTable('matches');
  if (hasMatches) {
    const hasRulesetId = await knex.schema.hasColumn('matches', 'ruleset_id');
    if (hasRulesetId) {
      await knex.schema.table('matches', table => {
        table.dropColumn('ruleset_id');
      });
    }
  }
  
  await knex.schema.dropTableIfExists('rulesets');
};
