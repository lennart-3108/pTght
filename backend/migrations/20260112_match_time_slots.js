/**
 * Migration: Match Time Slots
 * 
 * Host definiert Zeitrahmen (z.B. Mo 14-18 Uhr, Di 10-14 Uhr)
 * Beigetretener wählt konkrete Slots (z.B. Mo 14:00-15:00, Mo 16:00-17:30)
 * Host akzeptiert einen Slot
 */

exports.up = async function(knex) {
  // 1. match_time_frames: Host definiert verfügbare Zeitrahmen
  const hasFrames = await knex.schema.hasTable('match_time_frames');
  if (!hasFrames) {
    await knex.schema.createTable('match_time_frames', (t) => {
      t.increments('id').primary();
      t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
      t.date('date').notNullable(); // z.B. 2026-01-13
      t.time('time_start').notNullable(); // z.B. 14:00
      t.time('time_end').notNullable(); // z.B. 18:00
      t.integer('created_by_user_id').references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      
      t.index(['match_id'], 'idx_match_time_frames_match');
      t.index(['match_id', 'date'], 'idx_match_time_frames_match_date');
    });
  }

  // 2. match_time_slots: Beigetretener wählt konkrete Slots
  const hasSlots = await knex.schema.hasTable('match_time_slots');
  if (!hasSlots) {
    await knex.schema.createTable('match_time_slots', (t) => {
      t.increments('id').primary();
      t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
      t.integer('frame_id').notNullable().references('id').inTable('match_time_frames').onDelete('CASCADE');
      t.datetime('slot_start').notNullable(); // z.B. 2026-01-13 14:00:00
      t.datetime('slot_end').notNullable(); // z.B. 2026-01-13 15:00:00
      t.integer('duration_minutes').notNullable(); // z.B. 60
      t.integer('selected_by_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.enum('status', ['proposed', 'accepted', 'rejected']).defaultTo('proposed');
      t.integer('accepted_by_user_id').references('id').inTable('users').onDelete('SET NULL');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('responded_at');
      
      t.index(['match_id'], 'idx_match_time_slots_match');
      t.index(['match_id', 'status'], 'idx_match_time_slots_match_status');
      t.index(['frame_id'], 'idx_match_time_slots_frame');
    });
  }

  // 3. Update matches table: Wenn ein Slot akzeptiert wird
  const hasScheduledSlot = await knex.schema.hasColumn('matches', 'scheduled_slot_id');
  if (!hasScheduledSlot) {
    await knex.schema.table('matches', (t) => {
      t.integer('scheduled_slot_id').references('id').inTable('match_time_slots').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  // Remove column first
  const hasScheduledSlot = await knex.schema.hasColumn('matches', 'scheduled_slot_id');
  if (hasScheduledSlot) {
    await knex.schema.table('matches', (t) => {
      t.dropColumn('scheduled_slot_id');
    });
  }

  // Drop tables
  const hasSlots = await knex.schema.hasTable('match_time_slots');
  if (hasSlots) await knex.schema.dropTable('match_time_slots');
  
  const hasFrames = await knex.schema.hasTable('match_time_frames');
  if (hasFrames) await knex.schema.dropTable('match_time_frames');
};
