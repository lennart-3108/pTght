exports.up = async function up(knex) {
  const hasSports = await knex.schema.hasTable('sports');
  if (!hasSports) return;

  const activeNames = [
    'Tennis',
    'Tennis Einzel',
    'Tennis Doppel',
    'Tischtennis',
    'Tischtennis Einzel',
    'Tischtennis Doppel',
    'Fußball',
    'Fußball 5 vs 5',
    'Fußball 7 vs 7',
    'Fußball 11 vs 11',
    'Padel',
    'Pickleball'
  ];

  await knex('sports').update({ active: 0 });
  await knex('sports').whereIn('name', activeNames).update({ active: 1, published: 1 });
};

exports.down = async function down(knex) {
  const hasSports = await knex.schema.hasTable('sports');
  if (!hasSports) return;

  await knex('sports').update({ active: 1 });
};