const express = require("express");
const { isAuthenticated } = require("../../middleware/auth");

function resolveKnex(db) {
  // Accept: direct knex instance, adapter with .knex, or require fallback
  try {
    if (!db) {
      // fallthrough to require-based fallback
    } else {
      if (typeof db === "function" && db.client) return db; // direct knex callable
      if (db && db.client && typeof db.raw === "function") return db; // knex instance-like
      if (db && db.knex && db.knex.client) return db.knex; // adapter exposing knex
    }
  } catch (e) {
    // ignore and try fallbacks
  }
  // fallback require attempts
  try { return require("../../db"); } catch (e) { /* no-op */ }
  try { return require("../../../db"); } catch (e) { /* no-op */ }
  return null;
}

async function detectGameTable(k) {
  if (await k.schema.hasTable("matches")) return "matches";
  if (await k.schema.hasTable("games")) return "games";
  return null;
}

async function gameCols(k, table) {
  const info = await k(table).columnInfo();
  return {
    home: info.home_user_id ? "home_user_id" : (info.home ? "home" : null),
    away: info.away_user_id ? "away_user_id" : (info.away ? "away" : null),
  };
}

// Use only columns that exist in our current users schema
const DISPLAY_NAME_SQL = "COALESCE(u.name, u.email)";

