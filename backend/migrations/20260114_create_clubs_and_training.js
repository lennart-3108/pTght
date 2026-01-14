/**
 * Migration: Create clubs and training groups tables
 */

exports.up = async function (knex) {
  // 1. Clubs table - for club/organization management
  const hasClubs = await knex.schema.hasTable('clubs');
  if (!hasClubs) {
    await knex.schema.createTable('clubs', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('short_name', 50);
      table.text('description');
      table.integer('admin_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('logo_url', 500);
      table.string('website', 255);
      table.string('email', 255);
      table.string('phone', 50);
      
      // Address
      table.string('street', 255);
      table.string('city', 255);
      table.string('state', 100);
      table.string('country', 100);
      table.string('postal_code', 20);
      
      // Location reference
      table.integer('city_id').references('id').inTable('cities').onDelete('SET NULL');
      table.integer('district_id').references('id').inTable('districts').onDelete('SET NULL');
      
      table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
      table.json('settings').comment('Club-specific settings');
      table.timestamps(true, true);
    });
    
    await knex.raw('CREATE INDEX idx_clubs_admin ON clubs(admin_user_id)');
    await knex.raw('CREATE INDEX idx_clubs_status ON clubs(status)');
  }

  // 2. Club Members table - many-to-many relationship
  const hasClubMembers = await knex.schema.hasTable('club_members');
  if (!hasClubMembers) {
    await knex.schema.createTable('club_members', (table) => {
      table.increments('id').primary();
      table.integer('club_id').notNullable().references('id').inTable('clubs').onDelete('CASCADE');
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.enum('role', ['admin', 'trainer', 'member', 'guest']).defaultTo('member');
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.integer('invited_by').references('id').inTable('users').onDelete('SET NULL');
      table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
      table.json('permissions').comment('Member-specific permissions');
      table.timestamps(true, true);
      table.unique(['club_id', 'user_id']);
    });
    
    await knex.raw('CREATE INDEX idx_club_members_club ON club_members(club_id)');
    await knex.raw('CREATE INDEX idx_club_members_user ON club_members(user_id)');
  }

  // 3. Training Groups table
  const hasTrainingGroups = await knex.schema.hasTable('training_groups');
  if (!hasTrainingGroups) {
    await knex.schema.createTable('training_groups', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.text('description');
      table.integer('trainer_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('club_id').references('id').inTable('clubs').onDelete('CASCADE')
        .comment('Optional club association');
      table.integer('sport_id').references('id').inTable('sports').onDelete('SET NULL');
      
      table.enum('level', ['beginner', 'intermediate', 'advanced', 'professional']).defaultTo('intermediate');
      table.integer('min_age').comment('Minimum age for participants');
      table.integer('max_age').comment('Maximum age for participants');
      table.integer('max_participants').defaultTo(20);
      
      table.string('schedule_description', 500).comment('e.g., "Mondays and Wednesdays 18:00-19:30"');
      table.integer('location_id').references('id').inTable('locations').onDelete('SET NULL');
      
      table.enum('status', ['active', 'inactive', 'full']).defaultTo('active');
      table.json('settings').comment('Group-specific settings');
      table.timestamps(true, true);
    });
    
    await knex.raw('CREATE INDEX idx_training_groups_trainer ON training_groups(trainer_id)');
    await knex.raw('CREATE INDEX idx_training_groups_club ON training_groups(club_id)');
    await knex.raw('CREATE INDEX idx_training_groups_status ON training_groups(status)');
  }

  // 4. Training Group Members
  const hasTrainingGroupMembers = await knex.schema.hasTable('training_group_members');
  if (!hasTrainingGroupMembers) {
    await knex.schema.createTable('training_group_members', (table) => {
      table.increments('id').primary();
      table.integer('training_group_id').notNullable().references('id').inTable('training_groups').onDelete('CASCADE');
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.enum('status', ['active', 'inactive', 'waiting_list']).defaultTo('active');
      table.json('notes').comment('Trainer notes about participant');
      table.timestamps(true, true);
      table.unique(['training_group_id', 'user_id']);
    });
    
    await knex.raw('CREATE INDEX idx_training_group_members_group ON training_group_members(training_group_id)');
    await knex.raw('CREATE INDEX idx_training_group_members_user ON training_group_members(user_id)');
  }

  // 5. Training Sessions table
  const hasTrainingSessions = await knex.schema.hasTable('training_sessions');
  if (!hasTrainingSessions) {
    await knex.schema.createTable('training_sessions', (table) => {
      table.increments('id').primary();
      table.integer('training_group_id').notNullable().references('id').inTable('training_groups').onDelete('CASCADE');
      table.integer('trainer_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('scheduled_at').notNullable();
      table.integer('duration_minutes').defaultTo(90);
      table.integer('location_id').references('id').inTable('locations').onDelete('SET NULL');
      table.text('description');
      table.enum('status', ['scheduled', 'completed', 'cancelled']).defaultTo('scheduled');
      table.text('notes').comment('Session notes and feedback');
      table.timestamps(true, true);
    });
    
    await knex.raw('CREATE INDEX idx_training_sessions_group ON training_sessions(training_group_id)');
    await knex.raw('CREATE INDEX idx_training_sessions_trainer ON training_sessions(trainer_id)');
    await knex.raw('CREATE INDEX idx_training_sessions_scheduled ON training_sessions(scheduled_at)');
  }

  // 6. Training Session Attendance
  const hasTrainingAttendance = await knex.schema.hasTable('training_attendance');
  if (!hasTrainingAttendance) {
    await knex.schema.createTable('training_attendance', (table) => {
      table.increments('id').primary();
      table.integer('training_session_id').notNullable().references('id').inTable('training_sessions').onDelete('CASCADE');
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.enum('status', ['present', 'absent', 'excused', 'late']).defaultTo('present');
      table.text('notes');
      table.timestamp('checked_in_at');
      table.timestamps(true, true);
      table.unique(['training_session_id', 'user_id']);
    });
    
    await knex.raw('CREATE INDEX idx_training_attendance_session ON training_attendance(training_session_id)');
    await knex.raw('CREATE INDEX idx_training_attendance_user ON training_attendance(user_id)');
  }

  // 7. Update teams table to support club ownership
  const hasTeams = await knex.schema.hasTable('teams');
  if (hasTeams) {
    const hasClubId = await knex.schema.hasColumn('teams', 'club_id');
    if (!hasClubId) {
      await knex.schema.alterTable('teams', (table) => {
        table.integer('club_id').references('id').inTable('clubs').onDelete('SET NULL')
          .comment('Club that owns/manages this team');
      });
      await knex.raw('CREATE INDEX idx_teams_club ON teams(club_id)');
    }
  }
};

exports.down = async function (knex) {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('training_attendance');
  await knex.schema.dropTableIfExists('training_sessions');
  await knex.schema.dropTableIfExists('training_group_members');
  await knex.schema.dropTableIfExists('training_groups');
  await knex.schema.dropTableIfExists('club_members');
  await knex.schema.dropTableIfExists('clubs');
  
  // Remove club_id from teams
  const hasTeams = await knex.schema.hasTable('teams');
  if (hasTeams) {
    const hasClubId = await knex.schema.hasColumn('teams', 'club_id');
    if (hasClubId) {
      await knex.schema.alterTable('teams', (table) => {
        table.dropColumn('club_id');
      });
    }
  }
};
