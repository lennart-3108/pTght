exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('sports', 'active');
  if (!hasColumn) {
    await knex.schema.alterTable('sports', (table) => {
      table.boolean('active').notNullable().defaultTo(true);
    });
  }

  await knex('sports').update({ active: 1 });
};

exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn('sports', 'active');
  if (hasColumn) {
    await knex.schema.alterTable('sports', (table) => {
      table.dropColumn('active');
    });
  }
};
