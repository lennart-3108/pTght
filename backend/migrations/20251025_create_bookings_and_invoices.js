/**
 * Migration: Create bookings and invoices tables
 * Date: 2025-10-25
 */

exports.up = async function(knex) {
  // Check if tables already exist
  const hasBookings = await knex.schema.hasTable('bookings');
  const hasInvoices = await knex.schema.hasTable('invoices');

  if (hasBookings && hasInvoices) {
    console.log('✓ Tables bookings and invoices already exist, skipping');
    return;
  }

  // Create bookings table
  if (!hasBookings) {
    await knex.schema.createTable('bookings', (table) => {
      table.increments('id').primary();
      table.integer('match_id').unsigned().notNullable()
        .references('id').inTable('matches').onDelete('CASCADE');
      table.integer('slot_id').unsigned().notNullable()
        .references('id').inTable('slots').onDelete('RESTRICT');
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.integer('location_id').unsigned().notNullable()
        .references('id').inTable('locations').onDelete('RESTRICT');
      table.integer('asset_id').unsigned().notNullable()
        .references('id').inTable('assets').onDelete('RESTRICT');
      
      table.date('booking_date').notNullable();
      table.time('start_time').notNullable();
      table.time('end_time').notNullable();
      
      table.enum('status', ['pending', 'confirmed', 'cancelled', 'completed']).defaultTo('pending');
      table.enum('payment_status', ['pending', 'paid', 'refunded', 'failed']).defaultTo('pending');
      
      table.text('notes');
      table.timestamps(true, true);
      
      table.index(['match_id']);
      table.index(['user_id']);
      table.index(['slot_id']);
      table.index(['booking_date']);
    });
    console.log('✓ Created bookings table');
  }

  // Create invoices table
  if (!hasInvoices) {
    await knex.schema.createTable('invoices', (table) => {
      table.increments('id').primary();
      table.integer('booking_id').unsigned().notNullable()
        .references('id').inTable('bookings').onDelete('CASCADE');
      
      table.string('invoice_number').unique().notNullable();
      table.decimal('amount', 10, 2).notNullable();
      table.string('currency', 3).defaultTo('EUR');
      
      table.enum('payment_method', ['paypal', 'cash', 'card', 'bank_transfer']).notNullable();
      table.string('paypal_transaction_id');
      table.string('paypal_payer_email');
      
      table.enum('status', ['draft', 'issued', 'paid', 'cancelled', 'refunded']).defaultTo('draft');
      
      table.timestamp('issued_at');
      table.timestamp('paid_at');
      table.timestamp('due_at');
      
      table.text('notes');
      table.timestamps(true, true);
      
      table.index(['booking_id']);
      table.index(['invoice_number']);
      table.index(['status']);
    });
    console.log('✓ Created invoices table');
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('bookings');
  console.log('✓ Dropped bookings and invoices tables');
};
