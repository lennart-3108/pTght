/**
 * Migration: Create subscriptions table for recurring bookings
 * Allows location managers to set up weekly/monthly subscriptions for users
 */

exports.up = async function (knex) {
  // Create subscriptions table
  await knex.schema.createTable('subscriptions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('asset_id').notNullable().references('id').inTable('assets').onDelete('CASCADE');
    table.integer('location_id').notNullable().references('id').inTable('locations').onDelete('CASCADE');
    table.string('recurrence_pattern', 20).notNullable(); // 'weekly', 'biweekly', 'monthly'
    table.string('day_of_week', 10); // 'monday', 'tuesday', etc. (for weekly/biweekly)
    table.integer('day_of_month'); // 1-31 (for monthly)
    table.time('start_time').notNullable(); // Time of day (HH:MM:SS)
    table.integer('duration_minutes').notNullable().defaultTo(60); // Duration in minutes
    table.date('subscription_start_date').notNullable(); // When subscription begins
    table.date('subscription_end_date'); // Null = indefinite
    table.decimal('price', 10, 2).notNullable(); // Price per booking
    table.string('currency', 3).notNullable().defaultTo('EUR');
    table.enum('status', ['active', 'paused', 'cancelled']).notNullable().defaultTo('active');
    table.enum('payment_method', ['monthly_invoice', 'prepaid', 'per_booking']).notNullable().defaultTo('monthly_invoice');
    table.text('notes'); // Admin notes about the subscription
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for performance
    table.index(['user_id', 'status']);
    table.index(['asset_id', 'status']);
    table.index(['location_id']);
  });

  // Create subscription_bookings junction table to track auto-created bookings
  await knex.schema.createTable('subscription_bookings', (table) => {
    table.increments('id').primary();
    table.integer('subscription_id').notNullable().references('id').inTable('subscriptions').onDelete('CASCADE');
    table.integer('booking_id').notNullable().references('id').inTable('bookings').onDelete('CASCADE');
    table.date('scheduled_date').notNullable(); // The date this booking was scheduled for
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.unique(['subscription_id', 'scheduled_date']); // One booking per subscription per date
    table.index('booking_id');
  });

  console.log('✅ Created subscriptions and subscription_bookings tables');
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('subscription_bookings');
  await knex.schema.dropTableIfExists('subscriptions');
  console.log('✅ Dropped subscriptions tables');
};
