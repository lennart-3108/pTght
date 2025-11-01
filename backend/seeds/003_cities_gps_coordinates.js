/**
 * Seed: Add GPS coordinates to major German cities
 */

exports.seed = async function(knex) {
  console.log('[Seed] Adding GPS coordinates to German cities...');

  const hasTable = await knex.schema.hasTable('cities').catch(() => false);
  if (!hasTable) {
    console.log('[Seed] Cities table does not exist, skipping.');
    return;
  }

  // Check if latitude/longitude columns exist
  const colInfo = await knex('cities').columnInfo().catch(() => ({}));
  const hasLat = Object.prototype.hasOwnProperty.call(colInfo, 'latitude');
  const hasLon = Object.prototype.hasOwnProperty.call(colInfo, 'longitude');

  if (!hasLat || !hasLon) {
    console.log('[Seed] Adding latitude/longitude columns to cities table...');
    await knex.schema.table('cities', table => {
      if (!hasLat) table.decimal('latitude', 10, 7).nullable();
      if (!hasLon) table.decimal('longitude', 10, 7).nullable();
    });
  }

  // Get Germany and states
  const germany = await knex('countries').where('code', 'DE').first().catch(() => null);
  if (!germany) {
    console.log('[Seed] Germany not found, skipping.');
    return;
  }

  const statesMap = {};
  const states = await knex('states').where('country_id', germany.id).catch(() => []);
  states.forEach(st => {
    statesMap[st.code] = st.id;
  });

  // Major German cities with GPS coordinates and state codes
  const citiesWithGPS = [
    { name: 'Berlin', lat: 52.5200, lon: 13.4050, state: 'DE-BE' },
    { name: 'Hamburg', lat: 53.5511, lon: 9.9937, state: 'DE-HH' },
    { name: 'München', lat: 48.1351, lon: 11.5820, state: 'DE-BY' },
    { name: 'Köln', lat: 50.9375, lon: 6.9603, state: 'DE-NW' },
    { name: 'Frankfurt am Main', lat: 50.1109, lon: 8.6821, state: 'DE-HE' },
    { name: 'Stuttgart', lat: 48.7758, lon: 9.1829, state: 'DE-BW' },
    { name: 'Düsseldorf', lat: 51.2277, lon: 6.7735, state: 'DE-NW' },
    { name: 'Dortmund', lat: 51.5136, lon: 7.4653, state: 'DE-NW' },
    { name: 'Essen', lat: 51.4556, lon: 7.0116, state: 'DE-NW' },
    { name: 'Leipzig', lat: 51.3397, lon: 12.3731, state: 'DE-SN' },
    { name: 'Bremen', lat: 53.0793, lon: 8.8017, state: 'DE-HB' },
    { name: 'Dresden', lat: 51.0504, lon: 13.7373, state: 'DE-SN' },
    { name: 'Hannover', lat: 52.3759, lon: 9.7320, state: 'DE-NI' },
    { name: 'Nürnberg', lat: 49.4521, lon: 11.0767, state: 'DE-BY' },
    { name: 'Duisburg', lat: 51.4344, lon: 6.7623, state: 'DE-NW' },
    { name: 'Bochum', lat: 51.4818, lon: 7.2162, state: 'DE-NW' },
    { name: 'Wuppertal', lat: 51.2562, lon: 7.1508, state: 'DE-NW' },
    { name: 'Bielefeld', lat: 52.0302, lon: 8.5325, state: 'DE-NW' },
    { name: 'Bonn', lat: 50.7374, lon: 7.0982, state: 'DE-NW' },
    { name: 'Münster', lat: 51.9607, lon: 7.6261, state: 'DE-NW' },
    { name: 'Karlsruhe', lat: 49.0069, lon: 8.4037, state: 'DE-BW' },
    { name: 'Mannheim', lat: 49.4875, lon: 8.4660, state: 'DE-BW' },
    { name: 'Augsburg', lat: 48.3705, lon: 10.8978, state: 'DE-BY' },
    { name: 'Wiesbaden', lat: 50.0826, lon: 8.2400, state: 'DE-HE' },
    { name: 'Gelsenkirchen', lat: 51.5177, lon: 7.0857, state: 'DE-NW' },
    { name: 'Mönchengladbach', lat: 51.1805, lon: 6.4428, state: 'DE-NW' },
    { name: 'Braunschweig', lat: 52.2689, lon: 10.5268, state: 'DE-NI' },
    { name: 'Chemnitz', lat: 50.8278, lon: 12.9214, state: 'DE-SN' },
    { name: 'Kiel', lat: 54.3233, lon: 10.1228, state: 'DE-SH' },
    { name: 'Aachen', lat: 50.7753, lon: 6.0839, state: 'DE-NW' },
    { name: 'Halle', lat: 51.4825, lon: 11.9707, state: 'DE-ST' },
    { name: 'Magdeburg', lat: 52.1205, lon: 11.6276, state: 'DE-ST' },
    { name: 'Freiburg', lat: 47.9990, lon: 7.8421, state: 'DE-BW' },
    { name: 'Krefeld', lat: 51.3388, lon: 6.5853, state: 'DE-NW' },
    { name: 'Lübeck', lat: 53.8655, lon: 10.6866, state: 'DE-SH' },
    { name: 'Mainz', lat: 49.9929, lon: 8.2473, state: 'DE-RP' },
    { name: 'Erfurt', lat: 50.9848, lon: 11.0299, state: 'DE-TH' }
  ];

  let updated = 0;
  let inserted = 0;

  for (const cityData of citiesWithGPS) {
    const stateId = statesMap[cityData.state];
    
    // Try to find existing city by name (case-insensitive)
    const existing = await knex('cities')
      .whereRaw('LOWER(name) = ?', [cityData.name.toLowerCase()])
      .first();

    if (existing) {
      // Update GPS coordinates and state
      await knex('cities')
        .where('id', existing.id)
        .update({
          latitude: cityData.lat,
          longitude: cityData.lon,
          state_id: stateId || existing.state_id,
          country_id: germany.id
        });
      updated++;
    } else {
      // Insert new city only if it doesn't exist
      try {
        await knex('cities').insert({
          name: cityData.name,
          country_id: germany.id,
          state_id: stateId,
          latitude: cityData.lat,
          longitude: cityData.lon
        });
        inserted++;
      } catch (e) {
        // Ignore duplicate errors
        console.log(`[Seed] Skipping duplicate city: ${cityData.name}`);
      }
    }
  }

  console.log(`[Seed] GPS coordinates: ${inserted} cities inserted, ${updated} cities updated.`);
};
