/**
 * Migration: Location & Booking Core Tables
 * 
 * Creates the foundational tables for the Location & Booking system:
 * - locations: Physical venues where matches/activities take place
 * - assets: Courts, fields, halls, tables (bookable resources at a location)
 * - slots: Time slots for bookings (single or recurring)
 * - bookings: Booking records with hold/confirm flow
 * - blackout_windows: Maintenance/blocked time periods
 * - pricing_rules: Dynamic pricing by time/sport/asset
 */

exports.up = async function up(knex) {
  // Ensure locations table exists (older setups may not have it yet)
  const hasLocationsTable = await knex.schema.hasTable('locations');
  if (!hasLocationsTable) {
    await knex.schema.createTable('locations', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('street', 255);
      table.string('city', 255);
      table.string('state', 100);
      table.string('country', 100);
      table.string('postal_code', 20);
      table.string('status', 50).defaultTo('active');
      table.decimal('latitude', 10, 7);
      table.decimal('longitude', 10, 7);
      table.string('timezone', 100);
      table.json('metadata');
      table.timestamps(true, true);
    });
  }

  const locationColumns = [
    { name: 'latitude', apply: table => table.decimal('latitude', 10, 7) },
    { name: 'longitude', apply: table => table.decimal('longitude', 10, 7) },
    { name: 'phone', apply: table => table.string('phone', 50) },
    { name: 'email', apply: table => table.string('email', 255) },
    { name: 'website', apply: table => table.string('website', 500) },
    { name: 'opening_hours', apply: table => table.json('opening_hours') },
    { name: 'photos', apply: table => table.json('photos') },
    { name: 'is_verified', apply: table => table.boolean('is_verified').defaultTo(false) },
    { name: 'rating', apply: table => table.decimal('rating', 3, 2).defaultTo(0) },
    { name: 'review_count', apply: table => table.integer('review_count').defaultTo(0) }
  ];

  const missingColumns = [];
  for (const col of locationColumns) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await knex.schema.hasColumn('locations', col.name);
    if (!exists) missingColumns.push(col);
  }

  if (missingColumns.length) {
    await knex.schema.alterTable('locations', table => {
      missingColumns.forEach(col => col.apply(table));
    });
  }

  // Create indexes only when columns exist
  try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city)'); } catch {}
  const hasStatusCol = await knex.schema.hasColumn('locations', 'status').catch(() => false);
  if (hasStatusCol) { try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status)'); } catch {} }
  const hasLat = await knex.schema.hasColumn('locations', 'latitude').catch(() => false);
  const hasLon = await knex.schema.hasColumn('locations', 'longitude').catch(() => false);
  if (hasLat && hasLon) { try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_locations_geo ON locations(latitude, longitude)'); } catch {} }

  const hasAssets = await knex.schema.hasTable('assets');
  if (!hasAssets) {
    await knex.schema.createTable('assets', table => {
      table.increments('id').primary();
      table
        .integer('location_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('locations')
        .onDelete('CASCADE');

      table.string('name', 200).notNullable();
      table.text('description');
      table.enu('type', ['court', 'field', 'hall', 'table', 'room', 'other']).defaultTo('court');
      table.json('supported_sports');
      table.string('surface', 100);
      table.boolean('indoor').defaultTo(false);
      table.integer('capacity');
      table.json('equipment');
      table.json('amenities');
      table.decimal('length', 8, 2);
      table.decimal('width', 8, 2);
      table.enu('status', ['active', 'maintenance', 'blocked', 'inactive']).defaultTo('active');
      table.integer('display_order').defaultTo(0);
      table.json('photos');
      table.timestamps(true, true);

      table.index(['location_id'], 'assets_location_id_idx');
      table.index(['status'], 'assets_status_idx');
      table.index(['type'], 'assets_type_idx');
    });
  }

  const hasPricingRules = await knex.schema.hasTable('pricing_rules');
  if (!hasPricingRules) {
    await knex.schema.createTable('pricing_rules', table => {
      table.increments('id').primary();
      table
        .integer('location_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('locations')
        .onDelete('CASCADE');
      table
        .integer('asset_id')
        .unsigned()
        .references('id')
        .inTable('assets')
        .onDelete('CASCADE');
      table
        .integer('sport_id')
        .unsigned()
        .references('id')
        .inTable('sports')
        .onDelete('SET NULL');

      table.string('name', 200).notNullable();
      table.text('description');
      table.json('days_of_week');
      table.time('time_from');
      table.time('time_to');
      table.date('valid_from');
      table.date('valid_until');
      table.decimal('base_price', 10, 2);
      table.decimal('price_modifier', 10, 2);
      table.decimal('price_multiplier', 5, 2);
      table.string('currency', 3).defaultTo('EUR');
      table.integer('priority').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);

      table.index(['location_id'], 'pricing_rules_location_id_idx');
      table.index(['asset_id'], 'pricing_rules_asset_id_idx');
      table.index(['sport_id'], 'pricing_rules_sport_id_idx');
      table.index(['is_active', 'priority'], 'pricing_rules_active_priority_idx');
    });
  }

  const hasSlots = await knex.schema.hasTable('slots');
  if (!hasSlots) {
    await knex.schema.createTable('slots', table => {
      table.increments('id').primary();
      table
        .integer('asset_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('assets')
        .onDelete('CASCADE');
      table
        .integer('location_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('locations')
        .onDelete('CASCADE');
      table
        .integer('pricing_rule_id')
        .unsigned()
        .references('id')
        .inTable('pricing_rules')
        .onDelete('SET NULL');
      table
        .integer('sport_id')
        .unsigned()
        .references('id')
        .inTable('sports')
        .onDelete('SET NULL');

      table.datetime('start_time').notNullable();
      table.datetime('end_time').notNullable();
      table.integer('duration_minutes').notNullable();
      table.integer('buffer_before').defaultTo(0);
      table.integer('buffer_after').defaultTo(0);
      table.decimal('base_price', 10, 2);
      table.string('currency', 3).defaultTo('EUR');
      table.string('format', 100);
      table.enu('status', ['available', 'held', 'booked', 'blocked']).defaultTo('available');
      table.enu('visibility', ['public', 'private', 'members-only']).defaultTo('public');
      table.string('recurrence_id', 100);
      table.boolean('is_recurring').defaultTo(false);
      table.json('recurrence_rule');
      table.integer('booking_id').unsigned();
      table.datetime('held_at');
      table.datetime('held_expires_at');
      table
        .integer('held_by_user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL');
      table.boolean('is_boosted').defaultTo(false);
      table.integer('boost_rank').defaultTo(0);
      table.decimal('boost_discount_pct', 5, 2).defaultTo(0);
      table.timestamps(true, true);

      table.unique(['asset_id', 'start_time'], 'slots_asset_id_start_time_unique');
      table.index(['asset_id', 'start_time', 'end_time'], 'slots_asset_time_idx');
      table.index(['location_id', 'start_time'], 'slots_location_start_idx');
      table.index(['status'], 'slots_status_idx');
      table.index(['sport_id'], 'slots_sport_id_idx');
      table.index(['held_expires_at'], 'slots_held_expires_idx');
      table.index(['recurrence_id'], 'slots_recurrence_idx');
    });
  }

  const hasBookings = await knex.schema.hasTable('bookings');
  if (!hasBookings) {
    await knex.schema.createTable('bookings', table => {
      table.increments('id').primary();
      table
        .integer('slot_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('slots')
        .onDelete('CASCADE');
      table
        .integer('location_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('locations')
        .onDelete('CASCADE');
      table
        .integer('asset_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('assets')
        .onDelete('CASCADE');
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
      table
        .integer('match_id')
        .unsigned()
        .references('id')
        .inTable('matches')
        .onDelete('SET NULL');
      table
        .integer('team_id')
        .unsigned()
        .references('id')
        .inTable('teams')
        .onDelete('SET NULL');
      table
        .integer('league_id')
        .unsigned()
        .references('id')
        .inTable('leagues')
        .onDelete('SET NULL');

      table.enu('status', ['held', 'confirmed', 'paid', 'completed', 'cancelled', 'rejected', 'no-show', 'refunded']).defaultTo('held');
      table.datetime('start_time').notNullable();
      table.datetime('end_time').notNullable();
      table.integer('duration_minutes').notNullable();
      table.decimal('price', 10, 2).notNullable();
      table.string('currency', 3).defaultTo('EUR');
      table.decimal('platform_fee', 10, 2).defaultTo(0);
      table.decimal('owner_payout', 10, 2).defaultTo(0);
      table.string('payment_intent_id', 200);
      table.string('invoice_id', 200);
      table.datetime('paid_at');
      table.datetime('cancelled_at');
      table.string('cancellation_reason', 500);
      table.decimal('refund_amount', 10, 2);
      table.datetime('refunded_at');
      table.boolean('is_no_show').defaultTo(false);
      table.datetime('no_show_reported_at');
      table.string('idempotency_key', 100).unique();
      table.json('metadata');
      table.text('user_notes');
      table.text('owner_notes');
      table.timestamps(true, true);

      table.index(['user_id'], 'bookings_user_id_idx');
      table.index(['slot_id'], 'bookings_slot_id_idx');
      table.index(['location_id'], 'bookings_location_id_idx');
      table.index(['match_id'], 'bookings_match_id_idx');
      table.index(['status'], 'bookings_status_idx');
      table.index(['start_time'], 'bookings_start_time_idx');
      table.index(['payment_intent_id'], 'bookings_payment_intent_idx');
      table.index(['idempotency_key'], 'bookings_idempotency_idx');
    });
  }

  const hasBlackout = await knex.schema.hasTable('blackout_windows');
  if (!hasBlackout) {
    await knex.schema.createTable('blackout_windows', table => {
      table.increments('id').primary();
      table
        .integer('location_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('locations')
        .onDelete('CASCADE');
      table
        .integer('asset_id')
        .unsigned()
        .references('id')
        .inTable('assets')
        .onDelete('CASCADE');
      table.datetime('start_time').notNullable();
      table.datetime('end_time').notNullable();
      table.string('reason', 500);
      table.text('description');
      table.boolean('is_recurring').defaultTo(false);
      table.json('recurrence_rule');
      table.string('recurrence_id', 100);
      table.timestamps(true, true);

      table.index(['location_id', 'start_time', 'end_time'], 'blackout_location_time_idx');
      table.index(['asset_id', 'start_time', 'end_time'], 'blackout_asset_time_idx');
    });
  }
};

exports.down = async function down(knex) {
  const dropIndexes = async () => {
    await knex.raw('DROP INDEX IF EXISTS idx_locations_city');
    await knex.raw('DROP INDEX IF EXISTS idx_locations_status');
    await knex.raw('DROP INDEX IF EXISTS idx_locations_geo');
  };

  await knex.schema.dropTableIfExists('blackout_windows');
  await knex.schema.dropTableIfExists('bookings');
  await knex.schema.dropTableIfExists('slots');
  await knex.schema.dropTableIfExists('pricing_rules');
  await knex.schema.dropTableIfExists('assets');

  const removableColumns = [
    'latitude',
    'longitude',
    'phone',
    'email',
    'website',
    'opening_hours',
    'photos',
    'is_verified',
    'rating',
    'review_count'
  ];

  const columnsToDrop = [];
  for (const name of removableColumns) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await knex.schema.hasColumn('locations', name);
    if (exists) columnsToDrop.push(name);
  }

  if (columnsToDrop.length) {
    await knex.schema.alterTable('locations', table => {
      columnsToDrop.forEach(column => {
        table.dropColumn(column);
      });
    });
  }

  await dropIndexes();
};
