/**
 * Repair Migration: Create locations table if missing
 * Provides base schema required by downstream migrations (assets/slots/bookings) and indexes.
 */

module.exports = {
  up: async (knex) => {
    const hasLocations = await knex.schema.hasTable('locations').catch(() => false);
    if (!hasLocations) {
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
      // Basic indexes often used by queries
      await knex.raw('CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city)');
      await knex.raw('CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status)');
    } else {
      // Ensure status column exists for index creation in later migrations
      const hasStatus = await knex.schema.hasColumn('locations', 'status').catch(() => false);
      if (!hasStatus) {
        await knex.schema.alterTable('locations', (table) => {
          table.string('status', 50).defaultTo('active');
        });
      }
      try {
        await knex.raw('CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status)');
      } catch {}
    }
  },
  down: async () => {
    // No destructive down operation
  }
};
