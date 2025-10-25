/**
 * Seed: Sample locations and assets
 * Creates demo data for development and testing
 */

exports.seed = async function(knex) {
  // Get some existing users to be location owners
  const users = await knex('users').select('id').limit(3);
  
  if (users.length === 0) {
    console.log('No users found. Skipping location seed.');
    return;
  }

  // Get some sports IDs
  const sports = await knex('sports').select('id', 'name');
  const soccerId = sports.find(s => s.name === 'Fußball')?.id;
  const tennisId = sports.find(s => s.name === 'Tennis')?.id;
  const basketballId = sports.find(s => s.name === 'Basketball')?.id;

  // Clear existing demo data
  await knex('slots').where('location_id', '<=', 10).del();
  await knex('assets').where('location_id', '<=', 10).del();
  await knex('locations').where('id', '<=', 10).del();

  // Create sample locations
  const locations = [
    {
      id: 1,
      owner_id: users[0].id,
      name: 'Sportpark Berlin Mitte',
      description: 'Moderner Sportpark mit verschiedenen Anlagen im Herzen Berlins',
      address: 'Sportstr. 12',
      city: 'Berlin',
      postal_code: '10115',
      country: 'Deutschland',
      latitude: 52.5200,
      longitude: 13.4050,
      phone: '+49 30 12345678',
      email: 'info@sportpark-berlin.de',
      website: 'https://sportpark-berlin.de',
      timezone: 'Europe/Berlin',
      opening_hours: JSON.stringify({
        mon: [{from: '07:00', to: '22:00'}],
        tue: [{from: '07:00', to: '22:00'}],
        wed: [{from: '07:00', to: '22:00'}],
        thu: [{from: '07:00', to: '22:00'}],
        fri: [{from: '07:00', to: '23:00'}],
        sat: [{from: '08:00', to: '23:00'}],
        sun: [{from: '08:00', to: '21:00'}]
      }),
      status: 'active',
      is_verified: true,
      rating: 4.5,
      review_count: 127,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 2,
      owner_id: users[0].id,
      name: 'Tennis Club München',
      description: 'Erstklassiger Tennisclub mit Indoor- und Outdoor-Plätzen',
      address: 'Tennisweg 5',
      city: 'München',
      postal_code: '80333',
      country: 'Deutschland',
      latitude: 48.1351,
      longitude: 11.5820,
      phone: '+49 89 98765432',
      email: 'info@tennis-muenchen.de',
      timezone: 'Europe/Berlin',
      opening_hours: JSON.stringify({
        mon: [{from: '06:00', to: '22:00'}],
        tue: [{from: '06:00', to: '22:00'}],
        wed: [{from: '06:00', to: '22:00'}],
        thu: [{from: '06:00', to: '22:00'}],
        fri: [{from: '06:00', to: '23:00'}],
        sat: [{from: '07:00', to: '23:00'}],
        sun: [{from: '07:00', to: '21:00'}]
      }),
      status: 'active',
      is_verified: true,
      rating: 4.8,
      review_count: 89,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: 3,
      owner_id: users.length > 1 ? users[1].id : users[0].id,
      name: 'Hamburg Sporthalle Nord',
      description: 'Große Mehrzweckhalle für verschiedene Hallensportarten',
      address: 'Hallenstr. 23',
      city: 'Hamburg',
      postal_code: '20095',
      country: 'Deutschland',
      latitude: 53.5511,
      longitude: 9.9937,
      phone: '+49 40 11223344',
      email: 'info@sporthalle-nord.de',
      timezone: 'Europe/Berlin',
      opening_hours: JSON.stringify({
        mon: [{from: '08:00', to: '22:00'}],
        tue: [{from: '08:00', to: '22:00'}],
        wed: [{from: '08:00', to: '22:00'}],
        thu: [{from: '08:00', to: '22:00'}],
        fri: [{from: '08:00', to: '22:00'}],
        sat: [{from: '09:00', to: '20:00'}],
        sun: [{from: '09:00', to: '20:00'}]
      }),
      status: 'active',
      is_verified: true,
      rating: 4.3,
      review_count: 56,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ];

  await knex('locations').insert(locations);

  // Create assets for each location
  const assets = [];
  
  // Berlin Sportpark assets
  if (soccerId) {
    assets.push({
      location_id: 1,
      name: 'Fußballplatz 1',
      description: 'Hauptplatz mit Kunstrasen',
      type: 'field',
      supported_sports: JSON.stringify([{sport_id: soccerId, formats: ['5v5', '7v7', '11v11']}]),
      surface: 'artificial turf',
      indoor: false,
      capacity: 100,
      equipment: JSON.stringify(['goals', 'lighting', 'seating']),
      status: 'active',
      display_order: 1
    });
    
    assets.push({
      location_id: 1,
      name: 'Kleinfeld',
      description: 'Kleinfeld für 5v5',
      type: 'field',
      supported_sports: JSON.stringify([{sport_id: soccerId, formats: ['5v5']}]),
      surface: 'artificial turf',
      indoor: false,
      capacity: 50,
      equipment: JSON.stringify(['goals', 'lighting']),
      status: 'active',
      display_order: 2
    });
  }

  // Munich Tennis Club assets
  if (tennisId) {
    for (let i = 1; i <= 4; i++) {
      assets.push({
        location_id: 2,
        name: `Tennisplatz ${i}`,
        description: i <= 2 ? 'Indoor-Platz mit Hartbelag' : 'Outdoor-Platz mit Sandbelag',
        type: 'court',
        supported_sports: JSON.stringify([{sport_id: tennisId, formats: ['singles', 'doubles']}]),
        surface: i <= 2 ? 'hard' : 'clay',
        indoor: i <= 2,
        capacity: 20,
        equipment: JSON.stringify(['net', 'lighting', 'seating']),
        amenities: i <= 2 ? JSON.stringify(['heating', 'wifi']) : JSON.stringify(['wifi']),
        length: 23.77,
        width: 10.97,
        status: 'active',
        display_order: i
      });
    }
  }

  // Hamburg Hall assets
  if (basketballId) {
    assets.push({
      location_id: 3,
      name: 'Haupthalle',
      description: 'Große Halle für Volleyball und Basketball',
      type: 'hall',
      supported_sports: JSON.stringify([
        {sport_id: basketballId, formats: ['5v5']},
      ]),
      surface: 'parquet',
      indoor: true,
      capacity: 200,
      equipment: JSON.stringify(['baskets', 'scoreboard', 'seating', 'lighting']),
      amenities: JSON.stringify(['parking', 'showers', 'wifi', 'cafe']),
      length: 28,
      width: 15,
      status: 'active',
      display_order: 1
    });
  }

  await knex('assets').insert(assets);

  // Create sample slots for next 7 days
  const insertedAssets = await knex('assets').whereIn('location_id', [1, 2, 3]).select('*');
  const slots = [];
  
  // Generate slots for each asset
  for (const asset of insertedAssets) {
    const location = locations.find(l => l.id === asset.location_id);
    
    // Generate slots for next 7 days
    for (let day = 0; day < 7; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);
      
      // Morning slots (9:00 - 12:00)
      for (let hour = 9; hour < 12; hour++) {
        const startTime = new Date(date);
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(startTime);
        endTime.setHours(hour + 1, 0, 0, 0);
        
        slots.push({
          asset_id: asset.id,
          location_id: asset.location_id,
          start_time: startTime.toISOString().slice(0, 19).replace('T', ' '),
          end_time: endTime.toISOString().slice(0, 19).replace('T', ' '),
          duration_minutes: 60,
          buffer_before: 5,
          buffer_after: 5,
          base_price: asset.type === 'court' ? 25 : asset.type === 'field' ? 50 : 40,
          currency: 'EUR',
          status: 'available',
          visibility: 'public',
          is_boosted: day === 0 && hour === 9, // Boost some morning slots for today
          boost_rank: day === 0 && hour === 9 ? 10 : 0,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        });
      }
      
      // Afternoon/Evening slots (14:00 - 21:00)
      for (let hour = 14; hour < 21; hour++) {
        const startTime = new Date(date);
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(startTime);
        endTime.setHours(hour + 1, 0, 0, 0);
        
        // Peak hours (18:00-21:00) cost more
        const isPeakHour = hour >= 18;
        
        slots.push({
          asset_id: asset.id,
          location_id: asset.location_id,
          start_time: startTime.toISOString().slice(0, 19).replace('T', ' '),
          end_time: endTime.toISOString().slice(0, 19).replace('T', ' '),
          duration_minutes: 60,
          buffer_before: 5,
          buffer_after: 5,
          base_price: (asset.type === 'court' ? 25 : asset.type === 'field' ? 50 : 40) * (isPeakHour ? 1.5 : 1),
          currency: 'EUR',
          status: 'available',
          visibility: 'public',
          is_boosted: false,
          boost_rank: 0,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        });
      }
    }
  }

  await knex('slots').insert(slots);

  console.log(`Created ${locations.length} locations, ${assets.length} assets, and ${slots.length} slots`);
};
