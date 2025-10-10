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
	} else {
		// Ensure columns exist if table was created by an older migration without them
		const mInfo = await knex("matches").columnInfo().catch(() => ({}));
		const need = (c) => !Object.prototype.hasOwnProperty.call(mInfo || {}, c);
		// SQLite supports ADD COLUMN; do individual alters when needed
		if (need("kickoff_at")) await knex.schema.alterTable("matches", (t) => t.text("kickoff_at").nullable());
		if (need("home_user_id")) await knex.schema.alterTable("matches", (t) => t.integer("home_user_id").nullable());
		if (need("away_user_id")) await knex.schema.alterTable("matches", (t) => t.integer("away_user_id").nullable());
		if (need("home_team_id")) await knex.schema.alterTable("matches", (t) => t.integer("home_team_id").nullable());
		if (need("away_team_id")) await knex.schema.alterTable("matches", (t) => t.integer("away_team_id").nullable());
		if (need("home")) await knex.schema.alterTable("matches", (t) => t.text("home").nullable());
		if (need("away")) await knex.schema.alterTable("matches", (t) => t.text("away").nullable());
		if (need("home_score")) await knex.schema.alterTable("matches", (t) => t.integer("home_score").nullable());
		if (need("away_score")) await knex.schema.alterTable("matches", (t) => t.integer("away_score").nullable());
	}

	const hasGames = await knex.schema.hasTable("games");
	if (hasGames) {
		const info = await knex("games").columnInfo();
		const cols = Object.keys(info);
		const hasLeagueId = cols.includes("league_id");

		// Nur Zeilen mit league_id übernehmen, und nur existierende Spalten mappen
		if (hasLeagueId) {
			// Filter destination columns by what exists in matches to prevent errors
			const matchesInfo = await knex("matches").columnInfo().catch(() => ({}));
			const matchesCols = Object.keys(matchesInfo || {});
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
			const srcCols = colMap.filter(([src, dest]) => cols.includes(src) && matchesCols.includes(dest));
			if (srcCols.length) {
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
	}
};

exports.down = async function (knex) {
	const has = await knex.schema.hasTable("matches");
	if (has) await knex.schema.dropTable("matches");
};

