/**
 * Generate slots for Tennis Center München (Location ID 10)
 * Creates slots for next 30 days, 8:00-22:00, 1-hour slots
 */

const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig);

async function generateSlots() {
  try {
    console.log('🎾 Generiere Slots für Tennis Center München...\n');

    // Get all assets for location 10
    const assets = await knex('assets')
      .where({ location_id: 10 })
      .select('id', 'name', 'slot_duration');

    if (assets.length === 0) {
      console.log('❌ Keine Assets gefunden für Location 10');
      process.exit(1);
    }

    console.log(`✓ ${assets.length} Assets gefunden\n`);

    // Generate slots for next 30 days
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    const slots = [];
    let totalCount = 0;

    // For each asset
    for (const asset of assets) {
      const duration = asset.slot_duration || 60; // minutes
      const basePrice = 25.0; // Standard price for tennis courts

      console.log(`📍 ${asset.name} (€${basePrice}/${duration}min)`);

      let dayCount = 0;

      // For each day
      for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
        // Opening hours: 8:00 - 22:00
        for (let hour = 8; hour < 22; hour++) {
          const slotStart = new Date(d);
          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + duration);

          // Don't create slots that end after 22:00
          if (slotEnd.getHours() > 22) continue;

          slots.push({
            asset_id: asset.id,
            location_id: 10,
            start_time: slotStart.toISOString(),
            end_time: slotEnd.toISOString(),
            duration_minutes: duration,
            base_price: basePrice,
            currency: 'EUR',
            status: 'available',
            created_at: knex.fn.now(),
            updated_at: knex.fn.now()
          });

          dayCount++;
        }
      }

      totalCount += dayCount;
      console.log(`   → ${dayCount} Slots erstellt`);
    }

    console.log(`\n💾 Speichere ${totalCount} Slots in Datenbank...`);

    // Insert in batches of 500
    const batchSize = 500;
    for (let i = 0; i < slots.length; i += batchSize) {
      const batch = slots.slice(i, i + batchSize);
      await knex('slots').insert(batch);
      console.log(`   ✓ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(slots.length / batchSize)} gespeichert`);
    }

    console.log(`\n✅ Fertig! ${totalCount} Slots erfolgreich generiert.`);

    // Show summary
    const summary = await knex('slots')
      .where('asset_id', 'in', assets.map(a => a.id))
      .select(
        knex.raw('DATE(start_time) as date'),
        knex.raw('COUNT(*) as count')
      )
      .groupBy('date')
      .orderBy('date')
      .limit(7);

    console.log('\n📊 Erste 7 Tage:');
    summary.forEach(row => {
      const date = new Date(row.date);
      console.log(`   ${date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}: ${row.count} Slots`);
    });

  } catch (error) {
    console.error('❌ Fehler:', error);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

generateSlots();
