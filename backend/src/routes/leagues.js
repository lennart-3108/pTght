const express = require("express");
const { createMiddleware } = require("./middleware");

module.exports = function leaguesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;
  const { requireAuth, ensureTables } = createMiddleware(ctx);

  // --- helpers: resolveKnex, detectGameTable, gameCols, DISPLAY_NAME_SQL ---
  function resolveKnex(d) {
    try {
      if (!d) {
      } else {
        if (typeof d === "function" && d.client) return d;
        if (d.client && typeof d.raw === "function") return d;
        if (d.knex && d.knex.client) return d.knex;
      }
    } catch (e) {}
    const tryRequire = (p) => { try { return require(p); } catch { return null; } };
    return tryRequire("../../db") || tryRequire("../../../db") || tryRequire("../../../../db") || null;
  }

  async function detectGameTable(k) {
    try {
      if (await k.schema.hasTable("matches")) return "matches";
      if (await k.schema.hasTable("games")) return "games";
    } catch (e) { /* ignore */ }
    return null;
  }

  async function gameCols(k, table) {
    try {
      const info = await k(table).columnInfo().catch(() => ({}));
      return {
        home: info.home_user_id ? "home_user_id" : (info.home ? "home" : null),
        away: info.away_user_id ? "away_user_id" : (info.away ? "away" : null),
      };
    } catch (e) {
      return { home: null, away: null };
    }
  }

  const DISPLAY_NAME_SQL = "COALESCE(u.firstname || ' ' || u.lastname, u.name, u.email)";

  // GET / - Ligenliste (dynamisch publicState)
  router.get("/", async (_req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) {
        console.error("leagues GET: no knex available (resolveKnex returned null)");
        return res.status(500).json({ error: "DB_NOT_AVAILABLE", details: "Knex instance not found" });
      }

      const leagueInfo = await k("leagues").columnInfo().catch(() => ({}));
      const hasPublicState = Object.prototype.hasOwnProperty.call(leagueInfo, "publicState");
      const hasLeagueCityCol = Object.prototype.hasOwnProperty.call(leagueInfo, "city");
      const hasLeagueSportCol = Object.prototype.hasOwnProperty.call(leagueInfo, "sport");

      // use LEFT JOIN so leagues are returned even if city/sport rows are missing
      const rows = await k("leagues as l")
        .leftJoin("cities as c", "l.city_id", "c.id")
        .leftJoin("sports as s", "l.sport_id", "s.id")
        .select(
          "l.id",
          { cityId: "c.id" },
          // only reference l.city if that column actually exists, otherwise fallback to c.name or empty string
          (hasLeagueCityCol ? k.raw("COALESCE(c.name, l.city) as city") : k.raw("COALESCE(c.name, '') as city")),
          { sportId: "s.id" },
          (hasLeagueSportCol ? k.raw("COALESCE(s.name, l.sport) as sport") : k.raw("COALESCE(s.name, '') as sport")),
          "l.name",
          ...(hasPublicState ? ["l.publicState"] : [])
        )
        .orderBy(["c.name", "l.name"]);

      res.json(rows || []);
    } catch (err) {
      console.error("Fehler beim Abrufen der Ligen:", err && (err.stack || err.message || err));
      return res.status(500).json({ error: "Datenbankfehler", details: (err && err.message) || String(err) });
    }
  });

  // GET /:id - Liga-Details (dynamisch publicState)
  router.get("/:id", async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) {
        console.error("leagues/:id GET: no knex available (resolveKnex returned null)");
        return res.status(500).json({ error: "DB_NOT_AVAILABLE", details: "Knex instance not found" });
      }

      const leagueInfo = await k("leagues").columnInfo().catch(() => ({}));
      const hasPublicState = Object.prototype.hasOwnProperty.call(leagueInfo, "publicState");
      const hasLeagueCityCol2 = Object.prototype.hasOwnProperty.call(leagueInfo, "city");
      const hasLeagueSportCol2 = Object.prototype.hasOwnProperty.call(leagueInfo, "sport");

      const id = Number(req.params.id);
      // leftJoin to avoid missing rows if city/sport are absent
      const q = k("leagues as l")
        .leftJoin("cities as c", "l.city_id", "c.id")
        .leftJoin("sports as s", "l.sport_id", "s.id")
        .select(
          "l.id",
          "l.name",
          { cityId: "c.id" },
          // only reference l.city if that column actually exists, otherwise fallback to c.name or empty string
          (hasLeagueCityCol2 ? k.raw("COALESCE(c.name, l.city) as city") : k.raw("COALESCE(c.name, '') as city")),
          { sportId: "s.id" },
          (hasLeagueSportCol2 ? k.raw("COALESCE(s.name, l.sport) as sport") : k.raw("COALESCE(s.name, '') as sport")),
          ...(hasPublicState ? ["l.publicState"] : [])
        )
        .where("l.id", id)
        .first();

      const row = await q;
      if (!row) return res.status(404).json({ error: "Liga nicht gefunden" });
      res.json(row);
    } catch (err) {
      console.error("Fehler beim Abrufen der Liga:", err && (err.stack || err.message || err));
      return res.status(500).json({ error: "Datenbankfehler", details: (err && err.message) || String(err) });
    }
  });

  // GET /:id/standings - Tabellenstände (nur matches, dynamische Spalten)
  router.get("/:id/standings", async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) {
        console.error("leagues/:id/standings: no knex available (resolveKnex returned null)");
        return res.status(500).json({ error: "DB_NOT_AVAILABLE", details: "Knex instance not found" });
      }

      const leagueId = Number(req.params.id);
      if (!leagueId || isNaN(leagueId)) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });

      // Prüfe, ob matches existiert, sonst leere Liste zurückgeben
      const hasMatches = await k.schema.hasTable("matches");
      if (!hasMatches) return res.json([]);

      // Nutze immer matches
      const info = await k("matches").columnInfo().catch(() => ({}));
      const hasHomeUserId = !!info.home_user_id;
      const hasAwayUserId = !!info.away_user_id;
      const hasHome = !!info.home;
      const hasAway = !!info.away;
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
      const selectHome = hasHomeUserId
        ? k.raw(`(SELECT ${displayName} FROM users u WHERE u.id = g.home_user_id) as home`)
        : (hasHome ? k.raw("g.home as home") : k.raw("NULL as home"));
      const selectAway = hasAwayUserId
        ? k.raw(`(SELECT ${displayName} FROM users u WHERE u.id = g.away_user_id) as away`)
        : (hasAway ? k.raw("g.away as away") : k.raw("NULL as away"));
      const games = await k("matches as g")
        .select(selectHome, selectAway, "g.home_score", "g.away_score")
        .where({ league_id: leagueId })
        .whereNotNull("g.home_score")
        .whereNotNull("g.away_score");
      res.json(Array.isArray(games) ? games : []);
    } catch (err) {
      console.error("Fehler beim Abrufen der Tabellenstände:", err && (err.stack || err.message || err));
      return res.status(500).json({ error: "Datenbankfehler", details: (err && err.message) || String(err) });
    }
  });

  // GET /:id/games - Spiele einer Liga (nur matches, dynamische Spalten)
  router.get("/:id/games", async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) {
        console.error("leagues/:id/games: no knex available (resolveKnex returned null)");
        return res.status(500).json({ error: "DB_NOT_AVAILABLE", details: "Knex instance not found" });
      }

      const leagueId = Number(req.params.id);
      if (!leagueId || isNaN(leagueId)) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });

      // Prüfe, ob matches existiert, sonst leere Listen zurückgeben
      const hasMatches = await k.schema.hasTable("matches");
      if (!hasMatches) return res.json({ upcoming: [], completed: [] });

      // Nutze immer matches
      const info = await k("matches").columnInfo().catch(() => ({}));
      const hasHomeUserId = !!info.home_user_id;
      const hasAwayUserId = !!info.away_user_id;
      const hasHome = !!info.home;
      const hasAway = !!info.away;
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
      const selectHome = hasHomeUserId
        ? k.raw(`(SELECT ${displayName} FROM users u WHERE u.id = g.home_user_id) as home`)
        : (hasHome ? k.raw("g.home as home") : k.raw("NULL as home"));
      const selectAway = hasAwayUserId
        ? k.raw(`(SELECT ${displayName} FROM users u WHERE u.id = g.away_user_id) as away`)
        : (hasAway ? k.raw("g.away as away") : k.raw("NULL as away"));
      const rows = await k("matches as g")
        .select(
          "g.id",
          "g.kickoff_at",
          { leagueId: "g.league_id" },
          selectHome,
          selectAway,
          "g.home_score",
          "g.away_score"
        )
        .where({ league_id: leagueId })
        .orderBy("g.kickoff_at", "asc");
      const now = Date.now();
      const all = (rows || []).map(r => ({ ...r, ts: Date.parse(r.kickoff_at) || 0 }));
      const upcoming = all.filter(r => r.ts > now || (r.home_score == null && r.away_score == null));
      const completed = all.filter(r => r.ts <= now || (r.home_score != null || r.away_score != null));
      res.json({ upcoming, completed });
    } catch (err) {
      console.error("Fehler beim Abrufen der Spiele:", err && (err.stack || err.message || err));
      return res.status(500).json({ error: "Datenbankfehler", details: (err && err.message) || String(err) });
    }
  });

  // GET /:id/members - Liga-Mitglieder (joined_at optional)
  router.get("/:id/members", async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) {
        console.error("leagues/:id/members: no knex available (resolveKnex returned null)");
        return res.status(500).json({ error: "DB_NOT_AVAILABLE", details: "Knex instance not found" });
      }

      const ulCols = await k("user_leagues").columnInfo().catch(() => ({}));
      const includeJoinedAt = Object.prototype.hasOwnProperty.call(ulCols, "joined_at");

      const leagueId = Number(req.params.id);
      const q = k("user_leagues as ul")
        .join("users as u", "u.id", "ul.user_id")
        .where("ul.league_id", leagueId)
        .select("u.id", "u.firstname", "u.lastname", ...(includeJoinedAt ? ["ul.joined_at"] : []))
        .orderBy(["u.lastname", "u.firstname"]);

      const rows = await q;
      res.json(rows || []);
    } catch (err) {
      console.error("Fehler beim Abrufen der Mitglieder:", err && (err.stack || err.message || err));
      return res.status(500).json({ error: "Datenbankfehler", details: (err && err.message) || String(err) });
    }
  });

  // GET /:id/teams - Teams and their members for a league
  router.get("/:id/teams", async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

      const leagueId = Number(req.params.id);
      if (!leagueId || isNaN(leagueId)) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });

      const hasTeams = await k.schema.hasTable("teams");
      if (!hasTeams) return res.json({ teams: [] });

      // load teams for league
      const teams = await k("teams").where({ league_id: leagueId }).select("id", "name", "sport_id");

      if (!teams || teams.length === 0) return res.json({ teams: [] });

      // load all members for these teams in one query
      const teamIds = teams.map(t => t.id);
      const hasTeamMembers = await k.schema.hasTable("team_members");
      let members = [];
      if (hasTeamMembers) {
        // detect which user columns exist and only select those
        const usersInfo = await k("users").columnInfo().catch(() => ({}));
        const selectCols = ["tm.team_id", "tm.user_id"];
        if (Object.prototype.hasOwnProperty.call(usersInfo, "firstname")) selectCols.push("u.firstname");
        if (Object.prototype.hasOwnProperty.call(usersInfo, "lastname")) selectCols.push("u.lastname");
        if (Object.prototype.hasOwnProperty.call(usersInfo, "name")) selectCols.push("u.name");
        if (Object.prototype.hasOwnProperty.call(usersInfo, "email")) selectCols.push("u.email");
        members = await k("team_members as tm").leftJoin("users as u", "u.id", "tm.user_id").whereIn("tm.team_id", teamIds).select(selectCols);
      }

      // map members to teams (defensive: ensure members is an array)
      const byTeam = {};
      const membersArr = Array.isArray(members) ? members : [];
      membersArr.forEach(m => {
        const display = (m.firstname || m.lastname)
          ? `${m.firstname || ''} ${m.lastname || ''}`.trim()
          : (m.name || m.email || `user:${m.user_id}`);
        byTeam[m.team_id] = byTeam[m.team_id] || [];
        byTeam[m.team_id].push({ user_id: m.user_id, display_name: display });
      });

      const out = teams.map(t => ({ id: t.id, name: t.name, sport_id: t.sport_id, members: byTeam[t.id] || [] }));
      res.json({ teams: out });
    } catch (err) {
      console.error("Fehler beim Abrufen der Teams:", err && (err.stack || err.message || err));
      return res.status(500).json({ error: "Datenbankfehler", details: (err && err.message) || String(err) });
    }
  });

  // POST /:id/join - Liga beitreten
  router.post("/:id/join", requireAuth, async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

      const leagueId = Number(req.params.id);
      const userId = req.user.id;

      const existing = await k("user_leagues").where({ user_id: userId, league_id: leagueId }).first();
      if (existing) return res.json({ joined: false, message: "Bereits Mitglied" });

      await k("user_leagues").insert({ user_id: userId, league_id: leagueId, joined_at: new Date().toISOString() });
      res.json({ joined: true });
    } catch (err) {
      console.error("Fehler beim Beitreten zur Liga:", err);
      res.status(500).json({ error: "Datenbankfehler" });
    }
  });

  // POST /:id/leave - Liga verlassen
  router.post("/:id/leave", requireAuth, async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

      const leagueId = Number(req.params.id);
      const userId = req.user.id;

      const deleted = await k("user_leagues").where({ user_id: userId, league_id: leagueId }).del();
      res.json({ left: deleted > 0 });
    } catch (err) {
      console.error("Fehler beim Verlassen der Liga:", err);
      res.status(500).json({ error: "Datenbankfehler" });
    }
  });

  return router;
};

