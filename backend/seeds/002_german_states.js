/**
 * Seed: Complete German states (Bundesländer) with ISO 3166-2 codes
 */

exports.seed = async function(knex) {
  console.log('[Seed] Populating German states (Bundesländer)...');

  // Check if states table exists
  const hasStates = await knex.schema.hasTable('states').catch(() => false);
  if (!hasStates) {
    console.log('[Seed] States table does not exist, skipping.');
    return;
  }

  // Get Germany's ID from countries table
  const germany = await knex('countries').where('code', 'DE').first().catch(() => null);
  if (!germany) {
    console.log('[Seed] Germany not found in countries table, skipping.');
    return;
  }

  const countryId = germany.id;
  console.log(`[Seed] Found Germany with ID ${countryId}`);

  // All 16 German states with ISO 3166-2:DE codes
  const germanStates = [
    { code: 'DE-BW', name: 'Baden-Württemberg', type: 'state' },
    { code: 'DE-BY', name: 'Bayern', type: 'state' },
    { code: 'DE-BE', name: 'Berlin', type: 'state' },
    { code: 'DE-BB', name: 'Brandenburg', type: 'state' },
    { code: 'DE-HB', name: 'Bremen', type: 'state' },
    { code: 'DE-HH', name: 'Hamburg', type: 'state' },
    { code: 'DE-HE', name: 'Hessen', type: 'state' },
    { code: 'DE-MV', name: 'Mecklenburg-Vorpommern', type: 'state' },
    { code: 'DE-NI', name: 'Niedersachsen', type: 'state' },
    { code: 'DE-NW', name: 'Nordrhein-Westfalen', type: 'state' },
    { code: 'DE-RP', name: 'Rheinland-Pfalz', type: 'state' },
    { code: 'DE-SL', name: 'Saarland', type: 'state' },
    { code: 'DE-SN', name: 'Sachsen', type: 'state' },
    { code: 'DE-ST', name: 'Sachsen-Anhalt', type: 'state' },
    { code: 'DE-SH', name: 'Schleswig-Holstein', type: 'state' },
    { code: 'DE-TH', name: 'Thüringen', type: 'state' }
  ];

  // Insert or update each state
  let inserted = 0;
  let updated = 0;

  for (const state of germanStates) {
    const existing = await knex('states').where('code', state.code).first();
    
    if (existing) {
      // Update to ensure correct country_id and name
      await knex('states')
        .where('code', state.code)
        .update({
          country_id: countryId,
          name: state.name,
          type: state.type
        });
      updated++;
    } else {
      // Insert new state
      await knex('states').insert({
        country_id: countryId,
        code: state.code,
        name: state.name,
        type: state.type
      });
      inserted++;
    }
  }

  console.log(`[Seed] German states: ${inserted} inserted, ${updated} updated.`);
};
