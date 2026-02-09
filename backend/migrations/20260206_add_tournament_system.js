/**
 * Migration: Add Tournament System
 * 
 * Enables leagues to be configured as tournaments with different modes:
 * - Round Robin (Jeder gegen Jeden)
 * - Knockout (K.O.-System)
 * - Groups + Knockout (Gruppen + K.O.)
 * - Swiss System (Schweizer System)
 */

exports.up = async function(knex) {
  console.log('[Tournament System] Adding tournament features to leagues...');

  // Add tournament-related columns to leagues table
  const hasLeagues = await knex.schema.hasTable('leagues');
  if (hasLeagues) {
    const columns = [
      'tournament_mode',
      'tournament_config',
      'bracket_data',
      'current_stage'
    ];

    for (const col of columns) {
      const hasColumn = await knex.schema.hasColumn('leagues', col);
      if (!hasColumn) {
        await knex.schema.table('leagues', table => {
          switch (col) {
            case 'tournament_mode':
              table.string('tournament_mode', 50).defaultTo('round_robin')
                .comment('Tournament type: round_robin, knockout, groups_knockout, swiss');
              break;
            case 'tournament_config':
              table.json('tournament_config')
                .comment('Tournament-specific configuration (e.g., group size, match format)');
              break;
            case 'bracket_data':
              table.json('bracket_data')
                .comment('Generated bracket/schedule data for knockout stages');
              break;
            case 'current_stage':
              table.string('current_stage', 50)
                .comment('Current tournament stage: registration, group_stage, round_16, quarters, semis, finals, completed');
              break;
          }
        });
        console.log(`[Tournament System] ✓ Added column: ${col}`);
      }
    }
  }

  // Create tournaments table for dedicated tournament entities
  const hasTournaments = await knex.schema.hasTable('tournaments');
  if (!hasTournaments) {
    await knex.schema.createTable('tournaments', table => {
      table.increments('id').primary();
      
      // Basic info
      table.string('name', 200).notNullable();
      table.text('description');
      table.integer('sport_id').unsigned().references('id').inTable('sports').onDelete('RESTRICT');
      table.integer('ruleset_id').unsigned().references('id').inTable('rulesets').onDelete('SET NULL');
      
      // Location
      table.integer('city_id').unsigned().references('id').inTable('cities').onDelete('SET NULL');
      table.integer('district_id').unsigned().references('id').inTable('districts').onDelete('SET NULL');
      table.string('venue_name', 200);
      table.text('venue_address');
      
      // Organizer
      table.integer('organizer_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      
      // Tournament configuration
      table.string('tournament_mode', 50).notNullable().defaultTo('knockout')
        .comment('round_robin, knockout, groups_knockout, swiss');
      table.json('tournament_config').comment('Mode-specific config');
      
      // Capacity & Registration
      table.integer('max_participants').unsigned();
      table.integer('min_participants').unsigned().defaultTo(2);
      table.boolean('registration_open').defaultTo(false);
      table.datetime('registration_deadline');
      
      // Schedule
      table.date('start_date');
      table.date('end_date');
      table.json('schedule').comment('Match schedule with dates/times');
      
      // State
      table.string('status', 50).defaultTo('draft')
        .comment('draft, registration, in_progress, completed, cancelled');
      table.string('current_stage', 50).comment('group_stage, round_16, quarters, semis, finals, etc.');
      
      // Bracket/Results
      table.json('bracket_data').comment('Generated draw/bracket structure');
      table.integer('winner_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.integer('runner_up_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      
      // Publishing
      table.boolean('published').defaultTo(false);
      table.datetime('published_at');
      
      // Timestamps
      table.timestamps(true, true);
      
      // Indices
      table.index('sport_id');
      table.index('city_id');
      table.index('organizer_id');
      table.index('status');
      table.index('published');
      table.index(['start_date', 'end_date']);
    });
    console.log('[Tournament System] ✓ Created tournaments table');
  }

  // Create tournament_participants table
  const hasParticipants = await knex.schema.hasTable('tournament_participants');
  if (!hasParticipants) {
    await knex.schema.createTable('tournament_participants', table => {
      table.increments('id').primary();
      table.integer('tournament_id').unsigned().notNullable()
        .references('id').inTable('tournaments').onDelete('CASCADE');
      table.integer('user_id').unsigned()
        .references('id').inTable('users').onDelete('CASCADE');
      table.integer('team_id').unsigned()
        .references('id').inTable('teams').onDelete('CASCADE');
      
      // Participant info
      table.integer('seed').unsigned().comment('Seeding for bracket generation');
      table.string('group', 10).comment('Group assignment (e.g., A, B, C)');
      
      // Registration
      table.datetime('registered_at').defaultTo(knex.fn.now());
      table.string('registration_status', 50).defaultTo('confirmed')
        .comment('confirmed, waitlist, cancelled, disqualified');
      
      // Results (calculated)
      table.integer('matches_played').defaultTo(0);
      table.integer('matches_won').defaultTo(0);
      table.integer('matches_drawn').defaultTo(0);
      table.integer('matches_lost').defaultTo(0);
      table.integer('points').defaultTo(0);
      table.integer('rank').unsigned().comment('Final tournament ranking');
      
      // Ensure either user_id or team_id is set
      table.timestamps(true, true);
      
      // Indices & Constraints
      table.unique(['tournament_id', 'user_id']);
      table.unique(['tournament_id', 'team_id']);
      table.index('tournament_id');
      table.index('user_id');
      table.index('team_id');
      table.index('registration_status');
    });
    console.log('[Tournament System] ✓ Created tournament_participants table');
  }

  // Create tournament_matches table (separate from league matches)
  const hasTournamentMatches = await knex.schema.hasTable('tournament_matches');
  if (!hasTournamentMatches) {
    await knex.schema.createTable('tournament_matches', table => {
      table.increments('id').primary();
      table.integer('tournament_id').unsigned().notNullable()
        .references('id').inTable('tournaments').onDelete('CASCADE');
      
      // Match details
      table.integer('round').unsigned().comment('Round number or group match number');
      table.string('stage', 50).comment('group_stage, round_16, quarters, semis, finals, etc.');
      table.string('match_label', 100).comment('e.g., "Finale", "Halbfinale 1", "Gruppe A - Spiel 1"');
      
      // Participants
      table.integer('home_participant_id').unsigned()
        .references('id').inTable('tournament_participants').onDelete('SET NULL');
      table.integer('away_participant_id').unsigned()
        .references('id').inTable('tournament_participants').onDelete('SET NULL');
      
      // Bracket positioning (for knockout)
      table.integer('bracket_position').unsigned()
        .comment('Position in bracket tree for knockout tournaments');
      table.integer('next_match_id').unsigned()
        .references('id').inTable('tournament_matches').onDelete('SET NULL')
        .comment('Winner advances to this match');
      
      // Schedule
      table.datetime('scheduled_at');
      table.string('venue', 200);
      
      // Result
      table.json('result_data').comment('Sport-specific result following ruleset schema');
      table.string('status', 50).defaultTo('scheduled')
        .comment('scheduled, in_progress, completed, cancelled, walkover');
      table.integer('winner_participant_id').unsigned()
        .references('id').inTable('tournament_participants').onDelete('SET NULL');
      
      // Timestamps
      table.timestamps(true, true);
      
      // Indices
      table.index('tournament_id');
      table.index(['tournament_id', 'stage']);
      table.index(['tournament_id', 'round']);
      table.index('scheduled_at');
      table.index('status');
    });
    console.log('[Tournament System] ✓ Created tournament_matches table');
  }

  console.log('[Tournament System] ✅ Migration completed successfully');
};

exports.down = async function(knex) {
  console.log('[Tournament System] Rolling back...');

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('tournament_matches');
  await knex.schema.dropTableIfExists('tournament_participants');
  await knex.schema.dropTableIfExists('tournaments');

  // Remove columns from leagues
  const hasLeagues = await knex.schema.hasTable('leagues');
  if (hasLeagues) {
    const columns = ['tournament_mode', 'tournament_config', 'bracket_data', 'current_stage'];
    for (const col of columns) {
      const hasColumn = await knex.schema.hasColumn('leagues', col);
      if (hasColumn) {
        await knex.schema.table('leagues', table => {
          table.dropColumn(col);
        });
      }
    }
  }

  console.log('[Tournament System] ✅ Rollback completed');
};
