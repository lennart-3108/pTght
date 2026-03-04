/**
 * Migration: Publish all sports
 * - Assign category_id to variants (from parent sport)
 * - Assign category_id to athletics disciplines (Leichtathletik)
 * - Publish all sports with result_type_id set
 */

exports.up = async function(knex) {
  console.log('[Publish Sports] Starting...');

  // ===== 1. VARIANTS: category from parent sport =====
  // Badminton variants → Racketsportarten (5)
  await knex('sports')
    .whereIn('id', [132, 133, 134]) // Einzel, Doppel, Mixed
    .update({ category_id: 5 });

  // Tennis variants → Racketsportarten (5)
  await knex('sports')
    .whereIn('id', [129, 130, 131]) // Einzel, Doppel, Mixed Doppel
    .update({ category_id: 5 });

  // Tischtennis variants → Racketsportarten (5)
  await knex('sports')
    .whereIn('id', [135, 136]) // Einzel, Doppel
    .update({ category_id: 5 });

  // Basketball variants → Ballsportarten (6)
  await knex('sports')
    .whereIn('id', [140, 141]) // 5 vs 5, 3 vs 3
    .update({ category_id: 6 });

  // Fußball variants → Ballsportarten (6)
  await knex('sports')
    .whereIn('id', [137, 138, 139]) // 11 vs 11, 7 vs 7, 5 vs 5
    .update({ category_id: 6 });

  // Handball variants → Ballsportarten (6)
  await knex('sports')
    .whereIn('id', [144, 145]) // 7 vs 7, 5 vs 5
    .update({ category_id: 6 });

  // Volleyball variants → Ballsportarten (6)
  await knex('sports')
    .whereIn('id', [142, 143]) // Indoor, Beach
    .update({ category_id: 6 });

  // Schwimmen variants → Wassersportarten (7)
  await knex('sports')
    .whereIn('id', [146, 147, 148, 149]) // Freistil, Brust, Rücken, Schmetterling
    .update({ category_id: 7 });

  // Leichtathletik: Sprint, Mittelstrecke, Langstrecke → Leichtathletik (9)
  await knex('sports')
    .whereIn('id', [150, 151, 152, 153, 154, 155]) // 100m, 200m, 800m, 1500m, 5000m, 10000m
    .update({ category_id: 9 });

  console.log('[Publish Sports] ✓ Categories assigned to variants');

  // ===== 2. FIX: Radsport (10) — move BMX to Trendsport, add Radfahren if missing =====
  // BMX is already Trendsport (15) — just verify
  // Radsport: Radfahren (84) is Ausdauersport (12) — move to Radsport (10) for better fit
  await knex('sports')
    .whereIn('id', [84]) // Radfahren
    .update({ category_id: 10 });

  await knex('sports')
    .whereIn('id', [106]) // BMX
    .update({ category_id: 10 });

  console.log('[Publish Sports] ✓ Radsport category fixed');

  // ===== 3. PUBLISH all sports with result_type_id =====
  const updated = await knex('sports')
    .whereNotNull('result_type_id')
    .update({ published: 1 });

  console.log(`[Publish Sports] ✓ Published ${updated} sports`);
};

exports.down = async function(knex) {
  // Unpublish all except the original 7
  await knex('sports')
    .whereNotIn('id', [1, 2, 5, 6, 7, 8, 9])
    .update({ published: 0 });
};
