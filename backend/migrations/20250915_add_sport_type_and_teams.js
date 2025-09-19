/**
 * Adds sports.type ('Single' | 'Team') and creates teams, team_members.
 */
exports.up = async function (knex) {
  // sports.type
  const hasType = await knex.schema.hasColumn("sports", "type");
  if (!hasType) {
    await knex.schema.alterTable("sports", (t) => {
      t.string("type").notNullable().defaultTo("Single"); // 'Single' or 'Team'
    });
  }

  // teams
  const hasTeams = await knex.schema.hasTable("teams");
  if (!hasTeams) {
    await knex.schema.createTable("teams", (t) => {
      t.increments("id").primary();
      t.integer("league_id").notNullable().references("leagues.id").onDelete("CASCADE");
      t.string("name").notNullable();
      t.integer("captain_user_id").notNullable().references("users.id").onDelete("CASCADE");
      t.timestamps(true, true);
      t.unique(["league_id", "name"]);
    });
  }

  // team_members
  const hasTeamMembers = await knex.schema.hasTable("team_members");
  if (!hasTeamMembers) {
    await knex.schema.createTable("team_members", (t) => {
      t.increments("id").primary();
      t.integer("team_id").notNullable().references("teams.id").onDelete("CASCADE");
      t.integer("user_id").notNullable().references("users.id").onDelete("CASCADE");
      t.boolean("is_captain").notNullable().defaultTo(false);
      t.timestamps(true, true);
      t.unique(["team_id", "user_id"]);
    });
  }
};

exports.down = async function (knex) {
  const dropIfExists = async (name) => knex.schema.hasTable(name).then((ex) => ex && knex.schema.dropTable(name));
  await dropIfExists("team_members");
  await dropIfExists("teams");
  const hasType = await knex.schema.hasColumn("sports", "type");
  if (hasType) {
    await knex.schema.alterTable("sports", (t) => {
      t.dropColumn("type");
    });
  }
};
