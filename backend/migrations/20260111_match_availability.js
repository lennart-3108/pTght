/**
 * Migration: Match Availability System
 * Allows both players to add available days and time windows
 */

exports.up = async function(knex) {
  // Table for available dates (days)
  await knex.schema.createTable('match_availability_days', (table) => {
    table.increments('id').primary();
    table.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
    table.integer('user_id').notNullable();
    table.date('date').notNullable(); // The date (YYYY-MM-DD)
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index(['match_id', 'user_id']);
    table.index('date');
  });

  // Table for time windows within a day
  await knex.schema.createTable('match_availability_windows', (table) => {
    table.increments('id').primary();
    table.integer('day_id').notNullable().references('id').inTable('match_availability_days').onDelete('CASCADE');
    table.string('time_start', 5).notNullable(); // HH:MM format (e.g., "09:00")
    table.string('time_end', 5).notNullable();   // HH:MM format (e.g., "12:00")
    table.string('preset', 20); // Optional: 'morning', 'afternoon', 'evening' for quick selection
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index('day_id');
  });

  // Keep existing proposals table but update it to store concrete datetime
  const hasProposals = await knex.schema.hasTable('match_schedule_proposals');
  if (hasProposals) {
    const hasProposedDatetime = await knex.schema.hasColumn('match_schedule_proposals', 'proposed_datetime');
    if (!hasProposedDatetime) {
      await knex.schema.table('match_schedule_proposals', (table) => {
        table.timestamp('proposed_datetime'); // Concrete proposed date and time
      });
    }
  }

  console.log('[Migration] Match availability tables created');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('match_availability_windows');
  await knex.schema.dropTableIfExists('match_availability_days');
  
  const hasProposals = await knex.schema.hasTable('match_schedule_proposals');
  if (hasProposals) {
    const hasProposedDatetime = await knex.schema.hasColumn('match_schedule_proposals', 'proposed_datetime');
    if (hasProposedDatetime) {
      await knex.schema.table('match_schedule_proposals', (table) => {
        table.dropColumn('proposed_datetime');
      });
    }
  }
  
  console.log('[Migration] Match availability tables dropped');
};