module.exports = function leagueMatchesRoutes({ db }) {
  const router = express.Router();
  let table; // cached detected table name

  // --- NEW: GET / - return leagues list (robust: leftJoin + optional l.city/l.sport) ---
  router.get("/", async (_req, res) => {
    const k = resolveKnex(db);
    if (!k) {
      console.error("GET /leagues: no knex available");
      return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
    }
    try {
      const leagueInfo = await k("leagues").columnInfo().catch(() => ({}));
      const hasLeagueCityCol = Object.prototype.hasOwnProperty.call(leagueInfo, "city");
      const hasLeagueSportCol = Object.prototype.hasOwnProperty.call(leagueInfo, "sport");

      const rows = await k("leagues as l")
        .leftJoin("cities as c", "l.city_id", "c.id")
        .leftJoin("sports as s", "l.sport_id", "s.id")
        .select(
          "l.id",
          { cityId: "c.id" },
          (hasLeagueCityCol ? k.raw("COALESCE(c.name, l.city) as city") : k.raw("COALESCE(c.name, '') as city")),
          { sportId: "s.id" },
          (hasLeagueSportCol ? k.raw("COALESCE(s.name, l.sport) as sport") : k.raw("COALESCE(s.name, '') as sport")),
          "l.name"
        )
        .orderBy(["c.name", "l.name"]);

      return res.json(rows || []);
    } catch (e) {
      console.error("GET /leagues failed:", e && (e.stack || e.message || e));
      return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
    }
  });

  // --- NEW: GET /:id - league detail (robust) ---
  router.get("/:id", async (req, res) => {
    const k = resolveKnex(db);
    if (!k) {
      console.error("GET /leagues/:id: no knex available");
      return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
    }
    try {
      const leagueInfo = await k("leagues").columnInfo().catch(() => ({}));
      const hasLeagueCityCol = Object.prototype.hasOwnProperty.call(leagueInfo, "city");
      const hasLeagueSportCol = Object.prototype.hasOwnProperty.call(leagueInfo, "sport");

      const id = Number(req.params.id);
      if (!id || isNaN(id)) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });

      const q = k("leagues as l")
        .leftJoin("cities as c", "l.city_id", "c.id")
        .leftJoin("sports as s", "l.sport_id", "s.id")
        .select(
          "l.id",
          "l.name",
          { cityId: "c.id" },
          (hasLeagueCityCol ? k.raw("COALESCE(c.name, l.city) as city") : k.raw("COALESCE(c.name, '') as city")),
          { sportId: "s.id" },
          (hasLeagueSportCol ? k.raw("COALESCE(s.name, l.sport) as sport") : k.raw("COALESCE(s.name, '') as sport")),
        )
        .where("l.id", id)
        .first();

      const row = await q;
      if (!row) return res.status(404).json({ error: "Liga nicht gefunden" });
      return res.json(row);
    } catch (e) {
      console.error("GET /leagues/:id failed:", e && (e.stack || e.message || e));
      return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
    }
  });

  // Gegnerliste derselben Liga (alle außer mir)
  router.get("/:leagueId/opponents", isAuthenticated, async (req, res) => {
    const k = resolveKnex(db);
    if (!k) {
      console.error("GET /opponents: no knex available");
      return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
    }
    try {
      const { leagueId } = req.params;
      const me = req.user.id;

      const members = await k("user_leagues as ul")
        .join("users as u", "u.id", "ul.user_id")
        .where("ul.league_id", leagueId)
        .andWhereNot("u.id", me)
        .select("u.id", k.raw(`${DISPLAY_NAME_SQL} as name`), "u.email")
        .orderBy("name");

      return res.json(members || []);
    } catch (e) {
      console.error("GET /:leagueId/opponents failed:", e && (e.stack || e.message || e));
      return res.status(500).json({ error: "Datenbankfehler" });
    }
  });

  // Match anlegen (User vs User)
  router.post("/:leagueId/matches", isAuthenticated, async (req, res) => {
    const k = resolveKnex(db);
    if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

    try {
      // Immer matches verwenden
      const hasMatches = await k.schema.hasTable("matches");
      if (!hasMatches) return res.status(500).json({ error: "NO_MATCHES_TABLE" });

      const info = await k("matches").columnInfo().catch(() => ({}));
      const hasHomeUserId = !!info.home_user_id;
      const hasKickoffAt = !!info.kickoff_at;
      const { leagueId } = req.params;
      const { opponent_user_id, kickoff_at } = req.body || {};
      const me = req.user.id;
      if (!opponent_user_id || !kickoff_at) {
        return res.status(400).json({ error: "opponent_user_id and kickoff_at required" });
      }
      // beide müssen Mitglied der Liga sein
      const cntRow = await k("user_leagues")
        .whereIn("user_id", [me, opponent_user_id])
        .andWhere("league_id", leagueId)
        .count({ c: "*" });
      const cnt = Array.isArray(cntRow) ? (cntRow[0].c || 0) : (cntRow.c || 0);
      if (Number(cnt) < 2) return res.status(403).json({ error: "Not both members of league" });

      // Prüfe, ob bereits ein offenes Match zwischen diesen beiden existiert
      let existing = null;
      if (hasHomeUserId) {
        existing = await k("matches")
          .where({ league_id: Number(leagueId) })
          .where(function () {
            this.where(function () {
              this.where("home_user_id", me).andWhere("away_user_id", opponent_user_id);
            }).orWhere(function () {
              this.where("home_user_id", opponent_user_id).andWhere("away_user_id", me);
            });
          })
          .whereNull("home_score")
          .whereNull("away_score")
          .first();
      }
      if (existing) return res.status(409).json({ error: "Es existiert bereits ein offenes Match zwischen diesen Spielern." });

      const rec = { league_id: Number(leagueId) };
      if (hasKickoffAt) rec.kickoff_at = new Date(kickoff_at).toISOString();
      if (hasHomeUserId) {
        rec.home_user_id = me;
        rec.away_user_id = Number(opponent_user_id);
      } else {
        rec.home = String(me);
        rec.away = String(opponent_user_id);
      }

      // Debug: Logge das Insert-Objekt und Spalten
      console.log("[MATCH-INSERT]", { rec, info });

      const inserted = await k("matches").insert(rec);
      const id = Array.isArray(inserted) ? inserted[0] : inserted;
      return res.status(201).json({ id });
    } catch (e) {
      console.error("POST /:leagueId/matches failed:", e && (e.stack || e.message || e), { body: req.body });
      return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
    }
  });

  // Expose other league/match related routes similarly (games/members/standings)
  // GET /:id/games
  router.get("/:id/games", async (req, res) => {
    const k = resolveKnex(db);
    if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
    try {
      const leagueId = Number(req.params.id);
      if (!leagueId || isNaN(leagueId)) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });

      // Dynamisch: Tabelle und Spalten erkennen
      const tableName = await detectGameTable(k);
      if (!tableName) return res.json({ upcoming: [], completed: [] });
      const info = await k(tableName).columnInfo().catch(() => ({}));
      // league_id-Spalte erkennen
      const leagueCol = info.league_id ? "league_id" : (info.leagueId ? "leagueId" : null);
      if (!leagueCol) return res.json({ upcoming: [], completed: [] });
      // Zeitspalte erkennen
      const tsCandidates = ["kickoff_at", "kickoff", "scheduled_at", "date", "datetime", "start_time"];
      const tsCol = tsCandidates.find(c => Object.prototype.hasOwnProperty.call(info, c)) || null;
      // home/away-Spalten erkennen
      const homeCol = info.home_user_id ? "home_user_id" : (info.home ? "home" : null);
      const awayCol = info.away_user_id ? "away_user_id" : (info.away ? "away" : null);

      // Display-Namen dynamisch bauen
      const usersInfo = await k("users").columnInfo().catch(() => ({}));
      const hasFirst = Object.prototype.hasOwnProperty.call(usersInfo, "firstname");
      const hasLast = Object.prototype.hasOwnProperty.call(usersInfo, "lastname");
      const hasName = Object.prototype.hasOwnProperty.call(usersInfo, "name");
      const hasEmail = Object.prototype.hasOwnProperty.call(usersInfo, "email");
      const fullNameExpr = (hasFirst || hasLast)
        ? "NULLIF(TRIM(COALESCE(u.firstname,'') || ' ' || COALESCE(u.lastname,'')), '')"
        : null;
      const nameCoalesce = [
        ...(fullNameExpr ? [fullNameExpr] : []),
        ...(hasName ? ["u.name"] : []),
        ...(hasEmail ? ["u.email"] : []),
      ];
      const displayName = `COALESCE(${nameCoalesce.length ? nameCoalesce.join(", ") : "'User'"})`;

      const selectHome = homeCol === "home_user_id"
        ? k.raw(`(SELECT ${displayName} FROM users u WHERE u.id = g.home_user_id) as home`)
        : (homeCol ? k.raw(`g.${homeCol} as home`) : k.raw("NULL as home"));
      const selectAway = awayCol === "away_user_id"
        ? k.raw(`(SELECT ${displayName} FROM users u WHERE u.id = g.away_user_id) as away`)
        : (awayCol ? k.raw(`g.${awayCol} as away`) : k.raw("NULL as away"));

      // Zeitspalte für Sortierung und Anzeige
      const tsSelect = tsCol ? k.raw(`g.${tsCol} as kickoff_at`) : k.raw("NULL as kickoff_at");

      // leagueId für Frontend immer liefern
      const leagueIdSelect = leagueCol ? { leagueId: `g.${leagueCol}` } : k.raw("NULL as leagueId");

      const rows = await k(`${tableName} as g`)
        .select(
          "g.id",
          tsSelect,
          leagueIdSelect,
          selectHome,
          selectAway,
          "g.home_score",
          "g.away_score"
        )
        .where(`g.${leagueCol}`, leagueId)
        .orderBy(tsCol ? `g.${tsCol}` : "g.id", "asc");

      const now = Date.now();
      const all = (rows || []).map(r => ({ ...r, ts: r.kickoff_at ? (Date.parse(r.kickoff_at) || 0) : 0 }));
      const upcoming = all.filter(r => r.ts > now || (r.home_score == null && r.away_score == null));
      const completed = all.filter(r => r.ts <= now || (r.home_score != null || r.away_score != null));

      return res.json({ upcoming, completed });
    } catch (e) {
      console.error("GET /:id/games failed:", e && (e.stack || e.message || e));
      return res.status(500).json({ error: "Datenbankfehler" });
    }
  });

  // GET /:id/members
  router.get("/:id/members", async (req, res) => {
    const k = resolveKnex(db);
    if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
    try {
      const leagueId = Number(req.params.id);
      const rows = await k("user_leagues as ul")
        .join("users as u", "u.id", "ul.user_id")
        .where("ul.league_id", leagueId)
        .select("u.id", "u.firstname", "u.lastname", "ul.joined_at")
        .orderBy(["u.lastname", "u.firstname"]);

      return res.json(rows || []);
    } catch (e) {
      console.error("GET /:id/members failed:", e && (e.stack || e.message || e));
      return res.status(500).json({ error: "Datenbankfehler" });
    }
  });

  // GET /:id/standings
  router.get("/:id/standings", async (req, res) => {
    const k = resolveKnex(db);
    if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
    try {
      const leagueId = Number(req.params.id);
      if (!leagueId || isNaN(leagueId)) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });

      // dynamic column detection: prefer matches/games depending on schema
      const tableName = (await detectGameTable(k)) || "games";
      const info = await k(tableName).columnInfo().catch(() => ({}));
      let homeCol = "home";
      let awayCol = "away";
      if (info.home_user_id) homeCol = "home_user_id";
      if (info.away_user_id) awayCol = "away_user_id";

      const games = await k(tableName)
        .select(`${homeCol} as home`, `${awayCol} as away`, "home_score", "away_score")
        .where({ league_id: leagueId })
        .whereNotNull("home_score")
        .whereNotNull("away_score");

      return res.json(games || []);
    } catch (e) {
      console.error("GET /:id/standings failed:", e && (e.stack || e.message || e));
      return res.status(500).json({ error: "Datenbankfehler" });
    }
  });

  return router;
};