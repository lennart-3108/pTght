exports.up = async function(knex) {
  const exists = await knex.schema.hasTable("sports");
  if (!exists) {
    await knex.schema.createTable("sports", (t) => {
      t.increments("id").primary();
      t.string("name").notNullable().unique();
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("sports");
};
