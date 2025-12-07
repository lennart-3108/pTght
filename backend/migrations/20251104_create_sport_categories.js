exports.up = async function(knex) {
  // Ensure sport_categories exists
  await knex.schema.createTableIfNotExists('sport_categories', function(table) {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.string('slug', 50).notNullable().unique();
    table.text('description');
    table.string('icon', 10);
    table.integer('sort_order').defaultTo(0);
    table.timestamps(true, true);
  });

  // Ensure minimal sports table exists
  const hasSports = await knex.schema.hasTable('sports');
  if (!hasSports) {
    await knex.schema.createTable('sports', function(table) {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.integer('category_id').unsigned();
      table.string('type', 50).defaultTo('Single');
      table.integer('sort_order').defaultTo(0);
      table.timestamps(true, true);
      table.foreign('category_id').references('sport_categories.id').onDelete('SET NULL');
      table.index('category_id');
    });
  }
};

// Cleaned migration – see exports.up above. Provide conservative down.
exports.down = async function(knex) {
  try { await knex.schema.dropTableIfExists('sports'); } catch {}
  try { await knex.schema.dropTableIfExists('sport_categories'); } catch {}
};
