const express = require("express");
const { isAuthenticated } = require("../../middleware/auth");

function resolveKnex(db) {
  if (db?.client && typeof db.raw === "function") return db;
  if (db?.knex?.client) return db.knex;
  try { return require("../../db"); } catch { /* no-op */ }
  throw new Error("No knex instance available");
}

async function detectGameTable(k) {
  if (await k.schema.hasTable("matches")) return "matches";
  if (await k.schema.hasTable("games")) return "games";
  throw new Error("Neither 'matches' nor 'games' table exists");
}

async function gameCols(k, table) {
  const info = await k(table).columnInfo();
  return {
    home: info.home_user_id ? "home_user_id" : (info.home ? "home" : null),
    away: info.away_user_id ? "away_user_id" : (info.away ? "away" : null),
  };
}

// Use only columns that exist in our current users schema
const DISPLAY_NAME_SQL = "COALESCE(u.firstname || ' ' || u.lastname, u.name, u.email)";

// Utility: check if table exists
async function tableExists(knex, tableName) {
  try {
    return await knex.schema.hasTable(tableName);
  } catch {
    return false;
  }
}

module.exports = function meRoutes({ db }) {
  const router = express.Router();
  let k;           // lazy
  let table;       // 'matches' or 'games'

  // GET /me -> Basisdaten des eingeloggten Nutzers
  router.get("/", isAuthenticated, async (req, res) => {
    try {
      k = k || resolveKnex(db);
      // Check if users table exists
      if (!(await tableExists(k, "users"))) {
        return res.json({
          firstname: req.user.firstname || "",
          lastname: req.user.lastname || "",
          email: req.user.email || "",
          isAdmin: !!(req.user.is_admin || req.user.isAdmin)
        });
      }
      const info = await k("users").columnInfo();

      // Dynamisch passende Spalten whlen
      const has = (c) => Object.prototype.hasOwnProperty.call(info, c);
      const cols = ["id", "email"]; // immer selektieren
      if (has("firstname")) cols.push({ firstname: "firstname" });
      if (has("lastname")) cols.push({ lastname: "lastname" });
      if (!has("firstname") && !has("lastname") && has("name")) cols.push({ name: "name" });
      if (has("is_admin")) cols.push({ isAdmin: "is_admin" });

      const row = await k("users")
        .select(cols)
        .where({ id: req.user.id })
        .first();

      if (!row) {
        // Fallback: liefere minimale Infos aus dem JWT, damit das Frontend nicht hart fehlschlägt
        return res.json({
          firstname: req.user.firstname || "",
          lastname: req.user.lastname || "",
          email: req.user.email || "",
          isAdmin: !!(req.user.is_admin || req.user.isAdmin)
        });
      }

      // Shape: { firstname, lastname, email, isAdmin }
      let out = { email: row.email, isAdmin: !!row.isAdmin };
      if (row.firstname || row.lastname) {
        out.firstname = row.firstname || "";
        out.lastname = row.lastname || "";
      } else if (row.name) {
        const parts = String(row.name).trim().split(/\s+/);
        out.firstname = parts[0] || "";
        out.lastname = parts.slice(1).join(" ");
      } else {
        out.firstname = "";
        out.lastname = "";
      }

      return res.json(out);
    } catch (e) {
      const msg = e && (e.message || "").toLowerCase();
      // Wenn Tabelle nicht existiert: antworte mit Token-basiertem Fallback statt 500
      if (msg.includes("no such table") || msg.includes("does not exist")) {
        return res.json({
          firstname: req.user.firstname || "",
          lastname: req.user.lastname || "",
          email: req.user.email || "",
          isAdmin: !!(req.user.is_admin || req.user.isAdmin)
        });
      }
      console.error("/me failed:", {
        msg: e && (e.message || e.toString()),
        stack: e && e.stack,
        userIdTried: req.user && req.user.id,
      });
      return res.status(500).json({ error: "DB_ERROR" });
    }
  });

  // GET /me/leagues -> Ligen des Users
  router.get("/leagues", isAuthenticated, async (req, res) => {
    try {
      k = k || resolveKnex(db);
      const tables = ["user_leagues", "leagues", "cities", "sports"];
      for (const t of tables) {
        if (!(await tableExists(k, t))) {
          return res.json([]);
        }
      }
      const ulCols = await k("user_leagues").columnInfo();
      const selectFields = [
        { id: "l.id" }, // <-- id statt leagueId für maximale Kompatibilität
        "l.name",
        { cityId: "c.id" },
        { city: "c.name" },
        { sportId: "s.id" },
        { sport: "s.name" }
      ];
      if (ulCols.joined_at) {
        selectFields.push({ joined_at: "ul.joined_at" });
      }
      if (ulCols.id) {
        selectFields.push({ userLeagueId: "ul.id" });
      }

      const rows = await k("user_leagues as ul")
        .join("leagues as l", "l.id", "ul.league_id")
        .leftJoin("cities as c", "c.id", "l.city_id")
        .leftJoin("sports as s", "s.id", "l.sport_id")
        .where("ul.user_id", req.user.id)
        .orderBy([ { column: "c.name", order: "asc" }, { column: "l.name", order: "asc" } ])
        .select(selectFields);

      // leagueUrl baut jetzt auf id auf!
      const result = (rows || []).map(row => ({
        ...row,
        leagueUrl: row.id ? `/league/${row.id}` : null,
        cityUrl: row.cityId ? `/cities/${row.cityId}` : null
      }));

      return res.json(result);
    } catch (e) {
      console.error("/me/leagues failed:", {
        msg: e && (e.message || e.toString()),
        stack: e && e.stack,
        userIdTried: req.user && req.user.id,
      });
      // Falls Tabellen noch nicht existieren, leer zurcckgeben statt 500
      const msg = (e && e.message || "").toLowerCase();
      if (msg.includes("no such table") || msg.includes("does not exist")) return res.json([]);
      return res.status(500).json({ error: "DB_ERROR" });
    }
  });

  // GET /me/games -> Spiele des Users (aufgeteilt in upcoming/completed)
  router.get("/games", isAuthenticated, async (req, res) => {
    try {
      k = k || resolveKnex(db);
      // Check if matches or games table exists before proceeding
      const hasMatches = await tableExists(k, "matches");
      const hasGames = await tableExists(k, "games");
      if (!hasMatches && !hasGames) {
        return res.json({ upcoming: [], completed: [] });
      }
      table = table || (hasMatches ? "matches" : "games");
      const cols = await gameCols(k, table);

      const selectHome = cols.home === "home_user_id"
        ? k.raw(`(SELECT ${DISPLAY_NAME_SQL} FROM users u WHERE u.id = g.home_user_id) as home`)
        : k.raw("g.home as home");

      const selectAway = cols.away === "away_user_id"
        ? k.raw(`(SELECT ${DISPLAY_NAME_SQL} FROM users u WHERE u.id = g.away_user_id) as away`)
        : k.raw("g.away as away");

      const uid = req.user.id;
      const all = await k(`${table} as g`)
        .leftJoin("leagues as l", "l.id", "g.league_id")
        .leftJoin("sports as s", "s.id", "l.sport_id")
        .leftJoin("cities as c", "c.id", "l.city_id")
        .where((qb) => {
          // Wenn weder home noch away-Spalte existiert, keine Filter -> leere Liste
          let hasAny = false;
          if (cols.home) { qb.orWhere(`g.${cols.home}`, uid); hasAny = true; }
          if (cols.away) { qb.orWhere(`g.${cols.away}`, uid); hasAny = true; }
          if (!hasAny) qb.whereRaw("1 = 0");
        })
        .orderBy("g.kickoff_at", "desc")
        .select(
          "g.id",
          "g.kickoff_at",
          { leagueId: "g.league_id" },
          { league: "l.name" },
          k.raw("COALESCE(c.name, l.city) as city"),
          { sport: "s.name" },
          selectHome,
          selectAway,
          "g.home_score",
          "g.away_score"
        );

      const now = Date.now();
      const split = (all || []).reduce((acc, r) => {
        const t = Date.parse(r.kickoff_at) || 0;
        const completed = r.home_score != null && r.away_score != null || t <= now;
        (completed ? acc.completed : acc.upcoming).push(r);
        return acc;
      }, { upcoming: [], completed: [] });

      return res.json(split);
    } catch (e) {
      console.error("/me/games failed:", {
        msg: e && (e.message || e.toString()),
        stack: e && e.stack,
        userIdTried: req.user && req.user.id,
        tableTried: table,
      });
      const msg = (e && e.message || "").toLowerCase();
      if (msg.includes("no such table") || msg.includes("does not exist")) return res.json({ upcoming: [], completed: [] });
      return res.status(500).json({ error: "DB_ERROR" });
    }
  });

  return router;
};
 
