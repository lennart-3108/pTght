/**
 * Create 'matches' table and migrate data from legacy 'games' if present.
 * Robust: Nur existierende Spalten werden übernommen.
 */
exports.up = async function (knex) {
	const hasMatches = await knex.schema.hasTable("matches");
	if (!hasMatches) {
		await knex.schema.createTable("matches", (t) => {
			t.increments("id").primary();
			t.integer("league_id").notNullable().references("leagues.id").onDelete("CASCADE");
			t.text("kickoff_at").nullable();
			t.integer("home_user_id").nullable().references("users.id").onDelete("SET NULL");
			t.integer("away_user_id").nullable().references("users.id").onDelete("SET NULL");
			t.integer("home_team_id").nullable().references("teams.id").onDelete("SET NULL");
			t.integer("away_team_id").nullable().references("teams.id").onDelete("SET NULL");
			t.text("home").nullable();
			t.text("away").nullable();
			t.integer("home_score").nullable();
			t.integer("away_score").nullable();
			t.check("home_user_id IS NULL OR home_team_id IS NULL");
			t.check("away_user_id IS NULL OR away_team_id IS NULL");
		});
	}

	const hasGames = await knex.schema.hasTable("games");
	if (hasGames) {
		const info = await knex("games").columnInfo();
		const cols = Object.keys(info);
		const hasLeagueId = cols.includes("league_id");

		// Nur Zeilen mit league_id übernehmen, und nur existierende Spalten mappen
		if (hasLeagueId) {
			const colMap = [
				["id", "id"],
				["league_id", "league_id"],
				["kickoff_at", "kickoff_at"],
				["home_user_id", "home_user_id"],
				["away_user_id", "away_user_id"],
				["home_team_id", "home_team_id"],
				["away_team_id", "away_team_id"],
				["home", "home"],
				["away", "away"],
				["home_score", "home_score"],
				["away_score", "away_score"],
			];
			const srcCols = colMap.filter(([src]) => cols.includes(src));
			const destCols = srcCols.map(([_, dest]) => dest);
			const selectCols = srcCols.map(([src]) => `g.${src}`);

			await knex.raw(
				`INSERT INTO matches (${destCols.join(", ")})
				 SELECT ${selectCols.join(", ")}
				 FROM games g
				 WHERE g.league_id IS NOT NULL`
			);
		}
	}
};

exports.down = async function (knex) {
	const has = await knex.schema.hasTable("matches");
	if (has) await knex.schema.dropTable("matches");
};

