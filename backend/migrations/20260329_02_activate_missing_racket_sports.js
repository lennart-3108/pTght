exports.up = async function up(knex) {
  const hasSports = await knex.schema.hasTable('sports');
  if (!hasSports) return;

  const updates = { active: 1, published: 1 };

  await knex('sports')
    .whereIn('name', ['Tennis Einzel', 'Tischtennis', 'Tischtennis Einzel'])
    .update(updates);
};

exports.down = async function down(knex) {
  const hasSports = await knex.schema.hasTable('sports');
  if (!hasSports) return;

  await knex('sports')
    .whereIn('name', ['Tennis Einzel', 'Tischtennis', 'Tischtennis Einzel'])
    .update({ active: 0 });
};