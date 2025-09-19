/**
 * Make games.kickoff_at and games.away nullable to support open games.
 */
// Diese Migration ist robust gegen fehlende Spalten in games_old

exports.up = async function (knex) {
  const hasGames = await knex.schema.hasTable("games");
  if (!hasGames) return;

  // Rename old table
  await knex.schema.renameTable("games", "games_old");

  // Hole Spalten aus games_old
  const info = await knex("games_old").columnInfo();
  const cols = Object.keys(info);

  // Prüfe, ob league_id existiert
  const hasLeagueId = cols.includes("league_id");
  const hasKickoffAt = cols.includes("kickoff_at");
  const hasHome = cols.includes("home");
  const hasAway = cols.includes("away");
  const hasHomeScore = cols.includes("home_score");
  const hasAwayScore = cols.includes("away_score");

  // Lege neue Tabelle an (nur mit existierenden Spalten)
  await knex.schema.createTable("games", (t) => {
    t.increments("id").primary();
    if (hasLeagueId) t.integer("league_id");
    if (hasKickoffAt) t.text("kickoff_at");
    if (hasHome) t.text("home");
    if (hasAway) t.text("away");
    if (hasHomeScore) t.integer("home_score");
    if (hasAwayScore) t.integer("away_score");
  });

  // Baue dynamisches Insert-Statement
  const insertCols = [
    "id",
    ...(hasLeagueId ? ["league_id"] : []),
    ...(hasKickoffAt ? ["kickoff_at"] : []),
    ...(hasHome ? ["home"] : []),
    ...(hasAway ? ["away"] : []),
    ...(hasHomeScore ? ["home_score"] : []),
    ...(hasAwayScore ? ["away_score"] : []),
  ];
  const selectCols = insertCols.map((c) =>
    c === "away" ? "NULLIF(away, '')" : c
  );

  await knex.raw(
    `INSERT INTO games (${insertCols.join(", ")})
     SELECT ${selectCols.join(", ")} FROM games_old`
  );

  await knex.schema.dropTable("games_old");
};

exports.down = async function (knex) {
  // Kein automatisches Down-Migration für diese Struktur
};
