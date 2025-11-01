/**
 * Migration: Create booking_subscriptions table for recurring bookings (Location Manager view)
 * This table tracks subscriptions created by location managers for specific users
 */

exports.up = async function (knex) {
  // Check if table already exists
  const tableExists = await knex.schema.hasTable('booking_subscriptions');
  if (tableExists) {
    console.log('⚠️ booking_subscriptions table already exists, skipping creation');
    return;
  }

  await knex.schema.createTable('booking_subscriptions', (table) => {
    table.increments('id').primary();
    table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('frequency', ['weekly', 'monthly']).notNullable(); // Recurrence pattern
    table.integer('day_of_week'); // 0-6 (0 = Sunday) for weekly
    table.integer('day_of_month'); // 1-31 for monthly
    table.string('start_time', 5).notNullable(); // HH:mm format
    table.string('end_time', 5).notNullable(); // HH:mm format
    table.decimal('price', 10, 2).notNullable().defaultTo(0); // Price per booking
    table.date('start_date').notNullable(); // When subscription starts
    table.date('end_date'); // Null = indefinite
    table.enum('status', ['active', 'cancelled']).notNullable().defaultTo('active');
    table.text('notes'); // Admin notes
    table.integer('created_by').references('id').inTable('users').onDelete('SET NULL'); // Location manager who created it
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['asset_id', 'status']);
    table.index(['user_id']);
    table.index('created_by');
  });

  // Add subscription_id column to bookings table if not exists
  const hasSubscriptionId = await knex.schema.hasColumn('bookings', 'subscription_id');
  if (!hasSubscriptionId) {
    await knex.schema.table('bookings', (table) => {
      table.integer('subscription_id').references('id').inTable('booking_subscriptions').onDelete('SET NULL');
      table.index('subscription_id');
    });
  }

  // Add booking_type column to bookings table if not exists
  const hasBookingType = await knex.schema.hasColumn('bookings', 'booking_type');
  if (!hasBookingType) {
    await knex.schema.table('bookings', (table) => {
      table.string('booking_type', 20).defaultTo('match'); // 'match', 'manual', 'subscription'
    });
  }

  console.log('✅ Created booking_subscriptions table and updated bookings table');
};

exports.down = async function (knex) {
  // Remove columns from bookings table
  const hasSubscriptionId = await knex.schema.hasColumn('bookings', 'subscription_id');
  const hasBookingType = await knex.schema.hasColumn('bookings', 'booking_type');
  
  if (hasSubscriptionId || hasBookingType) {
    await knex.schema.table('bookings', (table) => {
      if (hasSubscriptionId) table.dropColumn('subscription_id');
      if (hasBookingType) table.dropColumn('booking_type');
    });
  }

  // Drop table
  await knex.schema.dropTableIfExists('booking_subscriptions');
  console.log('✅ Dropped booking_subscriptions table and cleaned up bookings table');
};
