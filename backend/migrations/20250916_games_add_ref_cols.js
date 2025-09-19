/**
 * Migration: Füge Referenzspalten zu games hinzu, robust gegen fehlende league_id
 */

exports.up = async function (knex) {
  const hasGames = await knex.schema.hasTable("games");
  if (!hasGames) return;

  // Rename old table
  await knex.schema.renameTable("games", "games_old");

  // Hole Spalten aus games_old
  const info = await knex("games_old").columnInfo();
  const cols = Object.keys(info);

  const hasLeagueId = cols.includes("league_id");
  const hasKickoffAt = cols.includes("kickoff_at");
  const hasHome = cols.includes("home");
  const hasAway = cols.includes("away");
  const hasHomeScore = cols.includes("home_score");
  const hasAwayScore = cols.includes("away_score");

  // Lege neue Tabelle an (nur mit existierenden Spalten + neuen Referenzspalten)
  await knex.schema.createTable("games", (t) => {
    t.increments("id").primary();
    if (hasLeagueId) t.integer("league_id");
    if (hasKickoffAt) t.text("kickoff_at");
    // Neue Referenzspalten
    t.integer("home_user_id").nullable();
    t.integer("away_user_id").nullable();
    t.integer("home_team_id").nullable();
    t.integer("away_team_id").nullable();
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
    "home_user_id",
    "away_user_id",
    "home_team_id",
    "away_team_id",
    ...(hasHome ? ["home"] : []),
    ...(hasAway ? ["away"] : []),
    ...(hasHomeScore ? ["home_score"] : []),
    ...(hasAwayScore ? ["away_score"] : []),
  ];

  const selectCols = [
    "id",
    ...(hasLeagueId ? ["league_id"] : []),
    ...(hasKickoffAt ? ["kickoff_at"] : []),
    // User-IDs aus home/away (nur wenn home/away existieren)
    ...(hasHome
      ? [
          `(SELECT u.id FROM users u WHERE CAST(u.id AS TEXT) = games_old.home OR u.username = games_old.home OR u.name = games_old.home LIMIT 1) AS home_user_id`,
        ]
      : ["NULL AS home_user_id"]),
    ...(hasAway
      ? [
          `(SELECT u.id FROM users u WHERE CAST(u.id AS TEXT) = games_old.away OR u.username = games_old.away OR u.name = games_old.away LIMIT 1) AS away_user_id`,
        ]
      : ["NULL AS away_user_id"]),
    "NULL AS home_team_id",
    "NULL AS away_team_id",
    ...(hasHome ? ["home"] : []),
    ...(hasAway ? ["away"] : []),
    ...(hasHomeScore ? ["home_score"] : []),
    ...(hasAwayScore ? ["away_score"] : []),
  ];

  await knex.raw(
    `INSERT INTO games (${insertCols.join(", ")})
     SELECT ${selectCols.join(", ")} FROM games_old`
  );

  await knex.schema.dropTable("games_old");
};

exports.down = async function (knex) {
  // Kein automatisches Down-Migration für diese Struktur
};
