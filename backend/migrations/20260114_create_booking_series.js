exports.up = async function(knex) {
  // Create booking_series table for recurring bookings
  await knex.schema.createTable('booking_series', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('asset_id').unsigned().notNullable().references('id').inTable('assets').onDelete('CASCADE');
    table.integer('weekday').notNullable(); // 1=Monday, 7=Sunday
    table.string('time', 5).notNullable(); // HH:MM format
    table.integer('duration_months').notNullable(); // 1, 3, 6, 12
    table.decimal('total_price', 10, 2).defaultTo(0);
    table.string('status', 50).defaultTo('pending_payment'); // pending_payment, active, cancelled
    table.string('payment_id', 255); // PayPal payment ID
    table.string('payment_status', 50); // pending, completed, failed
    table.timestamp('paid_at');
    table.timestamp('starts_at');
    table.timestamp('ends_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['user_id']);
    table.index(['asset_id']);
    table.index(['status']);
  });

  // Add series_id to bookings table to link individual bookings to series
  const hasSeriesId = await knex.schema.hasColumn('bookings', 'series_id');
  if (!hasSeriesId) {
    await knex.schema.table('bookings', (table) => {
      table.integer('series_id').unsigned().references('id').inTable('booking_series').onDelete('SET NULL');
      table.index(['series_id']);
    });
  }
};

exports.down = async function(knex) {
  // Remove series_id from bookings
  const hasSeriesId = await knex.schema.hasColumn('bookings', 'series_id');
  if (hasSeriesId) {
    await knex.schema.table('bookings', (table) => {
      table.dropColumn('series_id');
    });
  }

  // Drop booking_series table
  await knex.schema.dropTableIfExists('booking_series');
};
