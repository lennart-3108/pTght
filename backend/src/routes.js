const { registerRoutes } = require("./routes/index");

// Hilfsfunktionen für robuste DB-Queries
function getTables(db, cb) {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) return cb(err);
    cb(null, (rows || []).map(r => r.name));
  });
}

function tableExists(tables, name) {
  return Array.isArray(tables) && tables.includes(name);
}

function safeAll(db, sql, params, res, empty = []) {
  db.all(sql, params, (err, rows) => {
    if (err) {
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("no such table") || msg.includes("no such column")) return res.json(empty);
      console.error("DB error:", err);
      return res.status(500).json({ error: "Datenbankfehler" });
    }
    res.json(rows || empty);
  });
}

function pickColumn(columns, candidates) {
  const names = new Set((columns || []).map(c => c.name));
  return candidates.find(c => names.has(c)) || null;
}

function loadTableColumns(db, table, cb) {
  db.all(`PRAGMA table_info(${table})`, [], (e, cols) => cb(e, cols || []));
}

function registerUserDetailRoutes(app, ctx) {
  const { db } = ctx;

  // GET /users/:id/leagues
  app.get("/users/:id/leagues", (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) return res.status(400).json({ error: "Ungültige User-ID" });

    getTables(db, (err, tables) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });

      const leaguesTable = ["leagues"].find(t => tableExists(tables, t));
      const linkTable = [ "user_leagues", "league_users", "leagues_users", "user_league"]
        .find(t => tableExists(tables, t));

      if (!leaguesTable || !linkTable) return res.json([]);

      loadTableColumns(db, linkTable, (eCols, cols) => {
        if (eCols) return res.json([]);

        // Suche user_id und league_id (oder nahe Alternativen)
        const userCol = pickColumn(cols, ["user_id", "member_id", "player_id", "users_id"]);
        const leagueCol = pickColumn(cols, ["league_id", "leagues_id"]);

        if (!userCol || !leagueCol) return res.json([]);

        const hasSports = tableExists(tables, "sports");
        const hasCities = tableExists(tables, "cities");

        const selectCols = [
          "l.id",
          "l.name",
          hasSports ? "s.name AS sport" : "NULL AS sport",
          hasCities ? "c.name AS city" : "NULL AS city"
        ].join(", ");

        const joins = [
          `INNER JOIN ${linkTable} lm ON lm.${leagueCol} = l.id`,
          hasSports ? "LEFT JOIN sports s ON s.id = l.sport_id" : "",
          hasCities ? "LEFT JOIN cities c ON c.id = l.city_id" : ""
        ].filter(Boolean).join(" ");

        const sql = `SELECT ${selectCols} FROM ${leaguesTable} l ${joins} WHERE lm.${userCol} = ? ORDER BY l.id`;
        safeAll(db, sql, [userId], res, []);
      });
    });
  });

  // GET /users/:id/games
  app.get("/users/:id/games", (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) return res.status(400).json({ error: "Ungültige User-ID" });

    getTables(db, (err, tables) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });

      const gamesTable = ["games", "matches", "fixtures"].find(t => tableExists(tables, t));
      const linkTable = ["game_players", "user_games", "games_users", "match_players", "user_match"]
        .find(t => tableExists(tables, t));

      if (!gamesTable || !linkTable) return res.json([]);

      loadTableColumns(db, linkTable, (eLinkCols, linkCols) => {
        if (eLinkCols) return res.json([]);

        const userCol = pickColumn(linkCols, ["user_id", "player_id", "users_id"]);
        // Finde die passende FK-Spalte auf die Spiele-Tabelle
        const gameFkCandidates = [
          "game_id", "match_id", "fixture_id",
          `${gamesTable.slice(0, -1)}_id` // heuristisch
        ];
        const gameCol = pickColumn(linkCols, gameFkCandidates);

        if (!userCol || !gameCol) return res.json([]);

        // Bestimme Sortierspalte (Datum, falls vorhanden)
        loadTableColumns(db, gamesTable, (eGameCols, gameCols) => {
          if (eGameCols) return res.json([]);

          const dateCol = pickColumn(gameCols, ["date", "played_at", "kickoff_at", "start_time"]);
          const orderClause = dateCol ? `ORDER BY g.${dateCol} DESC, g.id DESC` : "ORDER BY g.id DESC";

          const sql = `SELECT g.* FROM ${gamesTable} g
                       INNER JOIN ${linkTable} gp ON gp.${gameCol} = g.id
                       WHERE gp.${userCol} = ?
                       ${orderClause}`;
          safeAll(db, sql, [userId], res, []);
        });
      });
    });
  });
}

function registerAllRoutes(app, ctx) {
  registerUserDetailRoutes(app, ctx);
}

module.exports = { registerAllRoutes };
