const knex = require('../db');

async function createTestTennisLocation() {
  try {
    console.log('🎾 Creating test tennis location with 10 courts...');

    // Find Tennis sport IDs
    const tennisSports = await knex('sports')
      .where('name', 'like', '%Tennis%');
    
    console.log(`Found ${tennisSports.length} tennis sports`);
    
    // Get a default user as owner (first user in DB)
    const defaultUser = await knex('users').first();
    if (!defaultUser) {
      throw new Error('No users found in database. Please create a user first.');
    }
    
    // Create location
    const [locationId] = await knex('locations').insert({
      owner_id: defaultUser.id,
      name: 'Tennis Center München',
      address: 'Olympiapark 1',
      city: 'München',
      state: 'Bayern',
      country: 'Deutschland',
      postal_code: '80809',
      latitude: 48.1751,
      longitude: 11.5451,
      description: 'Modernes Tennis-Zentrum mit 10 Plätzen verschiedener Beläge. Indoor- und Outdoor-Anlagen mit modernster Ausstattung.',
      phone: '+49 89 12345678',
      email: 'info@tennis-center-muenchen.de',
      website: 'https://tennis-center-muenchen.de',
      status: 'active',
      created_at: knex.fn.now()
    });

    console.log(`✅ Created location with ID: ${locationId}`);

    // Court configurations
    const courts = [
      // 6x Sand courts
      {
        name: 'Sandplatz 1',
        description: 'Outdoor Sandplatz mit Flutlicht und Windschutz',
        surface: 'Sand',
        indoor: false,
        features: 'Outdoor, Flutlicht, Windschutz'
      },
      {
        name: 'Sandplatz 2',
        description: 'Outdoor Sandplatz mit Flutlicht',
        surface: 'Sand',
        indoor: false,
        features: 'Outdoor, Flutlicht'
      },
      {
        name: 'Sandplatz 3 (Traglufthalle)',
        description: 'Indoor Sandplatz in Traglufthalle, ganzjährig bespielbar',
        surface: 'Sand',
        indoor: true,
        features: 'Indoor, Traglufthalle, Heizung, Flutlicht'
      },
      {
        name: 'Sandplatz 4 (Traglufthalle)',
        description: 'Indoor Sandplatz in Traglufthalle, ganzjährig bespielbar',
        surface: 'Sand',
        indoor: true,
        features: 'Indoor, Traglufthalle, Heizung, Flutlicht'
      },
      {
        name: 'Sandplatz 5',
        description: 'Outdoor Sandplatz mit Tribüne',
        surface: 'Sand',
        indoor: false,
        features: 'Outdoor, Tribüne, Flutlicht'
      },
      {
        name: 'Sandplatz 6',
        description: 'Outdoor Sandplatz, Trainingsplatz',
        surface: 'Sand',
        indoor: false,
        features: 'Outdoor, Trainingsplatz'
      },

      // 2x Rasen courts
      {
        name: 'Rasenplatz 1 (Stadion)',
        description: 'Outdoor Rasenplatz im Stadion, Center Court mit 500 Sitzplätzen',
        surface: 'Rasen',
        indoor: false,
        features: 'Outdoor, Stadion, Tribüne 500 Plätze, Flutlicht, Kamera'
      },
      {
        name: 'Rasenplatz 2 (Stadion)',
        description: 'Outdoor Rasenplatz im Stadion, Court 2 mit 200 Sitzplätzen',
        surface: 'Rasen',
        indoor: false,
        features: 'Outdoor, Stadion, Tribüne 200 Plätze, Flutlicht'
      },

      // 2x Hardcourt
      {
        name: 'Hardcourt 1 (Schiebedach)',
        description: 'Indoor/Outdoor Hardcourt mit Schiebedach, wetterunabhängig',
        surface: 'Hardcourt',
        indoor: true, // Can be both
        features: 'Indoor/Outdoor, Schiebedach, Klimaanlage, Flutlicht'
      },
      {
        name: 'Hardcourt 2 (Schiebedach)',
        description: 'Indoor/Outdoor Hardcourt mit Schiebedach, wetterunabhängig',
        surface: 'Hardcourt',
        indoor: true, // Can be both
        features: 'Indoor/Outdoor, Schiebedach, Klimaanlage, Flutlicht'
      }
    ];

    // Create assets for each court
    const assetInserts = [];
    
    for (let i = 0; i < courts.length; i++) {
      const court = courts[i];
      
      // Pricing based on surface
      let basePrice = 20; // Default
      if (court.surface === 'Rasen') basePrice = 50; // Premium
      if (court.surface === 'Hardcourt' && court.features.includes('Schiebedach')) basePrice = 35;
      if (court.indoor) basePrice += 5; // Indoor surcharge

      assetInserts.push({
        location_id: locationId,
        name: court.name,
        type: 'Tennisplatz',
        description: court.description,
        surface: court.surface,
        capacity: 4, // 2 players + 2 for doubles
        slot_duration: 60, // 60 minutes default
        slot_pause: 15, // 15 min cleaning/changeover
        advance_booking_days: 30,
        cancellation_hours: 24,
        status: 'active',
        indoor: court.indoor ? 1 : 0,
        amenities: JSON.stringify([
          court.surface,
          court.indoor ? 'Indoor' : 'Outdoor',
          ...court.features.split(', ')
        ]),
        created_at: knex.fn.now()
      });
    }

    await knex('assets').insert(assetInserts);
    
    console.log(`✅ Created ${assetInserts.length} tennis courts`);
    console.log('\n📊 Court Summary:');
    console.log(`   - 6x Sandplätze (4 indoor Traglufthalle, 2 outdoor)`);
    console.log(`   - 2x Rasenplätze (beide outdoor Stadion)`);
    console.log(`   - 2x Hardcourt (beide mit Schiebedach indoor/outdoor)`);

    // Update assets with supported_sports JSON field instead of junction table
    const assets = await knex('assets').where({ location_id: locationId });
    const sportIds = tennisSports.map(s => s.id);
    
    for (const asset of assets) {
      await knex('assets')
        .where({ id: asset.id })
        .update({ 
          supported_sports: JSON.stringify(sportIds),
          sports_json: JSON.stringify(tennisSports.map(s => ({ id: s.id, name: s.name })))
        });
    }
    
    console.log(`✅ Linked ${tennisSports.length} tennis sports to all ${assets.length} courts`);

    console.log('\n✨ Test location created successfully!');
    console.log(`Location ID: ${locationId}`);
    console.log(`Access at: http://localhost:3000/slots`);

  } catch (error) {
    console.error('❌ Error creating test location:', error);
    throw error;
  } finally {
    await knex.destroy();
  }
}

// Run if called directly
if (require.main === module) {
  createTestTennisLocation()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = createTestTennisLocation;
