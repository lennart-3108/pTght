exports.up = async function (knex) {
  const exists = await knex.schema.hasTable("match_messages");
  if (exists) return;

  await knex.schema.createTable("match_messages", (table) => {
    table.increments("id").primary();
    table.integer("match_id").notNullable().references("id").inTable("matches").onDelete("CASCADE");
    table.integer("sender_user_id").references("id").inTable("users").onDelete("SET NULL");
    table.integer("sender_team_id").references("id").inTable("teams").onDelete("SET NULL");
    table.text("body").notNullable();
    table.text("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
    table.index(["match_id"], "idx_match_messages_match");
  });
};

exports.down = async function (knex) {
  const exists = await knex.schema.hasTable("match_messages");
  if (!exists) return;
  await knex.schema.dropTable("match_messages");
};
