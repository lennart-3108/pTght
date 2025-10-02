exports.up = async function(knex) {
  const hasCities = await knex.schema.hasTable('cities');
  if (!hasCities) {
    await knex.schema.createTable('cities', (t) => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.integer('country_id').unsigned().references('id').inTable('countries').onDelete('SET NULL');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('cities');
};
