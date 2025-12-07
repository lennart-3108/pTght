/**
 * Repair Migration: Ensure assets.display_order exists
 */

module.exports = {
  up: async (knex) => {
    const hasCol = await knex.schema.hasColumn('assets', 'display_order').catch(() => false);
    if (!hasCol) {
      await knex.schema.alterTable('assets', (table) => {
        table.integer('display_order').defaultTo(0);
      });
      try { await knex.raw('CREATE INDEX IF NOT EXISTS assets_display_order_idx ON assets(display_order)'); } catch {}
      console.log('✓ Added assets.display_order');
    } else {
      console.log('✓ assets.display_order already exists');
    }
  },
  down: async () => {
    // Non-destructive
  }
};
