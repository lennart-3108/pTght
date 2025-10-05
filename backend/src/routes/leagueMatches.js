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
          "g.away_score",
          ...(homeCol === 'home_user_id' ? [ 'g.home_user_id' ] : []),
          ...(awayCol === 'away_user_id' ? [ 'g.away_user_id' ] : [])
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

  // GET /:id/my-open-match - returns any open match for current user in this league
  router.get("/:leagueId/my-open-match", isAuthenticated, async (req, res) => {
    const k = resolveKnex(db);
    if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
    try {
      const leagueId = Number(req.params.leagueId);
      const me = req.user.id;
      if (!leagueId) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });

      const info = await k('matches').columnInfo().catch(() => ({}));
      const hasHomeUserId = !!info.home_user_id;

      // look for open matches (status = 'open' OR null scores)
      const q = k('matches').where({ league_id: leagueId })
        .where(function () {
          if (hasHomeUserId) {
            this.where('home_user_id', me).orWhere('away_user_id', me);
          } else {
            this.where('home', String(me)).orWhere('away', String(me));
          }
        })
        .where(function () {
          if (Object.prototype.hasOwnProperty.call(info, 'status')) {
            this.where('status', 'open');
          } else {
            this.whereNull('home_score').whereNull('away_score');
          }
        })
        .first();

      const row = await q;
      if (!row) return res.json(null);
      return res.json(row);
    } catch (e) {
      console.error('GET my-open-match failed:', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // GET /:leagueId/my-weekly-status - whether current user already has a match in this ISO week
  router.get('/:leagueId/my-weekly-status', isAuthenticated, async (req, res) => {
    const k = resolveKnex(db);
    if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
    try {
      const leagueId = Number(req.params.leagueId);
      const me = req.user.id;
      if (!leagueId) return res.status(400).json({ error: 'INVALID_LEAGUE_ID' });
      const hasMatches = await k.schema.hasTable('matches');
      if (!hasMatches) return res.json({ hasWeeklyMatch: false });
      const info = await k('matches').columnInfo().catch(() => ({}));
      const hasHomeUserId = !!info.home_user_id;
      const now = new Date();
      const day = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day);
      monday.setHours(0,0,0,0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23,59,59,999);
      const start = monday.toISOString();
      const end = sunday.toISOString();

      const q = k('matches')
        .where({ league_id: leagueId })
        .where(function () {
          if (hasHomeUserId) this.where('home_user_id', me).orWhere('away_user_id', me);
          else this.where('home', String(me)).orWhere('away', String(me));
        })
        .where(function () {
          const ts = [];
          if (Object.prototype.hasOwnProperty.call(info, 'completed_at')) ts.push('completed_at');
          if (Object.prototype.hasOwnProperty.call(info, 'kickoff_at')) ts.push('kickoff_at');
          if (Object.prototype.hasOwnProperty.call(info, 'created_at')) ts.push('created_at');
          if (ts.length === 0) this.whereNotNull('id');
          else this.where(function () { for (const c of ts) this.orWhereBetween(c, [start, end]); });
        })
        .count({ c: '*' });

      const row = await q;
      const cnt = Array.isArray(row) ? (row[0].c || 0) : (row.c || 0);
      return res.json({ hasWeeklyMatch: Number(cnt) >= 1 });
    } catch (e) {
      console.error('GET /:leagueId/my-weekly-status failed:', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // POST /:leagueId/propose - propose a match against a specific opponent (creates match with status=proposed)
  router.post('/:leagueId/propose', isAuthenticated, async (req, res) => {
    const k = resolveKnex(db);
    if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
    try {
      const leagueId = Number(req.params.leagueId);
      const me = req.user.id;
      const { opponent_user_id } = req.body || {};
      if (!leagueId || !opponent_user_id) return res.status(400).json({ error: 'INVALID_INPUT' });
      const hasMatches = await k.schema.hasTable('matches');
      if (!hasMatches) return res.status(500).json({ error: 'NO_MATCHES_TABLE' });
      const info = await k('matches').columnInfo().catch(() => ({}));
      const hasHomeUserId = !!info.home_user_id;

      // require both to be members
      const cntRow = await k('user_leagues')
        .whereIn('user_id', [me, opponent_user_id])
        .andWhere('league_id', leagueId)
        .count({ c: '*' });
      const cnt = Array.isArray(cntRow) ? (cntRow[0].c || 0) : (cntRow.c || 0);
      if (Number(cnt) < 2) return res.status(403).json({ error: 'Not both members' });

      const rec = { league_id: leagueId };
      if (hasHomeUserId) { rec.home_user_id = me; rec.away_user_id = Number(opponent_user_id); }
      else { rec.home = String(me); rec.away = String(opponent_user_id); }
      if (Object.prototype.hasOwnProperty.call(info, 'status')) rec.status = 'proposed';
      if (Object.prototype.hasOwnProperty.call(info, 'created_at')) rec.created_at = new Date().toISOString();

      const ins = await k('matches').insert(rec);
      const id = Array.isArray(ins) ? ins[0] : ins;
      const row = await k('matches').where('id', id).first();
      return res.status(201).json(row);
    } catch (e) {
      console.error('POST /:leagueId/propose failed:', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
  });
  // POST /:leagueId/match-search - try to find an open match to join or create one
  router.post('/:leagueId/match-search', isAuthenticated, async (req, res) => {
    const k = resolveKnex(db);
    if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

    const leagueId = Number(req.params.leagueId);
    const me = req.user.id;
    if (!leagueId) return res.status(400).json({ error: 'INVALID_LEAGUE_ID' });

    // transactionally join-or-create
    try {
      await k.transaction(async (trx) => {
        // basic checks: matches table exists
        const hasMatches = await trx.schema.hasTable('matches');
        if (!hasMatches) throw Object.assign(new Error('NO_MATCHES_TABLE'), { code: 'NO_MATCHES_TABLE' });

        const info = await trx('matches').columnInfo().catch(() => ({}));
        const hasHomeUserId = !!info.home_user_id;

        // ensure requestor is member of league
        const memberCount = await trx('user_leagues')
          .where({ league_id: leagueId, user_id: me })
          .count({ c: '*' });
        const cnt = Array.isArray(memberCount) ? (memberCount[0].c || 0) : (memberCount.c || 0);
        if (Number(cnt) < 1) throw Object.assign(new Error('Not a member'), { status: 403 });

        // load league + sport to inspect team/single
        const leagueRow = await trx('leagues').where('id', leagueId).first();
        if (!leagueRow) throw Object.assign(new Error('League not found'), { status: 404 });

        // detect sport team_size or sport_type
        let sportType = null; // 'team'|'single'|null
        try {
          const sport = await trx('sports').where('id', leagueRow.sport_id).first();
          if (sport) {
            if (sport.sport_type) sportType = sport.sport_type;
            else if (Number(sport.team_size) && Number(sport.team_size) > 1) sportType = 'team';
            else sportType = 'single';
          }
        } catch (e) { /* ignore */ }

        // If team sport, require that the requesting user is a captain (user_leagues.captain true)
        if (sportType === 'team') {
          const ul = await trx('user_leagues').where({ league_id: leagueId, user_id: me }).first();
          if (!ul || !ul.captain) throw Object.assign(new Error('Only captains can start match-search in team sports'), { status: 403 });
        }

        // Enforce weekly limit for community leagues: count matches in current week
        // Determine week start (Monday) and end (Sunday)
        const now = new Date();
        const day = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
        const monday = new Date(now);
        monday.setDate(now.getDate() - day);
        monday.setHours(0,0,0,0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23,59,59,999);

        // community league detection: simple heuristic - league.publicState === 'community' or league.is_community
        const isCommunity = !!(leagueRow.publicState === 'community' || leagueRow.is_community || leagueRow.isCommunity);
        if (isCommunity) {
          // count matches for this user in this league between monday..sunday
          const weekCountQ = trx('matches')
            .where({ league_id: leagueId })
            .where(function () {
              if (hasHomeUserId) this.where('home_user_id', me).orWhere('away_user_id', me);
              else this.where('home', String(me)).orWhere('away', String(me));
            })
            .where(function () {
              // completed_at within week OR kickoff_at within week OR created_at within week
              const possibleTs = [];
              if (Object.prototype.hasOwnProperty.call(info, 'completed_at')) possibleTs.push('completed_at');
              if (Object.prototype.hasOwnProperty.call(info, 'kickoff_at')) possibleTs.push('kickoff_at');
              if (Object.prototype.hasOwnProperty.call(info, 'created_at')) possibleTs.push('created_at');
              if (possibleTs.length === 0) {
                // fallback: count any matches (conservative)
                this.whereNotNull('id');
              } else {
                // build or chain to match any timestamp falling in window
                this.where(function () {
                  for (const c of possibleTs) {
                    this.orWhereBetween(c, [monday.toISOString(), sunday.toISOString()]);
                  }
                });
              }
            })
            .count({ c: '*' });

          const weekCountRow = await weekCountQ;
          const weekCount = Array.isArray(weekCountRow) ? (weekCountRow[0].c || 0) : (weekCountRow.c || 0);
          if (Number(weekCount) >= 1) throw Object.assign(new Error('Weekly match limit reached for community league'), { status: 429 });
        }

        // Check if the user already has an open match in this league
        const openMatchQ = trx('matches').where({ league_id: leagueId })
          .where(function () {
            if (hasHomeUserId) this.where('home_user_id', me).orWhere('away_user_id', me);
            else this.where('home', String(me)).orWhere('away', String(me));
          })
          .where(function () {
            if (Object.prototype.hasOwnProperty.call(info, 'status')) this.where('status', 'open');
            else this.whereNull('home_score').whereNull('away_score');
          })
          .first();

        const openMatch = await openMatchQ;
        if (openMatch) throw Object.assign(new Error('User already has an open match in this league'), { status: 409, match: openMatch });

        // Try to find any other open match in this league to join (excluding matches by me)
        const candidateQ = trx('matches')
          .where({ league_id: leagueId })
          .where(function () {
            if (hasHomeUserId) this.whereNot('home_user_id', me).andWhereNot('away_user_id', me);
            else this.whereNot('home', String(me)).andWhereNot('away', String(me));
          })
          .where(function () {
            if (Object.prototype.hasOwnProperty.call(info, 'status')) this.where('status', 'open');
            else this.whereNull('home_score').whereNull('away_score');
          })
          .orderBy('id', 'asc')
          .forUpdate();

        const candidate = await candidateQ.first();
        if (candidate) {
          // join this candidate: set away/home accordingly and update status to scheduled (or keep open per spec)
          const rec = {};
          if (hasHomeUserId) {
            // candidate may have only home_user_id set
            if (candidate.home_user_id && !candidate.away_user_id) {
              rec.away_user_id = me;
            } else if (!candidate.home_user_id && candidate.away_user_id) {
              rec.home_user_id = me;
            } else {
              // fallback: try to set away_user_id
              rec.away_user_id = me;
            }
          } else {
            if (candidate.home && !candidate.away) rec.away = String(me);
            else if (!candidate.home && candidate.away) rec.home = String(me);
            else rec.away = String(me);
          }

          // optionally update status to 'scheduled' if status column exists
          if (Object.prototype.hasOwnProperty.call(info, 'status')) rec.status = 'scheduled';

          await trx('matches').where('id', candidate.id).update(rec);

          // return updated match
          const updated = await trx('matches').where('id', candidate.id).first();
          res.status(200).json({ action: 'joined', match: updated });
          return;
        }

        // No candidate -> create a new open match with me as home
        const insertRec = { league_id: leagueId };
        if (hasHomeUserId) {
          insertRec.home_user_id = me;
        } else {
          insertRec.home = String(me);
        }
        if (Object.prototype.hasOwnProperty.call(info, 'status')) insertRec.status = 'open';
        if (Object.prototype.hasOwnProperty.call(info, 'created_at')) insertRec.created_at = new Date().toISOString();

        const ins = await trx('matches').insert(insertRec);
        const newId = Array.isArray(ins) ? ins[0] : ins;
        const newRow = await trx('matches').where('id', newId).first();
        res.status(201).json({ action: 'created', match: newRow });
        return;
      }); // end transaction
    } catch (err) {
      console.error('POST match-search failed:', err && (err.stack || err.message || err));
      if (err && err.code === 'NO_MATCHES_TABLE') return res.status(500).json({ error: 'NO_MATCHES_TABLE' });
      const status = (err && err.status) ? err.status : 500;
      const body = { error: err && err.message ? err.message : 'Datenbankfehler' };
      if (err && err.match) body.match = err.match;
      return res.status(status).json(body);
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

      // season scoping: if matches.season_id exists and no ?scope=overall, limit to current season
      const scope = String(req.query.scope || '').toLowerCase();
      let q = k(tableName)
        .select(`${homeCol} as home`, `${awayCol} as away`, "home_score", "away_score")
        .where({ league_id: leagueId })
        .whereNotNull("home_score")
        .whereNotNull("away_score");

      if (tableName === 'matches' && Object.prototype.hasOwnProperty.call(info, 'season_id') && scope !== 'overall') {
        try {
          if (await k.schema.hasTable('seasons')) {
            const year = new Date().getFullYear();
            const s = await k('seasons').where({ league_id: leagueId, name: String(year) }).first();
            if (s && s.id) q = q.andWhere('season_id', s.id);
          }
        } catch {}
      }

      const format = String(req.query.format || '').toLowerCase();
      if (format === 'table') {
        let winPts = 3, drawPts = 1, lossPts = 0;
        try {
          const lrow = await k('leagues').where({ id: leagueId }).first();
          if (lrow && lrow.sport_id) {
            const sinfo = await k('sports').columnInfo().catch(() => ({}));
            const sprow = await k('sports').where({ id: lrow.sport_id }).first();
            if (sprow) {
              if (sinfo.win_points && sprow.win_points != null) winPts = Number(sprow.win_points);
              if (sinfo.draw_points && sprow.draw_points != null) drawPts = Number(sprow.draw_points);
              if (sinfo.loss_points && sprow.loss_points != null) lossPts = Number(sprow.loss_points);
            }
          }
        } catch {}

        // Build a query that returns identity and scores
        let q2 = k(`${tableName} as g`)
          .where({ 'g.league_id': leagueId })
          .whereNotNull('g.home_score').whereNotNull('g.away_score')
          .select('g.home_score','g.away_score');

        const hasHTeam = !!info.home_team_id;
        const hasATeam = !!info.away_team_id;
        const useTeam = hasHTeam || hasATeam;
        if (useTeam) {
          q2 = q2.select({ home_id: hasHTeam ? 'g.home_team_id' : k.raw('NULL') }, { away_id: hasATeam ? 'g.away_team_id' : k.raw('NULL') });
        } else if (info.home_user_id || info.away_user_id) {
          q2 = q2.select({ home_id: info.home_user_id ? 'g.home_user_id' : k.raw('NULL') }, { away_id: info.away_user_id ? 'g.away_user_id' : k.raw('NULL') });
        } else {
          q2 = q2.select({ home_name: 'g.home' }, { away_name: 'g.away' });
        }

        if (tableName === 'matches' && Object.prototype.hasOwnProperty.call(info, 'season_id') && scope !== 'overall') {
          try {
            if (await k.schema.hasTable('seasons')) {
              const year = new Date().getFullYear();
              const s = await k('seasons').where({ league_id: leagueId, name: String(year) }).first();
              if (s && s.id) q2 = q2.andWhere('g.season_id', s.id);
            }
          } catch {}
        }

        const rows = await q2;
        const stats = new Map();
        const nameCache = new Map();
        async function resolveName(key) {
          if (nameCache.has(key)) return nameCache.get(key);
          let nm = String(key);
          try {
            if (useTeam && key) {
              const t = await k('teams').where({ id: key }).first();
              if (t && t.name) nm = t.name;
            } else if (key) {
              const u = await k('users').where({ id: key }).first();
              if (u) nm = (u.firstname || u.lastname) ? `${u.firstname || ''} ${u.lastname || ''}`.trim() : (u.name || u.email || nm);
            }
          } catch {}
          nameCache.set(key, nm);
          return nm;
        }
        function ensure(key, name) {
          if (!stats.has(key)) stats.set(key, { key, name: name || String(key), played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
          return stats.get(key);
        }
        for (const r of rows) {
          const hs = Number(r.home_score || 0);
          const as = Number(r.away_score || 0);
          let hk, ak, hn, an;
          if ('home_id' in r || 'away_id' in r) {
            hk = r.home_id; ak = r.away_id; hn = await resolveName(hk); an = await resolveName(ak);
          } else {
            hk = r.home_name; ak = r.away_name; hn = String(hk || '-'); an = String(ak || '-');
          }
          const H = ensure(hk, hn); const A = ensure(ak, an);
          H.played++; A.played++;
          H.gf += hs; H.ga += as; H.gd = H.gf - H.ga;
          A.gf += as; A.ga += hs; A.gd = A.gf - A.ga;
          if (hs > as) { H.won++; H.points += winPts; A.lost++; }
          else if (hs < as) { A.won++; A.points += winPts; H.lost++; }
          else { H.drawn++; A.drawn++; H.points += drawPts; A.points += drawPts; }
        }
        const arr = Array.from(stats.values()).sort((x,y) => (y.points - x.points) || (y.gd - x.gd) || (y.gf - x.gf) || String(x.name).localeCompare(String(y.name)));
        arr.forEach((row, idx) => { row.rank = idx + 1; });
        return res.json(arr);
      }

      const games = await q;
      return res.json(games || []);
    } catch (e) {
      console.error("GET /:id/standings failed:", e && (e.stack || e.message || e));
      return res.status(500).json({ error: "Datenbankfehler" });
    }
  });

  return router;
};