/**
 * Migration: Complete Sports Database Restructure
 * - Create result_types table for different scoring systems
 * - Restructure sports with comprehensive hobby & trend sports
 * - Clean up old/duplicate data
 * - 3-Level hierarchy: Categories → Sports → Disciplines
 */

exports.up = async function(knex) {
  console.log('[Sports Restructure] Starting complete restructure...');

  // ===== 1. CREATE RESULT_TYPES TABLE =====
  const hasResultTypes = await knex.schema.hasTable('result_types');
  if (!hasResultTypes) {
    await knex.schema.createTable('result_types', (table) => {
      table.increments('id').primary();
      table.string('name', 100).notNullable().unique();
      table.string('slug', 100).notNullable().unique();
      table.text('description');
      table.string('icon', 10);
      table.json('schema').comment('JSON schema for result structure');
      table.timestamps(true, true);
    });
    console.log('[Sports Restructure] ✓ result_types table created');
  }

  // ===== 2. INSERT RESULT TYPES =====
  const resultTypes = [
    {
      name: 'Set-basiert',
      slug: 'set-based',
      icon: '🎾',
      description: 'Gewinnsätze (z.B. Tennis 2/3 Sätze, Volleyball 3 Sätze)',
      schema: JSON.stringify({
        type: 'sets',
        fields: ['home_sets', 'away_sets', 'set_details'],
        example: { home_sets: 2, away_sets: 1, set_details: '6:4, 3:6, 6:2' }
      })
    },
    {
      name: 'Ergebnis-basiert',
      slug: 'score-based',
      icon: '⚽',
      description: 'Endergebnis/Tore/Punkte (z.B. Fußball, Basketball)',
      schema: JSON.stringify({
        type: 'score',
        fields: ['home_score', 'away_score'],
        example: { home_score: 3, away_score: 2 }
      })
    },
    {
      name: 'Zeit-basiert',
      slug: 'time-based',
      icon: '⏱️',
      description: 'Beste Zeit gewinnt (z.B. Laufen, Schwimmen)',
      schema: JSON.stringify({
        type: 'time',
        fields: ['time_seconds', 'rank'],
        example: { time_seconds: 125.43, rank: 1 }
      })
    },
    {
      name: 'Jury-basiert',
      slug: 'jury-based',
      icon: '🎭',
      description: 'Jury-Bewertung (z.B. Eiskunstlauf, Turnen)',
      schema: JSON.stringify({
        type: 'jury',
        fields: ['score', 'judges_scores'],
        example: { score: 9.5, judges_scores: [9.4, 9.6, 9.5] }
      })
    },
    {
      name: 'Binär',
      slug: 'binary',
      icon: '♟️',
      description: 'Sieger/Verlierer ohne Punkte (z.B. Schach)',
      schema: JSON.stringify({
        type: 'binary',
        fields: ['winner_id'],
        example: { winner_id: 123 }
      })
    },
    {
      name: 'Distanz-basiert',
      slug: 'distance-based',
      icon: '📏',
      description: 'Weiteste Distanz gewinnt (z.B. Weitsprung)',
      schema: JSON.stringify({
        type: 'distance',
        fields: ['distance_meters', 'rank'],
        example: { distance_meters: 8.25, rank: 1 }
      })
    },
    {
      name: 'Punkte-basiert',
      slug: 'points-based',
      icon: '🏆',
      description: 'Punktesystem (z.B. Biathlon, Mehrkampf)',
      schema: JSON.stringify({
        type: 'points',
        fields: ['points', 'rank'],
        example: { points: 8543, rank: 1 }
      })
    }
  ];

  for (const rt of resultTypes) {
    const exists = await knex('result_types').where({ slug: rt.slug }).first();
    if (!exists) {
      await knex('result_types').insert(rt);
    }
  }
  console.log('[Sports Restructure] ✓ Result types inserted');

  // ===== 3. ADD result_type_id TO SPORTS =====
  const hasResultTypeId = await knex.schema.hasColumn('sports', 'result_type_id');
  if (!hasResultTypeId) {
    await knex.schema.table('sports', (table) => {
      table.integer('result_type_id').unsigned().nullable();
      table.foreign('result_type_id').references('result_types.id').onDelete('SET NULL');
    });
    console.log('[Sports Restructure] ✓ result_type_id column added to sports');
  }

  // ===== 4. GET RESULT TYPE IDs =====
  const rtSetBased = await knex('result_types').where({ slug: 'set-based' }).first();
  const rtScoreBased = await knex('result_types').where({ slug: 'score-based' }).first();
  const rtTimeBased = await knex('result_types').where({ slug: 'time-based' }).first();
  const rtJuryBased = await knex('result_types').where({ slug: 'jury-based' }).first();
  const rtBinary = await knex('result_types').where({ slug: 'binary' }).first();
  const rtDistanceBased = await knex('result_types').where({ slug: 'distance-based' }).first();
  const rtPointsBased = await knex('result_types').where({ slug: 'points-based' }).first();

  // ===== 5. CLEAN UP OLD SPORTS DATA =====
  console.log('[Sports Restructure] Cleaning up old sports...');
  await knex('sports').whereNotNull('parent_id').del();
  await knex('sports').whereIn('name', [
    'Kampfsport', 'Wassersport', 'Radsport', 'Wintersport', 'Leichtathletik',
    'Tennis Mixed', 'Schwimmen', 'Laufen'
  ]).del();
  console.log('[Sports Restructure] ✓ Old sports cleaned up');

  // ===== 6. UPDATE SPORT CATEGORIES =====
  const categories = [
    { name: 'Racketsportarten', slug: 'racket-sports', icon: '🎾', sort_order: 1 },
    { name: 'Ballsportarten', slug: 'ball-sports', icon: '⚽', sort_order: 2 },
    { name: 'Wassersportarten', slug: 'water-sports', icon: '🏊', sort_order: 3 },
    { name: 'Kampfsportarten', slug: 'combat-sports', icon: '🥋', sort_order: 4 },
    { name: 'Ausdauersport', slug: 'endurance-sports', icon: '🏃', sort_order: 5 },
    { name: 'Kraftsport', slug: 'strength-sports', icon: '💪', sort_order: 6 },
    { name: 'Wintersport', slug: 'winter-sports', icon: '⛷️', sort_order: 7 },
    { name: 'Trendsport', slug: 'trend-sports', icon: '🛹', sort_order: 8 },
    { name: 'Denksport', slug: 'mind-sports', icon: '♟️', sort_order: 9 },
    { name: 'Extremsport', slug: 'extreme-sports', icon: '🪂', sort_order: 10 },
    { name: 'Sonstige', slug: 'other', icon: '🏆', sort_order: 99 }
  ];

  for (const cat of categories) {
    const exists = await knex('sport_categories').where({ slug: cat.slug }).first();
    if (!exists) {
      await knex('sport_categories').insert(cat);
    }
  }
  console.log('[Sports Restructure] ✓ Sport categories updated');

  // ===== 7. GET CATEGORY IDs =====
  const catRacket = await knex('sport_categories').where({ slug: 'racket-sports' }).first();
  const catBall = await knex('sport_categories').where({ slug: 'ball-sports' }).first();
  const catWater = await knex('sport_categories').where({ slug: 'water-sports' }).first();
  const catCombat = await knex('sport_categories').where({ slug: 'combat-sports' }).first();
  const catEndurance = await knex('sport_categories').where({ slug: 'endurance-sports' }).first();
  const catStrength = await knex('sport_categories').where({ slug: 'strength-sports' }).first();
  const catWinter = await knex('sport_categories').where({ slug: 'winter-sports' }).first();
  const catTrend = await knex('sport_categories').where({ slug: 'trend-sports' }).first();
  const catMind = await knex('sport_categories').where({ slug: 'mind-sports' }).first();
  const catExtreme = await knex('sport_categories').where({ slug: 'extreme-sports' }).first();
  const catOther = await knex('sport_categories').where({ slug: 'other' }).first();

  // ===== 8. INSERT COMPREHENSIVE SPORTS DATABASE =====
  const allSports = [
    // ========== RACKET SPORTS ==========
    { name: 'Tennis', category_id: catRacket?.id, result_type_id: rtSetBased?.id, parent_id: null },
    { name: 'Badminton', category_id: catRacket?.id, result_type_id: rtSetBased?.id, parent_id: null },
    { name: 'Tischtennis', category_id: catRacket?.id, result_type_id: rtSetBased?.id, parent_id: null },
    { name: 'Squash', category_id: catRacket?.id, result_type_id: rtSetBased?.id, parent_id: null },
    { name: 'Padel', category_id: catRacket?.id, result_type_id: rtSetBased?.id, parent_id: null },
    { name: 'Racquetball', category_id: catRacket?.id, result_type_id: rtSetBased?.id, parent_id: null },
    { name: 'Pickleball', category_id: catRacket?.id, result_type_id: rtSetBased?.id, parent_id: null },

    // ========== BALL SPORTS ==========
    { name: 'Fußball', category_id: catBall?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Basketball', category_id: catBall?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Volleyball', category_id: catBall?.id, result_type_id: rtSetBased?.id, parent_id: null },
    { name: 'Handball', category_id: catBall?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Eishockey', category_id: catBall?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'American Football', category_id: catBall?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Rugby', category_id: catBall?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Baseball', category_id: catBall?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Cricket', category_id: catBall?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Hockey', category_id: catBall?.id, result_type_id: rtScoreBased?.id, parent_id: null },

    // ========== WATER SPORTS ==========
    { name: 'Schwimmen', category_id: catWater?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Wasserball', category_id: catWater?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Surfen', category_id: catWater?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Segeln', category_id: catWater?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Rudern', category_id: catWater?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Kanufahren', category_id: catWater?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Wasserski', category_id: catWater?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Wakeboarden', category_id: catWater?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Kitesurfen', category_id: catWater?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Stand-Up Paddling', category_id: catWater?.id, result_type_id: rtTimeBased?.id, parent_id: null },

    // ========== COMBAT SPORTS ==========
    { name: 'Boxen', category_id: catCombat?.id, result_type_id: rtPointsBased?.id, parent_id: null },
    { name: 'Judo', category_id: catCombat?.id, result_type_id: rtPointsBased?.id, parent_id: null },
    { name: 'Karate', category_id: catCombat?.id, result_type_id: rtPointsBased?.id, parent_id: null },
    { name: 'Taekwondo', category_id: catCombat?.id, result_type_id: rtPointsBased?.id, parent_id: null },
    { name: 'MMA', category_id: catCombat?.id, result_type_id: rtBinary?.id, parent_id: null },
    { name: 'Kickboxen', category_id: catCombat?.id, result_type_id: rtPointsBased?.id, parent_id: null },
    { name: 'Ringen', category_id: catCombat?.id, result_type_id: rtPointsBased?.id, parent_id: null },
    { name: 'Fechten', category_id: catCombat?.id, result_type_id: rtScoreBased?.id, parent_id: null },

    // ========== ENDURANCE SPORTS ==========
    { name: 'Laufen', category_id: catEndurance?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Radfahren', category_id: catEndurance?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Triathlon', category_id: catEndurance?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Marathon', category_id: catEndurance?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Wandern', category_id: catEndurance?.id, result_type_id: rtTimeBased?.id, parent_id: null },

    // ========== STRENGTH SPORTS ==========
    { name: 'Gewichtheben', category_id: catStrength?.id, result_type_id: rtDistanceBased?.id, parent_id: null },
    { name: 'Kraftdreikampf', category_id: catStrength?.id, result_type_id: rtDistanceBased?.id, parent_id: null },
    { name: 'Bodybuilding', category_id: catStrength?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'CrossFit', category_id: catStrength?.id, result_type_id: rtPointsBased?.id, parent_id: null },
    { name: 'Kugelstoßen', category_id: catStrength?.id, result_type_id: rtDistanceBased?.id, parent_id: null },
    { name: 'Speerwerfen', category_id: catStrength?.id, result_type_id: rtDistanceBased?.id, parent_id: null },
    { name: 'Diskuswerfen', category_id: catStrength?.id, result_type_id: rtDistanceBased?.id, parent_id: null },
    { name: 'Hammerwerfen', category_id: catStrength?.id, result_type_id: rtDistanceBased?.id, parent_id: null },

    // ========== WINTER SPORTS ==========
    { name: 'Skifahren', category_id: catWinter?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Snowboarden', category_id: catWinter?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Eiskunstlauf', category_id: catWinter?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Eisschnelllauf', category_id: catWinter?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Biathlon', category_id: catWinter?.id, result_type_id: rtPointsBased?.id, parent_id: null },
    { name: 'Bobfahren', category_id: catWinter?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Rodeln', category_id: catWinter?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Skeleton', category_id: catWinter?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Curling', category_id: catWinter?.id, result_type_id: rtScoreBased?.id, parent_id: null },

    // ========== TREND SPORTS ==========
    { name: 'Skateboarden', category_id: catTrend?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'BMX', category_id: catTrend?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Parcours', category_id: catTrend?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Slacklining', category_id: catTrend?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Bouldern', category_id: catTrend?.id, result_type_id: rtBinary?.id, parent_id: null },
    { name: 'Klettern', category_id: catTrend?.id, result_type_id: rtTimeBased?.id, parent_id: null },
    { name: 'Frisbee', category_id: catTrend?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Spikeball', category_id: catTrend?.id, result_type_id: rtScoreBased?.id, parent_id: null },

    // ========== MIND SPORTS ==========
    { name: 'Schach', category_id: catMind?.id, result_type_id: rtBinary?.id, parent_id: null },
    { name: 'Go', category_id: catMind?.id, result_type_id: rtBinary?.id, parent_id: null },
    { name: 'Poker', category_id: catMind?.id, result_type_id: rtPointsBased?.id, parent_id: null },
    { name: 'E-Sports', category_id: catMind?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Darts', category_id: catMind?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Billard', category_id: catMind?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Snooker', category_id: catMind?.id, result_type_id: rtScoreBased?.id, parent_id: null },

    // ========== EXTREME SPORTS ==========
    { name: 'Fallschirmspringen', category_id: catExtreme?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Bungee Jumping', category_id: catExtreme?.id, result_type_id: rtBinary?.id, parent_id: null },
    { name: 'Base Jumping', category_id: catExtreme?.id, result_type_id: rtBinary?.id, parent_id: null },
    { name: 'Paragliding', category_id: catExtreme?.id, result_type_id: rtTimeBased?.id, parent_id: null },

    // ========== OTHER ==========
    { name: 'Turnen', category_id: catOther?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Reiten', category_id: catOther?.id, result_type_id: rtJuryBased?.id, parent_id: null },
    { name: 'Golf', category_id: catOther?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Bogenschießen', category_id: catOther?.id, result_type_id: rtScoreBased?.id, parent_id: null },
    { name: 'Schießsport', category_id: catOther?.id, result_type_id: rtScoreBased?.id, parent_id: null }
  ];

  // Insert or update sports
  for (const sport of allSports) {
    const existing = await knex('sports').where({ name: sport.name, parent_id: null }).first();
    if (existing) {
      await knex('sports').where({ id: existing.id }).update({
        category_id: sport.category_id,
        result_type_id: sport.result_type_id
      });
    } else {
      await knex('sports').insert(sport);
    }
  }
  console.log('[Sports Restructure] ✓ Comprehensive sports database inserted');

  // ===== 9. INSERT DISCIPLINES (Level 3) =====
  const tennis = await knex('sports').where({ name: 'Tennis', parent_id: null }).first();
  const badminton = await knex('sports').where({ name: 'Badminton', parent_id: null }).first();
  const tischtennis = await knex('sports').where({ name: 'Tischtennis', parent_id: null }).first();
  const fussball = await knex('sports').where({ name: 'Fußball', parent_id: null }).first();
  const basketball = await knex('sports').where({ name: 'Basketball', parent_id: null }).first();
  const volleyball = await knex('sports').where({ name: 'Volleyball', parent_id: null }).first();
  const handball = await knex('sports').where({ name: 'Handball', parent_id: null }).first();
  const schwimmen = await knex('sports').where({ name: 'Schwimmen', parent_id: null }).first();
  const laufen = await knex('sports').where({ name: 'Laufen', parent_id: null }).first();

  const disciplines = [
    // Tennis disciplines
    { name: 'Tennis Einzel', parent_id: tennis?.id, category: 'Einzel', result_type_id: rtSetBased?.id },
    { name: 'Tennis Doppel', parent_id: tennis?.id, category: 'Doppel', result_type_id: rtSetBased?.id },
    { name: 'Tennis Mixed Doppel', parent_id: tennis?.id, category: 'Mixed', result_type_id: rtSetBased?.id },

    // Badminton disciplines
    { name: 'Badminton Einzel', parent_id: badminton?.id, category: 'Einzel', result_type_id: rtSetBased?.id },
    { name: 'Badminton Doppel', parent_id: badminton?.id, category: 'Doppel', result_type_id: rtSetBased?.id },
    { name: 'Badminton Mixed', parent_id: badminton?.id, category: 'Mixed', result_type_id: rtSetBased?.id },

    // Tischtennis disciplines
    { name: 'Tischtennis Einzel', parent_id: tischtennis?.id, category: 'Einzel', result_type_id: rtSetBased?.id },
    { name: 'Tischtennis Doppel', parent_id: tischtennis?.id, category: 'Doppel', result_type_id: rtSetBased?.id },

    // Fußball disciplines
    { name: 'Fußball 11 vs 11', parent_id: fussball?.id, category: 'Vollfeld', result_type_id: rtScoreBased?.id },
    { name: 'Fußball 7 vs 7', parent_id: fussball?.id, category: 'Kleinfeld', result_type_id: rtScoreBased?.id },
    { name: 'Fußball 5 vs 5', parent_id: fussball?.id, category: 'Futsal', result_type_id: rtScoreBased?.id },

    // Basketball disciplines
    { name: 'Basketball 5 vs 5', parent_id: basketball?.id, category: 'Vollfeld', result_type_id: rtScoreBased?.id },
    { name: 'Basketball 3 vs 3', parent_id: basketball?.id, category: 'Streetball', result_type_id: rtScoreBased?.id },

    // Volleyball disciplines
    { name: 'Volleyball Indoor', parent_id: volleyball?.id, category: 'Halle', result_type_id: rtSetBased?.id },
    { name: 'Volleyball Beach', parent_id: volleyball?.id, category: 'Beach', result_type_id: rtSetBased?.id },

    // Handball disciplines
    { name: 'Handball 7 vs 7', parent_id: handball?.id, category: 'Vollfeld', result_type_id: rtScoreBased?.id },
    { name: 'Handball 5 vs 5', parent_id: handball?.id, category: 'Kleinfeld', result_type_id: rtScoreBased?.id },

    // Schwimmen disciplines
    { name: 'Schwimmen Freistil', parent_id: schwimmen?.id, category: 'Freistil', result_type_id: rtTimeBased?.id },
    { name: 'Schwimmen Brust', parent_id: schwimmen?.id, category: 'Brust', result_type_id: rtTimeBased?.id },
    { name: 'Schwimmen Rücken', parent_id: schwimmen?.id, category: 'Rücken', result_type_id: rtTimeBased?.id },
    { name: 'Schwimmen Schmetterling', parent_id: schwimmen?.id, category: 'Schmetterling', result_type_id: rtTimeBased?.id },

    // Laufen disciplines
    { name: 'Sprint 100m', parent_id: laufen?.id, category: 'Sprint', result_type_id: rtTimeBased?.id },
    { name: 'Sprint 200m', parent_id: laufen?.id, category: 'Sprint', result_type_id: rtTimeBased?.id },
    { name: 'Mittelstrecke 800m', parent_id: laufen?.id, category: 'Mittelstrecke', result_type_id: rtTimeBased?.id },
    { name: 'Mittelstrecke 1500m', parent_id: laufen?.id, category: 'Mittelstrecke', result_type_id: rtTimeBased?.id },
    { name: 'Langstrecke 5000m', parent_id: laufen?.id, category: 'Langstrecke', result_type_id: rtTimeBased?.id },
    { name: 'Langstrecke 10000m', parent_id: laufen?.id, category: 'Langstrecke', result_type_id: rtTimeBased?.id }
  ];

  for (const disc of disciplines) {
    if (disc.parent_id) {
      const existing = await knex('sports').where({ name: disc.name }).first();
      if (!existing) {
        await knex('sports').insert(disc);
      }
    }
  }
  console.log('[Sports Restructure] ✓ Disciplines inserted');

  console.log('[Sports Restructure] ✅ Complete restructure finished!');
};

exports.down = async function(knex) {
  // Remove disciplines (Level 3)
  await knex('sports').whereNotNull('parent_id').del();
  
  // Remove result_type_id column
  const hasResultTypeId = await knex.schema.hasColumn('sports', 'result_type_id');
  if (hasResultTypeId) {
    await knex.schema.table('sports', (table) => {
      table.dropForeign('result_type_id');
      table.dropColumn('result_type_id');
    });
  }

  // Drop result_types table
  await knex.schema.dropTableIfExists('result_types');
  
  console.log('[Sports Restructure] Rollback complete');
};
