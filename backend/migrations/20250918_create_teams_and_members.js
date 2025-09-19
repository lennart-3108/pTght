/**
 * Safety migration: ensure teams and team_members tables exist (no-op if already created).
 */
exports.up = async function (knex) {
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
	// Drop only if they exist; tables may be used by other migrations.
	const hasTeamMembers = await knex.schema.hasTable("team_members");
	if (hasTeamMembers) await knex.schema.dropTable("team_members");
	const hasTeams = await knex.schema.hasTable("teams");
	if (hasTeams) await knex.schema.dropTable("teams");
};

