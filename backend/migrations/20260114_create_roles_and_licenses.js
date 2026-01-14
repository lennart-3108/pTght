/**
 * Migration: Create roles and licenses system for MatchLeague
 * 
 * Roles:
 * - free_user (default, no license required)
 * - team_captain (optional license)
 * - trainer (license required)
 * - club_admin (license required)
 * - location_provider (license + commission required)
 * - league_organizer (license per event)
 */

exports.up = async function (knex) {
  // 1. Roles table - defines available roles in the system
  const hasRoles = await knex.schema.hasTable('roles');
  if (!hasRoles) {
    await knex.schema.createTable('roles', (table) => {
      table.increments('id').primary();
      table.string('name', 50).notNullable().unique(); // e.g., 'team_captain', 'trainer', 'club_admin'
      table.string('display_name', 100).notNullable(); // e.g., 'Team Captain', 'Trainer'
      table.text('description');
      table.boolean('requires_license').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    });
    
    // Insert default roles
    await knex('roles').insert([
      {
        name: 'free_user',
        display_name: 'Free User',
        description: 'Standard user with basic features',
        requires_license: false,
        is_active: true
      },
      {
        name: 'team_captain',
        display_name: 'Team Captain',
        description: 'Organizes and manages a team',
        requires_license: false, // Optional license for enhanced features
        is_active: true
      },
      {
        name: 'trainer',
        display_name: 'Trainer',
        description: 'Manages training groups and schedules',
        requires_license: true,
        is_active: true
      },
      {
        name: 'club_admin',
        display_name: 'Club Admin',
        description: 'Manages club with multiple teams and trainers',
        requires_license: true,
        is_active: true
      },
      {
        name: 'location_provider',
        display_name: 'Location Provider',
        description: 'Manages sports facilities and bookings',
        requires_license: true,
        is_active: true
      },
      {
        name: 'league_organizer',
        display_name: 'League Organizer',
        description: 'Organizes leagues and tournaments',
        requires_license: true, // Per event license
        is_active: true
      }
    ]);
  }

  // 2. User Roles - assigns roles to users
  const hasUserRoles = await knex.schema.hasTable('user_roles');
  if (!hasUserRoles) {
    await knex.schema.createTable('user_roles', (table) => {
      table.increments('id').primary();
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
      table.timestamp('assigned_at').defaultTo(knex.fn.now());
      table.integer('assigned_by').references('id').inTable('users').onDelete('SET NULL');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      table.unique(['user_id', 'role_id']);
    });
    
    await knex.raw('CREATE INDEX idx_user_roles_user ON user_roles(user_id)');
    await knex.raw('CREATE INDEX idx_user_roles_role ON user_roles(role_id)');
  }

  // 3. License Plans - defines different license types and pricing
  const hasLicensePlans = await knex.schema.hasTable('license_plans');
  if (!hasLicensePlans) {
    await knex.schema.createTable('license_plans', (table) => {
      table.increments('id').primary();
      table.integer('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
      table.string('name', 100).notNullable(); // e.g., 'Team Monthly', 'Trainer Annual'
      table.text('description');
      table.decimal('price', 10, 2).notNullable(); // Price in EUR
      table.enum('billing_period', ['monthly', 'seasonal', 'annual', 'per_event']).notNullable();
      table.integer('duration_days').comment('Duration in days, null for perpetual');
      table.json('features').comment('JSON array of included features');
      table.json('limits').comment('JSON object with limits (e.g., max_teams, max_members)');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    });
    
    // Insert default license plans
    await knex('license_plans').insert([
      {
        role_id: 2, // team_captain
        name: 'Team Basic Monthly',
        description: 'Basic team organization features',
        price: 9.99,
        billing_period: 'monthly',
        duration_days: 30,
        features: JSON.stringify(['team_chat', 'member_management', 'basic_stats']),
        limits: JSON.stringify({ max_members: 20 }),
        is_active: true
      },
      {
        role_id: 2, // team_captain
        name: 'Team Seasonal',
        description: 'Full season team license',
        price: 49.99,
        billing_period: 'seasonal',
        duration_days: 180,
        features: JSON.stringify(['team_chat', 'member_management', 'advanced_stats', 'league_registration']),
        limits: JSON.stringify({ max_members: 30 }),
        is_active: true
      },
      {
        role_id: 3, // trainer
        name: 'Trainer Monthly',
        description: 'Professional trainer features',
        price: 29.99,
        billing_period: 'monthly',
        duration_days: 30,
        features: JSON.stringify(['training_groups', 'schedule_management', 'attendance_tracking', 'performance_stats']),
        limits: JSON.stringify({ max_groups: 5, max_participants_per_group: 25 }),
        is_active: true
      },
      {
        role_id: 4, // club_admin
        name: 'Club Starter',
        description: 'For small clubs',
        price: 99.99,
        billing_period: 'monthly',
        duration_days: 30,
        features: JSON.stringify(['multi_team_management', 'member_management', 'internal_events', 'basic_analytics']),
        limits: JSON.stringify({ max_teams: 5, max_members: 100 }),
        is_active: true
      },
      {
        role_id: 4, // club_admin
        name: 'Club Professional',
        description: 'For larger clubs and organizations',
        price: 249.99,
        billing_period: 'monthly',
        duration_days: 30,
        features: JSON.stringify(['multi_team_management', 'member_management', 'internal_events', 'advanced_analytics', 'custom_leagues', 'location_management']),
        limits: JSON.stringify({ max_teams: 20, max_members: 500 }),
        is_active: true
      },
      {
        role_id: 5, // location_provider
        name: 'Location Provider Monthly',
        description: 'Manage sports facilities and bookings',
        price: 79.99,
        billing_period: 'monthly',
        duration_days: 30,
        features: JSON.stringify(['slot_management', 'booking_management', 'availability_control', 'revenue_reports']),
        limits: JSON.stringify({ max_locations: 3, max_assets: 20 }),
        is_active: true
      },
      {
        role_id: 6, // league_organizer
        name: 'League Small',
        description: 'For small leagues (up to 8 teams)',
        price: 99.99,
        billing_period: 'per_event',
        duration_days: 120,
        features: JSON.stringify(['league_setup', 'schedule_management', 'standings', 'results_tracking']),
        limits: JSON.stringify({ max_teams: 8 }),
        is_active: true
      },
      {
        role_id: 6, // league_organizer
        name: 'League Large',
        description: 'For larger leagues and tournaments',
        price: 249.99,
        billing_period: 'per_event',
        duration_days: 180,
        features: JSON.stringify(['league_setup', 'schedule_management', 'standings', 'results_tracking', 'promotion_tools', 'sponsor_management']),
        limits: JSON.stringify({ max_teams: 32 }),
        is_active: true
      }
    ]);
  }

  // 4. User Licenses - tracks active licenses for users
  const hasUserLicenses = await knex.schema.hasTable('user_licenses');
  if (!hasUserLicenses) {
    await knex.schema.createTable('user_licenses', (table) => {
      table.increments('id').primary();
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('license_plan_id').notNullable().references('id').inTable('license_plans').onDelete('RESTRICT');
      table.enum('status', ['active', 'expired', 'cancelled', 'suspended']).defaultTo('active');
      table.timestamp('starts_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('expires_at').comment('Null for perpetual licenses');
      table.timestamp('cancelled_at');
      table.boolean('auto_renew').defaultTo(true);
      table.integer('entity_id').comment('Related entity ID (team_id, club_id, league_id, etc.)');
      table.string('entity_type', 50).comment('Entity type (team, club, league, location)');
      table.json('metadata').comment('Additional license-specific data');
      table.timestamps(true, true);
    });
    
    await knex.raw('CREATE INDEX idx_user_licenses_user ON user_licenses(user_id)');
    await knex.raw('CREATE INDEX idx_user_licenses_status ON user_licenses(status)');
    await knex.raw('CREATE INDEX idx_user_licenses_expires ON user_licenses(expires_at)');
  }

  // 5. License Transactions - payment history
  const hasLicenseTransactions = await knex.schema.hasTable('license_transactions');
  if (!hasLicenseTransactions) {
    await knex.schema.createTable('license_transactions', (table) => {
      table.increments('id').primary();
      table.integer('user_license_id').notNullable().references('id').inTable('user_licenses').onDelete('CASCADE');
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.decimal('amount', 10, 2).notNullable();
      table.string('currency', 3).defaultTo('EUR');
      table.enum('status', ['pending', 'completed', 'failed', 'refunded']).defaultTo('pending');
      table.string('payment_method', 50);
      table.string('transaction_reference', 255);
      table.timestamp('paid_at');
      table.text('notes');
      table.timestamps(true, true);
    });
    
    await knex.raw('CREATE INDEX idx_license_transactions_license ON license_transactions(user_license_id)');
    await knex.raw('CREATE INDEX idx_license_transactions_user ON license_transactions(user_id)');
  }

  // 6. Add owner_id to teams table if not exists (for club management)
  const hasTeams = await knex.schema.hasTable('teams');
  if (hasTeams) {
    const hasOwnerId = await knex.schema.hasColumn('teams', 'owner_id');
    if (!hasOwnerId) {
      await knex.schema.alterTable('teams', (table) => {
        table.integer('owner_id').references('id').inTable('users').onDelete('SET NULL')
          .comment('Club or organization owner');
        table.string('owner_type', 50).defaultTo('user')
          .comment('user, club, organization');
      });
    }
  }

  // 7. Add provider_id to locations table
  const hasLocations = await knex.schema.hasTable('locations');
  if (hasLocations) {
    const hasProviderId = await knex.schema.hasColumn('locations', 'provider_id');
    if (!hasProviderId) {
      await knex.schema.alterTable('locations', (table) => {
        table.integer('provider_id').references('id').inTable('users').onDelete('SET NULL')
          .comment('Location provider/manager user ID');
        table.decimal('commission_rate', 5, 2).defaultTo(15.00)
          .comment('Commission percentage per booking');
      });
    }
  }

  // 8. Add organizer_id to leagues table
  const hasLeagues = await knex.schema.hasTable('leagues');
  if (hasLeagues) {
    const hasOrganizerId = await knex.schema.hasColumn('leagues', 'organizer_id');
    if (!hasOrganizerId) {
      await knex.schema.alterTable('leagues', (table) => {
        table.integer('organizer_id').references('id').inTable('users').onDelete('SET NULL')
          .comment('League organizer user ID');
      });
    }
  }
};

exports.down = async function (knex) {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('license_transactions');
  await knex.schema.dropTableIfExists('user_licenses');
  await knex.schema.dropTableIfExists('license_plans');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('roles');
  
  // Remove added columns
  const hasTeams = await knex.schema.hasTable('teams');
  if (hasTeams) {
    const hasOwnerId = await knex.schema.hasColumn('teams', 'owner_id');
    if (hasOwnerId) {
      await knex.schema.alterTable('teams', (table) => {
        table.dropColumn('owner_id');
        table.dropColumn('owner_type');
      });
    }
  }
  
  const hasLocations = await knex.schema.hasTable('locations');
  if (hasLocations) {
    const hasProviderId = await knex.schema.hasColumn('locations', 'provider_id');
    if (hasProviderId) {
      await knex.schema.alterTable('locations', (table) => {
        table.dropColumn('provider_id');
        table.dropColumn('commission_rate');
      });
    }
  }
  
  const hasLeagues = await knex.schema.hasTable('leagues');
  if (hasLeagues) {
    const hasOrganizerId = await knex.schema.hasColumn('leagues', 'organizer_id');
    if (hasOrganizerId) {
      await knex.schema.alterTable('leagues', (table) => {
        table.dropColumn('organizer_id');
      });
    }
  }
};
