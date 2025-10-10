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

  async function autoAssignMatchAfterJoin(trx, leagueId, userId) {
    if (!trx) return null;
    try {
      const hasMatches = await trx.schema.hasTable("matches");
      if (!hasMatches) return null;

      const info = await trx("matches").columnInfo().catch(() => ({}));
      const hasHomeUserId = !!info.home_user_id;
      const hasAwayUserId = !!info.away_user_id;
      const hasHomeText = !!info.home;
      const hasAwayText = !!info.away;
      const hasStatus = Object.prototype.hasOwnProperty.call(info, "status");
      const hasCreatedAt = Object.prototype.hasOwnProperty.call(info, "created_at");
      const hasSeasonColumn = Object.prototype.hasOwnProperty.call(info, "season_id");

      const nowIso = new Date().toISOString();

      let seasonId = null;
      if (hasSeasonColumn) {
        try {
          const hasSeasonsTable = await trx.schema.hasTable("seasons");
          if (hasSeasonsTable) {
            const year = String(new Date().getFullYear());
            const currentSeason = await trx("seasons").where({ league_id: leagueId, name: year }).first();
            if (currentSeason && currentSeason.id) {
              seasonId = currentSeason.id;
            } else {
              const fallbackSeason = await trx("seasons").where({ league_id: leagueId }).orderBy("start_date", "desc").first();
              if (fallbackSeason && fallbackSeason.id) seasonId = fallbackSeason.id;
            }
          }
        } catch (e) {
          console.warn("autoAssignMatchAfterJoin season lookup failed", e && (e.message || e));
        }
      }

      const withSeason = (rec) => {
        if (seasonId != null) rec.season_id = seasonId;
        return rec;
      };

      // 1. Suche offenes Match ohne Gegner und trage den neuen User als Gegner ein
      let openMatch = await trx("matches")
        .where({ league_id: leagueId })
        .whereNull("home_score").whereNull("away_score")
        .where(function () {
          if (hasHomeUserId && hasAwayUserId) {
            this.where(function () {
              this.whereNotNull("home_user_id").whereNull("away_user_id");
            }).orWhere(function () {
              this.whereNotNull("away_user_id").whereNull("home_user_id");
            });
          }
          if (hasHomeText && hasAwayText) {
            this.orWhere(function () {
              this.whereNotNull("home").whereRaw("(away IS NULL OR TRIM(away) = '')");
            }).orWhere(function () {
              this.whereNotNull("away").whereRaw("(home IS NULL OR TRIM(home) = '')");
            });
          }
        })
        .first();

      if (openMatch) {
        const updateRec = {};
        if (hasHomeUserId && hasAwayUserId) {
          if (openMatch.home_user_id != null && openMatch.away_user_id == null) {
            updateRec.away_user_id = userId;
          } else if (openMatch.away_user_id != null && openMatch.home_user_id == null) {
            updateRec.home_user_id = userId;
          }
        } else if (hasHomeText && hasAwayText) {
          if (openMatch.home && (!openMatch.away || String(openMatch.away).trim() === "")) {
            updateRec.away = String(userId);
          } else if (openMatch.away && (!openMatch.home || String(openMatch.home).trim() === "")) {
            updateRec.home = String(userId);
          }
        }
        if (Object.keys(updateRec).length > 0) {
          await trx("matches").where({ id: openMatch.id }).update(updateRec);
          const updated = await trx("matches").where({ id: openMatch.id }).first();
          return { action: "joined_open", match: updated };
        }
      }

      // 2. Prüfe, ob User schon ein offenes Match hat
      const userPending = await trx("matches")
        .where({ league_id: leagueId })
        .whereNull("home_score").whereNull("away_score")
        .where(function () {
          if (hasHomeUserId || hasAwayUserId) this.where("home_user_id", userId).orWhere("away_user_id", userId);
          if (hasHomeText || hasAwayText) this.orWhere("home", String(userId)).orWhere("away", String(userId));
        })
        .first();
      if (userPending) return { action: "existing", match: userPending };

      // 3. Erstelle neues Match (wie bisher)
      const otherMemberIds = await trx("user_leagues")
        .where({ league_id: leagueId })
        .whereNot("user_id", userId)
        .pluck("user_id")
        .catch(() => []);

      async function hasPendingBetween(a, b) {
        const row = await trx("matches")
          .where({ league_id: leagueId })
          .whereNull("home_score").whereNull("away_score")
          .where(function () {
            if (hasHomeUserId || hasAwayUserId) {
              this.where(function () { this.where("home_user_id", a).andWhere("away_user_id", b); })
                  .orWhere(function () { this.where("home_user_id", b).andWhere("away_user_id", a); });
            }
            if (hasHomeText || hasAwayText) {
              this.orWhere(function () { this.where("home", String(a)).andWhere("away", String(b)); })
                  .orWhere(function () { this.where("home", String(b)).andWhere("away", String(a)); });
            }
          })
          .first();
        return !!row;
      }

      async function hasOpenSlot(uid) {
        const row = await trx("matches")
          .where({ league_id: leagueId })
          .whereNull("home_score").whereNull("away_score")
          .where(function () {
            if (hasHomeUserId || hasAwayUserId) {
              this.orWhere(function () { this.where("home_user_id", uid).whereNull("away_user_id"); })
                  .orWhere(function () { this.where("away_user_id", uid).whereNull("home_user_id"); });
            }
            if (hasHomeText || hasAwayText) {
              this.orWhere(function () { this.where("home", String(uid)).whereRaw("(away IS NULL OR TRIM(away) = '')"); })
                  .orWhere(function () { this.where("away", String(uid)).whereRaw("(home IS NULL OR TRIM(home) = '')"); });
            }
          })
          .first();
        return !!row;
      }

      for (const opponentId of otherMemberIds) {
        if (!opponentId && opponentId !== 0) continue;
        if (await hasPendingBetween(userId, opponentId)) continue;
        if (await hasOpenSlot(opponentId)) continue;

        const insertRec = withSeason({ league_id: leagueId });
        let assigned = false;
        if (hasHomeUserId || hasAwayUserId) {
          if (hasHomeUserId) { insertRec.home_user_id = userId; assigned = true; }
          if (hasAwayUserId) { insertRec.away_user_id = opponentId; assigned = true; }
        } else if (hasHomeText || hasAwayText) {
          if (hasHomeText) { insertRec.home = String(userId); assigned = true; }
          if (hasAwayText) { insertRec.away = String(opponentId); assigned = true; }
        }
        if (!assigned) break;

        if (hasStatus) insertRec.status = "proposed";
        if (hasCreatedAt) insertRec.created_at = nowIso;

        const ins = await trx("matches").insert(insertRec);
        const newId = Array.isArray(ins) ? ins[0] : ins;
        const newRow = await trx("matches").where("id", newId).first();
        return { action: "paired", match: newRow };
      }

      // fallback: open match für den neuen User allein (wie bisher)
      const openRec = withSeason({ league_id: leagueId });
      let assignedSide = false;
      if (hasHomeUserId) { openRec.home_user_id = userId; assignedSide = true; }
      else if (hasAwayUserId) { openRec.away_user_id = userId; assignedSide = true; }
      else if (hasHomeText) { openRec.home = String(userId); assignedSide = true; }
      else if (hasAwayText) { openRec.away = String(userId); assignedSide = true; }
      if (!assignedSide) return null;

      if (hasStatus) openRec.status = "open";
      if (hasCreatedAt) openRec.created_at = nowIso;

      const inserted = await trx("matches").insert(openRec);
      const newId = Array.isArray(inserted) ? inserted[0] : inserted;
      const row = await trx("matches").where("id", newId).first();
      return { action: "created", match: row };
    } catch (e) {
      console.error("autoAssignMatchAfterJoin failed", e && (e.stack || e.message || e));
      return { action: "error", error: e && (e.message || String(e)) };
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
      // If the client requests a classic standings table, compute it here
      const format = String(req.query.format || '').toLowerCase();
      const scope = String(req.query.scope || '').toLowerCase();
      const seasonId = req.query.seasonId ? Number(req.query.seasonId) : null;

      if (format === 'table') {
        // default points (overridable via sports table if columns exist)
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

        // base query for finished games in this league
        let q2 = k({ g: 'matches' })
          .where({ 'g.league_id': leagueId })
          .whereNotNull('g.home_score').whereNotNull('g.away_score')
          .select('g.home_score','g.away_score');

        const hasHTeam = !!info.home_team_id;
        const hasATeam = !!info.away_team_id;
        const useTeam = hasHTeam || hasATeam;
        // Always select all identity columns so we can choose the best available per-row
        q2 = q2
          .select(
            { home_team_id: hasHTeam ? 'g.home_team_id' : k.raw('NULL') },
            { away_team_id: hasATeam ? 'g.away_team_id' : k.raw('NULL') },
            { home_user_id: hasHomeUserId ? 'g.home_user_id' : k.raw('NULL') },
            { away_user_id: hasAwayUserId ? 'g.away_user_id' : k.raw('NULL') }
          )
          .select(
            { home_name: hasHome ? 'g.home' : k.raw('NULL') },
            { away_name: hasAway ? 'g.away' : k.raw('NULL') }
          );

        // Season scoping: if season_id exists and scope != overall apply a filter.
        // Include legacy rows with season_id NULL so older matches still count in the current season.
        if (Object.prototype.hasOwnProperty.call(info, 'season_id') && scope !== 'overall') {
          try {
            if (await k.schema.hasTable('seasons')) {
              if (seasonId) {
                q2 = q2.andWhere(function(){ this.where('g.season_id', seasonId).orWhereNull('g.season_id'); });
              } else {
                const year = new Date().getFullYear();
                const s = await k('seasons').where({ league_id: leagueId, name: String(year) }).first();
                if (s && s.id) q2 = q2.andWhere(function(){ this.where('g.season_id', s.id).orWhereNull('g.season_id'); });
              }
            }
          } catch {}
        }

        const rows = await q2;
        const stats = new Map();
        const nameCache = new Map();
        async function resolveUserName(uid) {
          const key = `u:${uid}`;
          if (nameCache.has(key)) return nameCache.get(key);
          let nm = String(uid);
          try {
            const u = await k('users').where({ id: uid }).first();
            if (u) nm = (u.firstname || u.lastname) ? `${u.firstname || ''} ${u.lastname || ''}`.trim() : (u.name || u.email || nm);
          } catch {}
          nameCache.set(key, nm);
          return nm;
        }
        async function resolveTeamName(tid) {
          const key = `t:${tid}`;
          if (nameCache.has(key)) return nameCache.get(key);
          let nm = String(tid);
          try {
            const t = await k('teams').where({ id: tid }).first();
            if (t && t.name) nm = t.name;
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
          // Best available identity per side: team_id -> user_id -> name
          let hk, hn;
          if (r.home_team_id != null) { hk = `t:${r.home_team_id}`; hn = await resolveTeamName(r.home_team_id); }
          else if (r.home_user_id != null) { hk = `u:${r.home_user_id}`; hn = await resolveUserName(r.home_user_id); }
          else { hk = `n:${r.home_name || '-'}`; hn = String(r.home_name || '-'); }

          let ak, an;
          if (r.away_team_id != null) { ak = `t:${r.away_team_id}`; an = await resolveTeamName(r.away_team_id); }
          else if (r.away_user_id != null) { ak = `u:${r.away_user_id}`; an = await resolveUserName(r.away_user_id); }
          else { ak = `n:${r.away_name || '-'}`; an = String(r.away_name || '-'); }
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

      // Default: return finished games (legacy behavior)
      let q = k("matches as g")
        .select(selectHome, selectAway, "g.home_score", "g.away_score")
        .where({ league_id: leagueId })
        .whereNotNull("g.home_score")
        .whereNotNull("g.away_score");

      if (Object.prototype.hasOwnProperty.call(info, 'season_id') && scope !== 'overall') {
        try {
          const hasSeasons = await k.schema.hasTable('seasons');
          if (hasSeasons) {
            if (seasonId) {
              q = q.andWhere('g.season_id', seasonId);
            } else {
              const year = new Date().getFullYear();
              const s = await k('seasons').where({ league_id: leagueId, name: String(year) }).first();
              if (s && s.id) q = q.andWhere('g.season_id', s.id);
            }
          }
        } catch {}
      }

      const games = await q;
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
  const all = rows || [];
  // Split strictly by result presence to avoid duplicates
  const upcoming = all.filter(r => (r.home_score == null && r.away_score == null));
  const completed = all.filter(r => (r.home_score != null && r.away_score != null));
      res.json({ upcoming, completed });
    } catch (err) {
      console.error("Fehler beim Abrufen der Spiele:", err && (err.stack || err.message || err));
      return res.status(500).json({ error: "Datenbankfehler", details: (err && err.message) || String(err) });
    }
  });

  // GET /:id/seasons - list seasons for a league (compat shim)
  router.get("/:id/seasons", async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) {
        console.error("leagues/:id/seasons: no knex available (resolveKnex returned null)");
        return res.status(500).json({ error: "DB_NOT_AVAILABLE", details: "Knex instance not found" });
      }
      const leagueId = Number(req.params.id);
      if (!leagueId || isNaN(leagueId)) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });
      const hasSeasons = await k.schema.hasTable("seasons").catch(() => false);
      if (!hasSeasons) return res.json([]);
      const rows = await k("seasons").where({ league_id: leagueId }).select("id", "name").orderBy("name", "asc");
      return res.json(rows || []);
    } catch (err) {
      console.error("Fehler beim Abrufen der Saisons:", err && (err.stack || err.message || err));
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

      const outcome = await k.transaction(async (trx) => {
        const existing = await trx("user_leagues").where({ user_id: userId, league_id: leagueId }).first();
        if (existing) return { joined: false, message: "Bereits Mitglied" };

        const ulCols = await trx("user_leagues").columnInfo().catch(() => ({}));
        const hasJoinedAt = Object.prototype.hasOwnProperty.call(ulCols, "joined_at");
        const insertRec = { user_id: userId, league_id: leagueId };
        if (hasJoinedAt) insertRec.joined_at = new Date().toISOString();

        await trx("user_leagues").insert(insertRec);

        let matchInfo = null;
        try {
          matchInfo = await autoAssignMatchAfterJoin(trx, leagueId, userId);
        } catch (matchErr) {
          console.error("autoAssignMatchAfterJoin threw:", matchErr && (matchErr.stack || matchErr.message || matchErr));
          matchInfo = { action: "error", error: matchErr && (matchErr.message || String(matchErr)) };
        }

        return { joined: true, matchInfo };
      });

      if (!outcome) return res.json({ joined: false, message: "Unbekannter Status" });
      if (!outcome.joined) return res.json(outcome);

      const payload = { joined: true };
      if (outcome.matchInfo) {
        payload.matchAction = outcome.matchInfo.action;
        if (outcome.matchInfo.match) payload.match = outcome.matchInfo.match;
        if (outcome.matchInfo.error) payload.matchError = outcome.matchInfo.error;
      }
      res.json(payload);
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

