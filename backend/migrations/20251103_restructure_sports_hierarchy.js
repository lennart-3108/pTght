/**
 * Migration: Restructure sports with 3-level hierarchy
 * Level 1: Categories (Ballsport, Racket Sports, Watersports, Bar & Fun Games, etc.)
 * Level 2: Sports (Tennis, Fußball, etc.)
 * Level 3: Variants (Tennis Einzel, Tennis Doppel, etc.)
 */

exports.up = async function (knex) {
  const hasSports = await knex.schema.hasTable('sports');
  if (!hasSports) return;

  // Add hierarchy columns if not exists
  const hasParentId = await knex.schema.hasColumn('sports', 'parent_id');
  const hasCategory = await knex.schema.hasColumn('sports', 'category');
  const hasLevel = await knex.schema.hasColumn('sports', 'level');
  
  if (!hasParentId || !hasCategory || !hasLevel) {
    await knex.schema.table('sports', (t) => {
      if (!hasParentId) {
        t.integer('parent_id')
          .nullable()
          .references('id')
          .inTable('sports')
          .onDelete('CASCADE')
          .comment('Parent sport for hierarchical structure');
      }
      if (!hasCategory) {
        t.string('category')
          .nullable()
          .comment('Category/variant name');
      }
      if (!hasLevel) {
        t.integer('level')
          .nullable()
          .defaultTo(1)
          .comment('1=Category, 2=Sport, 3=Variant');
      }
    });
  }

  // Mark existing sports as level 2 (Sports)
  await knex('sports').whereNull('level').update({ level: 2 });

  // Insert Level 1: Categories
  const categories = [
    { name: 'Ballsport', level: 1, category: 'team_ball' },
    { name: 'Racket Sports', level: 1, category: 'racket' },
    { name: 'Watersports', level: 1, category: 'water' },
    { name: 'Bar & Fun Games', level: 1, category: 'fun' },
    { name: 'Kampfsport', level: 1, category: 'combat' },
    { name: 'Radsport', level: 1, category: 'cycling' },
    { name: 'Leichtathletik', level: 1, category: 'athletics' },
    { name: 'Wintersport', level: 1, category: 'winter' },
  ];

  for (const cat of categories) {
    const exists = await knex('sports').where({ name: cat.name }).first();
    if (!exists) {
      await knex('sports').insert(cat);
    }
  }

  // Get category IDs
  const ballsport = await knex('sports').where({ name: 'Ballsport' }).first();
  const racket = await knex('sports').where({ name: 'Racket Sports' }).first();
  const water = await knex('sports').where({ name: 'Watersports' }).first();
  const fun = await knex('sports').where({ name: 'Bar & Fun Games' }).first();
  const combat = await knex('sports').where({ name: 'Kampfsport' }).first();

  // Assign existing sports to categories
  const sportMapping = [
    // Ballsport
    { name: 'Fußball', parent_id: ballsport?.id },
    { name: 'Basketball', parent_id: ballsport?.id },
    { name: 'Volleyball', parent_id: ballsport?.id },
    { name: 'Handball', parent_id: ballsport?.id },
    
    // Racket Sports
    { name: 'Tennis', parent_id: racket?.id },
    { name: 'Badminton', parent_id: racket?.id },
    { name: 'Tischtennis', parent_id: racket?.id },
    
    // Watersports
    { name: 'Schwimmen', parent_id: water?.id },
    
    // Fun
    { name: 'Dart', parent_id: fun?.id },
    { name: 'Billard', parent_id: fun?.id },
    { name: 'Bowling', parent_id: fun?.id },
  ];

  for (const sport of sportMapping) {
    if (!sport.parent_id) continue;
    await knex('sports')
      .where({ name: sport.name })
      .update({ parent_id: sport.parent_id, level: 2 });
  }

  // Insert Level 3: Variants for Tennis
  const tennis = await knex('sports').where({ name: 'Tennis' }).first();
  if (tennis) {
    const tennisVariants = [
      { name: 'Tennis Einzel', parent_id: tennis.id, level: 3, category: 'Einzel' },
      { name: 'Tennis Doppel', parent_id: tennis.id, level: 3, category: 'Doppel' },
      { name: 'Tennis Mixed', parent_id: tennis.id, level: 3, category: 'Mixed' },
      { name: 'Tennis Ü40', parent_id: tennis.id, level: 3, category: 'Senioren' },
    ];
    
    for (const variant of tennisVariants) {
      const exists = await knex('sports').where({ name: variant.name }).first();
      if (!exists) {
        await knex('sports').insert(variant);
      }
    }
  }

  // Variants for Fußball
  const fussball = await knex('sports').where({ name: 'Fußball' }).first();
  if (fussball) {
    const variants = [
      { name: 'Fußball 11vs11', parent_id: fussball.id, level: 3, category: 'Vollfeld' },
      { name: 'Fußball 7vs7', parent_id: fussball.id, level: 3, category: 'Kleinfeld' },
      { name: 'Fußball 5vs5', parent_id: fussball.id, level: 3, category: 'Futsal' },
    ];
    
    for (const variant of variants) {
      const exists = await knex('sports').where({ name: variant.name }).first();
      if (!exists) {
        await knex('sports').insert(variant);
      }
    }
  }

  // Variants for Basketball
  const basketball = await knex('sports').where({ name: 'Basketball' }).first();
  if (basketball) {
    const variants = [
      { name: 'Basketball 5vs5', parent_id: basketball.id, level: 3, category: 'Vollfeld' },
      { name: 'Basketball 3vs3', parent_id: basketball.id, level: 3, category: 'Streetball' },
    ];
    
    for (const variant of variants) {
      const exists = await knex('sports').where({ name: variant.name }).first();
      if (!exists) {
        await knex('sports').insert(variant);
      }
    }
  }

  console.log('[Migration] Sports hierarchy restructured successfully');
};

exports.down = async function (knex) {
  const hasSports = await knex.schema.hasTable('sports');
  if (!hasSports) return;

  // Delete all level 3 (variants)
  await knex('sports').where({ level: 3 }).del();
  
  // Delete all level 1 (categories)
  await knex('sports').where({ level: 1 }).del();
  
  // Reset level 2 sports
  await knex('sports').where({ level: 2 }).update({ parent_id: null, level: null });

  // Drop columns
  const hasParentId = await knex.schema.hasColumn('sports', 'parent_id');
  const hasCategory = await knex.schema.hasColumn('sports', 'category');
  const hasLevel = await knex.schema.hasColumn('sports', 'level');
  
  if (hasParentId || hasCategory || hasLevel) {
    await knex.schema.table('sports', (t) => {
      if (hasParentId) t.dropColumn('parent_id');
      if (hasCategory) t.dropColumn('category');
      if (hasLevel) t.dropColumn('level');
    });
  }
};
