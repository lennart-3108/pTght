/**
 * Migration: Populate sport_categories with meaningful categories
 * and assign category_id to existing sports
 */

exports.up = async function(knex) {
  // 1) Insert sport categories
  const categories = [
    { name: 'Racketsportarten', slug: 'racket-sports', icon: '🎾', sort_order: 1 },
    { name: 'Ballsportarten', slug: 'ball-sports', icon: '⚽', sort_order: 2 },
    { name: 'Wassersportarten', slug: 'water-sports', icon: '🏊', sort_order: 3 },
    { name: 'Kampfsportarten', slug: 'combat-sports', icon: '🥋', sort_order: 4 },
    { name: 'Leichtathletik', slug: 'athletics', icon: '🏃', sort_order: 5 },
    { name: 'Radsport', slug: 'cycling', icon: '🚴', sort_order: 6 },
    { name: 'Sonstige', slug: 'other', icon: '🏆', sort_order: 99 }
  ];

  // Check if categories already exist
  const existingCategories = await knex('sport_categories').select('*');
  
  for (const cat of categories) {
    const exists = existingCategories.find(c => c.slug === cat.slug);
    if (!exists) {
      await knex('sport_categories').insert(cat);
    }
  }

  // 2) Get category IDs
  const racketSports = await knex('sport_categories').where({ slug: 'racket-sports' }).first();
  const ballSports = await knex('sport_categories').where({ slug: 'ball-sports' }).first();
  const waterSports = await knex('sport_categories').where({ slug: 'water-sports' }).first();
  const combatSports = await knex('sport_categories').where({ slug: 'combat-sports' }).first();
  const athletics = await knex('sport_categories').where({ slug: 'athletics' }).first();
  const cycling = await knex('sport_categories').where({ slug: 'cycling' }).first();
  const other = await knex('sport_categories').where({ slug: 'other' }).first();

  // 3) Ensure category_id column exists
  const hasCol = await knex.schema.hasColumn('sports', 'category_id');
  if (!hasCol) {
    await knex.schema.table('sports', t => {
      t.integer('category_id').unsigned().nullable();
      t.foreign('category_id').references('sport_categories.id').onDelete('SET NULL');
    });
  }

  // 4) Assign category_id to existing sports
  const sportsMapping = {
    // Racket sports
    'Tennis': racketSports?.id,
    'Tennis Einzel': racketSports?.id,
    'Tennis Doppel': racketSports?.id,
    'Tennis Mixed Doppel': racketSports?.id,
    'Tennis Mixed': racketSports?.id,
    'Badminton': racketSports?.id,
    'Tischtennis': racketSports?.id,

    // Ball sports
    'Fußball': ballSports?.id,
    'Fußball 11 vs 11': ballSports?.id,
    'Fußball 7 vs 7': ballSports?.id,
    'Fußball 5 vs 5': ballSports?.id,
    'Basketball': ballSports?.id,
    'Basketball 5 vs 5': ballSports?.id,
    'Basketball 3 vs 3': ballSports?.id,
    'Volleyball': ballSports?.id,
    'Volleyball Indoor': ballSports?.id,
    'Volleyball Beach': ballSports?.id,
    'Handball': ballSports?.id,
    'Handball 7 vs 7': ballSports?.id,
    'Handball 5 vs 5': ballSports?.id,

    // Water sports
    'Schwimmen': waterSports?.id,
    'Schwimmen Freistil': waterSports?.id,
    'Schwimmen Brust': waterSports?.id,
    'Schwimmen Rücken': waterSports?.id,
    'Schwimmen Schmetterling': waterSports?.id,
    'Wassersport': waterSports?.id,
    'Wasserball': waterSports?.id,
    'Surfen': waterSports?.id,

    // Combat sports
    'Kampfsport': combatSports?.id,
    'Boxen': combatSports?.id,
    'Judo': combatSports?.id,
    'Karate': combatSports?.id,
    'Taekwondo': combatSports?.id,
    'MMA': combatSports?.id,

    // Athletics
    'Laufen': athletics?.id,
    'Leichtathletik': athletics?.id,
    'Sprint 100m': athletics?.id,
    'Mittelstrecke 800m': athletics?.id,
    'Langstrecke Marathon': athletics?.id,
    'Hochsprung': athletics?.id,
    'Weitsprung': athletics?.id,
    'Kugelstoßen': athletics?.id,
    'Speerwerfen': athletics?.id,

    // Cycling
    'Radsport': cycling?.id,
    'Rennrad': cycling?.id,
    'Mountainbike': cycling?.id,
    'Bahnradsport': cycling?.id,
    'BMX': cycling?.id,

    // Other
    'Wintersport': other?.id
  };

  for (const [sportName, categoryId] of Object.entries(sportsMapping)) {
    if (categoryId) {
      await knex('sports').where({ name: sportName }).update({ category_id: categoryId });
    }
  }

  console.log('[Migration] Sport categories populated and sports assigned to categories');
};

exports.down = async function(knex) {
  // Reset category_id for all sports
  await knex('sports').update({ category_id: null });
  
  // Delete categories
  await knex('sport_categories').whereIn('slug', [
    'racket-sports',
    'ball-sports',
    'water-sports',
    'combat-sports',
    'athletics',
    'cycling',
    'other'
  ]).del();
};
