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
  router.get("/", async (req, res) => {
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

      // Parse pagination and filter params
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const offset = parseInt(req.query.offset) || 0;
      const cityId = req.query.cityId ? parseInt(req.query.cityId) : null;
      const sportId = req.query.sportId ? parseInt(req.query.sportId) : null;
      const search = req.query.search ? String(req.query.search).trim() : null;

      // Build base query with LEFT JOIN
      let query = k("leagues as l")
        .leftJoin("cities as c", "l.city_id", "c.id")
        .leftJoin("sports as s", "l.sport_id", "s.id");

      // Apply filters
      if (cityId) {
        query = query.where("l.city_id", cityId);
      }
      if (sportId) {
        query = query.where("l.sport_id", sportId);
      }
      if (search) {
        query = query.where(function() {
          this.where("l.name", "like", `%${search}%`)
              .orWhere("c.name", "like", `%${search}%`)
              .orWhere("s.name", "like", `%${search}%`);
        });
      }

      // Get total count
      const countQuery = query.clone().count("l.id as count").first();
      const countResult = await countQuery;
      const total = parseInt(countResult?.count || 0);

      // Get paginated results
      const rows = await query
        .select(
          "l.id",
          "l.city_id",
          "l.sport_id",
          { cityId: k.raw("COALESCE(c.id, l.city_id)") },
          { sportId: k.raw("COALESCE(s.id, l.sport_id)") },
          // only reference l.city if that column actually exists, otherwise fallback to c.name or empty string
          (hasLeagueCityCol ? k.raw("COALESCE(c.name, l.city) as city") : k.raw("COALESCE(c.name, '') as city")),
          (hasLeagueSportCol ? k.raw("COALESCE(s.name, l.sport) as sport") : k.raw("COALESCE(s.name, '') as sport")),
          "l.name",
          ...(hasPublicState ? ["l.publicState"] : [])
        )
        .orderBy(["c.name", "l.name"])
        .limit(limit)
        .offset(offset);

      res.json({
        data: rows || [],
        total,
        limit,
        offset,
        hasMore: offset + rows.length < total
      });
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
          { cityId: k.raw("COALESCE(c.id, l.city_id)") },
          { sportId: k.raw("COALESCE(s.id, l.sport_id)") },
          // only reference l.city if that column actually exists, otherwise fallback to c.name or empty string
          (hasLeagueCityCol2 ? k.raw("COALESCE(c.name, l.city) as city") : k.raw("COALESCE(c.name, '') as city")),
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
        
        // Pre-load all league members to map names to user IDs (prevent duplicates)
        const userIdByName = new Map();
        try {
          const hasUserLeagues = await k.schema.hasTable('user_leagues');
          const hasUserSeasons = await k.schema.hasTable('user_seasons');
          
          let members = [];
          
          if (hasUserSeasons && seasonId) {
            members = await k('user_seasons as us')
              .join('users as u', 'u.id', 'us.user_id')
              .where({ 'us.season_id': seasonId })
              .select('u.id', 'u.firstname', 'u.lastname', 'u.email')
              .distinct();
          } else if (hasUserLeagues) {
            members = await k('user_leagues as ul')
              .join('users as u', 'u.id', 'ul.user_id')
              .where({ 'ul.league_id': leagueId })
              .select('u.id', 'u.firstname', 'u.lastname', 'u.email')
              .distinct();
          }

          // Build mapping: normalize name -> user ID
          for (const m of members) {
            const uid = m.id;
            // Use EXACT same logic as resolveUserName to ensure consistency
            let fullName;
            if (m.firstname || m.lastname) {
              fullName = `${m.firstname || ''} ${m.lastname || ''}`.trim();
            } else if (m.email) {
              fullName = m.email;
            } else {
              fullName = String(uid);
            }
            
            // Map all possible name variants to this user ID
            const normalize = (s) => String(s || '').toLowerCase().trim();
            userIdByName.set(normalize(fullName), uid);
            if (m.email) userIdByName.set(normalize(m.email), uid);
            if (m.firstname) userIdByName.set(normalize(m.firstname), uid);
            const combined = `${m.firstname || ''} ${m.lastname || ''}`.trim();
            if (combined) userIdByName.set(normalize(combined), uid);
            
            // Pre-create entry with 0 stats for all members AND cache the name
            const key = `u:${uid}`;
            stats.set(key, { key, name: fullName, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
            nameCache.set(key, fullName); // Cache the name to prevent resolveUserName from returning different name
          }
        } catch (e) {
          console.error('Error loading league members:', e.message);
        }
        
        async function resolveUserName(uid) {
          const key = `u:${uid}`;
          // Use cached name if available (from pre-loading)
          if (nameCache.has(key)) return nameCache.get(key);
          let nm = String(uid);
          try {
            const u = await k('users').where({ id: uid }).first();
            if (u) nm = (u.firstname || u.lastname) ? `${u.firstname || ''} ${u.lastname || ''}`.trim() : (u.email || nm);
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
          // Best available identity per side: team_id -> user_id -> name (with name->id lookup)
          let hk, hn;
          if (r.home_team_id != null) { 
            hk = `t:${r.home_team_id}`; 
            hn = await resolveTeamName(r.home_team_id); 
          } else if (r.home_user_id != null) { 
            hk = `u:${r.home_user_id}`; 
            hn = await resolveUserName(r.home_user_id); 
          } else {
            // Try to map name to user ID first
            const normalize = (s) => String(s || '').toLowerCase().trim();
            const possibleUid = userIdByName.get(normalize(r.home_name || ''));
            if (possibleUid) {
              hk = `u:${possibleUid}`;
              hn = await resolveUserName(possibleUid);
            } else {
              hk = `n:${r.home_name || '-'}`; 
              hn = String(r.home_name || '-');
            }
          }

          let ak, an;
          if (r.away_team_id != null) { 
            ak = `t:${r.away_team_id}`; 
            an = await resolveTeamName(r.away_team_id); 
          } else if (r.away_user_id != null) { 
            ak = `u:${r.away_user_id}`; 
            an = await resolveUserName(r.away_user_id); 
          } else {
            // Try to map name to user ID first
            const normalize = (s) => String(s || '').toLowerCase().trim();
            const possibleUid = userIdByName.get(normalize(r.away_name || ''));
            if (possibleUid) {
              ak = `u:${possibleUid}`;
              an = await resolveUserName(possibleUid);
            } else {
              ak = `n:${r.away_name || '-'}`; 
              an = String(r.away_name || '-');
            }
          }
          
          const H = ensure(hk, hn); 
          const A = ensure(ak, an);
          H.played++; A.played++;
          H.gf += hs; H.ga += as; H.gd = H.gf - H.ga;
          A.gf += as; A.ga += hs; A.gd = A.gf - A.ga;
          if (hs > as) { H.won++; H.points += winPts; A.lost++; }
          else if (hs < as) { A.won++; A.points += winPts; H.lost++; }
          else { H.drawn++; A.drawn++; H.points += drawPts; A.points += drawPts; }
        }

        // Filter: only show players who have actually played games (played > 0)
        const arr = Array.from(stats.values())
          .filter(row => row.played > 0)
          .sort((x,y) => (y.points - x.points) || (y.gd - x.gd) || (y.gf - x.gf) || String(x.name).localeCompare(String(y.name)));
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

  // GET /:id/my-open-match - offenes Match des Users in dieser Liga
  router.get("/:id/my-open-match", requireAuth, async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

      const leagueId = Number(req.params.id);
      const me = req.user.id;
      if (!leagueId) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });

      const hasMatches = await k.schema.hasTable("matches").catch(() => false);
      if (!hasMatches) return res.json(null);

      const info = await k("matches").columnInfo().catch(() => ({}));
      const hasHomeUserId = Object.prototype.hasOwnProperty.call(info, "home_user_id");
      const hasHomeText = Object.prototype.hasOwnProperty.call(info, "home");
      const hasAwayText = Object.prototype.hasOwnProperty.call(info, "away");

      const row = await k("matches")
        .where({ league_id: leagueId })
        .where(function () {
          if (hasHomeUserId) {
            this.where("home_user_id", me).orWhere("away_user_id", me);
          } else if (hasHomeText || hasAwayText) {
            const meStr = String(me);
            this.where("home", meStr).orWhere("away", meStr);
          }
        })
        .where(function () {
          if (hasHomeUserId) {
            this.where(function () {
              this.whereNull("away_user_id").whereNotNull("home_user_id");
            }).orWhere(function () {
              this.whereNull("home_user_id").whereNotNull("away_user_id");
            });
          } else if (hasHomeText || hasAwayText) {
            this.where(function () {
              this.whereRaw("(away IS NULL OR TRIM(away) = '')")
                .whereRaw("(home IS NOT NULL AND TRIM(home) <> '')");
            }).orWhere(function () {
              this.whereRaw("(home IS NULL OR TRIM(home) = '')")
                .whereRaw("(away IS NOT NULL AND TRIM(away) <> '')");
            });
          }
        })
        .whereNull("home_score")
        .whereNull("away_score")
        .where(function () {
          if (Object.prototype.hasOwnProperty.call(info, "status")) {
            this.whereNull("status").orWhereIn("status", ["open", "proposed"]);
          } else {
            this.whereNotNull("id");
          }
        })
        .first();

      return res.json(row || null);
    } catch (err) {
      console.error("GET /:id/my-open-match failed:", err && (err.stack || err.message || err));
      return res.status(500).json({ error: "Datenbankfehler" });
    }
  });

  // GET /:id/my-weekly-status - hat der User bereits ein Match in dieser Woche
  router.get("/:id/my-weekly-status", requireAuth, async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

      const leagueId = Number(req.params.id);
      const me = req.user.id;
      if (!leagueId) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });

      const hasMatches = await k.schema.hasTable("matches").catch(() => false);
      if (!hasMatches) return res.json({ hasWeeklyMatch: false });

      const info = await k("matches").columnInfo().catch(() => ({}));
      const hasHomeUserId = Object.prototype.hasOwnProperty.call(info, "home_user_id");
      const hasHomeText = Object.prototype.hasOwnProperty.call(info, "home");
      const hasAwayText = Object.prototype.hasOwnProperty.call(info, "away");

      const now = new Date();
      const offset = (now.getDay() + 6) % 7; // Montag=0
      const monday = new Date(now);
      monday.setDate(now.getDate() - offset);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      const startIso = monday.toISOString();
      const endIso = sunday.toISOString();

      const rows = await k("matches")
        .where({ league_id: leagueId })
        .where(function () {
          if (hasHomeUserId) {
            this.where("home_user_id", me).orWhere("away_user_id", me);
          } else if (hasHomeText || hasAwayText) {
            const meStr = String(me);
            this.where("home", meStr).orWhere("away", meStr);
          }
        })
        .where(function () {
          if (hasHomeUserId) {
            this.whereNotNull("home_user_id").whereNotNull("away_user_id");
          } else if (hasHomeText || hasAwayText) {
            this.whereRaw("(home IS NOT NULL AND TRIM(home) <> '')")
              .whereRaw("(away IS NOT NULL AND TRIM(away) <> '')");
          }
        })
        .where(function () {
          const hasCompleted = Object.prototype.hasOwnProperty.call(info, "completed_at");
          const hasKickoff = Object.prototype.hasOwnProperty.call(info, "kickoff_at");
          const hasCreated = Object.prototype.hasOwnProperty.call(info, "created_at");
          if (hasCompleted || hasKickoff) {
            this.where(function () {
              if (hasCompleted) this.orWhereBetween("completed_at", [startIso, endIso]);
              if (hasKickoff) this.orWhereBetween("kickoff_at", [startIso, endIso]);
            });
          } else if (hasCreated) {
            this.whereBetween("created_at", [startIso, endIso]);
          } else {
            this.whereNotNull("id");
          }
        })
        .count({ c: "*" });

      const cntRow = Array.isArray(rows) ? rows[0] : rows;
      const cnt = Number(cntRow?.c || 0);
      return res.json({ hasWeeklyMatch: cnt >= 1 });
    } catch (err) {
      console.error("GET /:id/my-weekly-status failed:", err && (err.stack || err.message || err));
      return res.status(500).json({ error: "Datenbankfehler" });
    }
  });

  // POST /:id/match-search - offenes Match finden oder anlegen
  router.post("/:id/match-search", requireAuth, async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

      const leagueId = Number(req.params.id);
      const me = req.user.id;
      if (!leagueId) return res.status(400).json({ error: "INVALID_LEAGUE_ID" });

      await k.transaction(async (trx) => {
        const hasMatches = await trx.schema.hasTable("matches");
        if (!hasMatches) throw Object.assign(new Error("NO_MATCHES_TABLE"), { status: 500 });

        const info = await trx("matches").columnInfo().catch(() => ({}));
        const hasHomeUserId = Object.prototype.hasOwnProperty.call(info, "home_user_id");
        const hasAwayUserId = Object.prototype.hasOwnProperty.call(info, "away_user_id");
        const hasHomeText = Object.prototype.hasOwnProperty.call(info, "home");
        const hasAwayText = Object.prototype.hasOwnProperty.call(info, "away");

        const member = await trx("user_leagues").where({ league_id: leagueId, user_id: me }).first();
        if (!member) throw Object.assign(new Error("Not a member"), { status: 403 });

        let sportType = "single";
        try {
          const leagueRow = await trx("leagues").where({ id: leagueId }).first();
          if (leagueRow && leagueRow.sport_id) {
            const sportInfo = await trx("sports").columnInfo().catch(() => ({}));
            const sportRow = await trx("sports").where({ id: leagueRow.sport_id }).first();
            if (sportRow) {
              if (Object.prototype.hasOwnProperty.call(sportRow, "sport_type") && sportRow.sport_type) {
                sportType = String(sportRow.sport_type).toLowerCase();
              } else if (Object.prototype.hasOwnProperty.call(sportRow, "team_size") && Number(sportRow.team_size) > 1) {
                sportType = "team";
              }
            }
          }
        } catch (e) {
          console.warn("match-search sport detection failed", e && (e.message || e));
        }

        if (sportType === "team" && !member.captain) {
          throw Object.assign(new Error("Only captains can start match-search in team sports"), { status: 403 });
        }

        const now = new Date();
        const offset = (now.getDay() + 6) % 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - offset);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        const startIso = monday.toISOString();
        const endIso = sunday.toISOString();

        const weeklyRows = await trx("matches")
          .where({ league_id: leagueId })
          .where(function () {
            if (hasHomeUserId) this.where("home_user_id", me).orWhere("away_user_id", me);
            else if (hasHomeText || hasAwayText) this.where("home", String(me)).orWhere("away", String(me));
          })
          .where(function () {
            if (hasHomeUserId) this.whereNotNull("home_user_id").whereNotNull("away_user_id");
            else if (hasHomeText || hasAwayText) this.whereRaw("(home IS NOT NULL AND TRIM(home) <> '')")
              .whereRaw("(away IS NOT NULL AND TRIM(away) <> '')");
          })
          .where(function () {
            const hasCompleted = Object.prototype.hasOwnProperty.call(info, "completed_at");
            const hasKickoff = Object.prototype.hasOwnProperty.call(info, "kickoff_at");
            const hasCreated = Object.prototype.hasOwnProperty.call(info, "created_at");
            if (hasCompleted || hasKickoff) {
              this.where(function () {
                if (hasCompleted) this.orWhereBetween("completed_at", [startIso, endIso]);
                if (hasKickoff) this.orWhereBetween("kickoff_at", [startIso, endIso]);
              });
            } else if (hasCreated) {
              this.whereBetween("created_at", [startIso, endIso]);
            } else {
              this.whereNotNull("id");
            }
          })
          .count({ c: "*" });

        const weeklyCnt = Number((Array.isArray(weeklyRows) ? weeklyRows[0] : weeklyRows)?.c || 0);
        if (weeklyCnt >= 1) throw Object.assign(new Error("Weekly match limit reached"), { status: 429 });

        const openMatch = await trx("matches")
          .where({ league_id: leagueId })
          .whereNull("home_score").whereNull("away_score")
          .where(function () {
            if (hasHomeUserId && hasAwayUserId) {
              this.where(function () {
                this.where("home_user_id", me).whereNull("away_user_id");
              }).orWhere(function () {
                this.where("away_user_id", me).whereNull("home_user_id");
              });
            } else if (hasHomeText || hasAwayText) {
              const meStr = String(me);
              this.where(function () {
                this.where("home", meStr).whereRaw("(away IS NULL OR TRIM(away) = '')");
              }).orWhere(function () {
                this.where("away", meStr).whereRaw("(home IS NULL OR TRIM(home) = '')");
              });
            }
          })
          .first();

        if (openMatch) {
          res.json({ action: "skipped", match: openMatch });
          return;
        }

        const opponent = await trx("matches")
          .where({ league_id: leagueId })
          .whereNull("home_score").whereNull("away_score")
          .where(function () {
            if (hasHomeUserId && hasAwayUserId) {
              this.whereNull("away_user_id").whereNotNull("home_user_id");
            } else if (hasHomeText || hasAwayText) {
              this.whereRaw("(away IS NULL OR TRIM(away) = '')")
                .whereRaw("(home IS NOT NULL AND TRIM(home) <> '')");
            }
          })
          .orderBy("id", "asc")
          .first();

        if (opponent) {
          const update = {};
          if (hasHomeUserId && hasAwayUserId) {
            if (opponent.home_user_id != null && opponent.away_user_id == null) update.away_user_id = me;
            else if (opponent.away_user_id != null && opponent.home_user_id == null) update.home_user_id = me;
          } else if (hasHomeText || hasAwayText) {
            if (opponent.home && (!opponent.away || !String(opponent.away).trim())) update.away = String(me);
            else if (opponent.away && (!opponent.home || !String(opponent.home).trim())) update.home = String(me);
          }

          if (Object.keys(update).length) {
            await trx("matches").where({ id: opponent.id }).update(update);
            const joined = await trx("matches").where({ id: opponent.id }).first();
            res.json({ action: "joined", match: joined });
            return;
          }
        }

        const members = await trx("user_leagues")
          .where({ league_id: leagueId })
          .whereNot({ user_id: me })
          .pluck("user_id");

        for (const candidate of members) {
          if (candidate == null) continue;

          const candidateBusy = await trx("matches")
            .where({ league_id: leagueId })
            .whereNull("home_score").whereNull("away_score")
            .where(function () {
              if (hasHomeUserId && hasAwayUserId) {
                this.where("home_user_id", candidate).whereNull("away_user_id")
                  .orWhere("away_user_id", candidate).whereNull("home_user_id");
              } else if (hasHomeText || hasAwayText) {
                const cid = String(candidate);
                this.where("home", cid).whereRaw("(away IS NULL OR TRIM(away) = '')")
                  .orWhere("away", cid).whereRaw("(home IS NULL OR TRIM(home) = '')");
              }
            })
            .first();

          if (candidateBusy) continue;

          const pendingTogether = await trx("matches")
            .where({ league_id: leagueId })
            .whereNull("home_score").whereNull("away_score")
            .where(function () {
              if (hasHomeUserId && hasAwayUserId) {
                this.where(function () {
                  this.where("home_user_id", me).andWhere("away_user_id", candidate);
                }).orWhere(function () {
                  this.where("home_user_id", candidate).andWhere("away_user_id", me);
                });
              } else if (hasHomeText || hasAwayText) {
                const meStr = String(me);
                const candStr = String(candidate);
                this.where(function () {
                  this.where("home", meStr).andWhere("away", candStr);
                }).orWhere(function () {
                  this.where("home", candStr).andWhere("away", meStr);
                });
              }
            })
            .first();

          if (pendingTogether) continue;

          const insertRec = { league_id: leagueId };
          if (hasHomeUserId || hasAwayUserId) {
            if (hasHomeUserId) insertRec.home_user_id = me;
            if (hasAwayUserId) insertRec.away_user_id = candidate;
          } else if (hasHomeText || hasAwayText) {
            if (hasHomeText) insertRec.home = String(me);
            if (hasAwayText) insertRec.away = String(candidate);
          }

          insertRec.kickoff_at = null;
          insertRec.home_score = null;
          insertRec.away_score = null;

          if (Object.prototype.hasOwnProperty.call(info, "status")) insertRec.status = "proposed";
          if (Object.prototype.hasOwnProperty.call(info, "created_at")) insertRec.created_at = new Date().toISOString();

          const ins = await trx("matches").insert(insertRec);
          const newId = Array.isArray(ins) ? ins[0] : ins;
          const newRow = await trx("matches").where({ id: newId }).first();
          res.json({ action: "paired", match: newRow });
          return;
        }

        const fallback = { league_id: leagueId };
        if (hasHomeUserId) fallback.home_user_id = me;
        else if (hasAwayUserId) fallback.away_user_id = me;
        else if (hasHomeText) fallback.home = String(me);
        else if (hasAwayText) fallback.away = String(me);

        if (Object.prototype.hasOwnProperty.call(info, "status")) fallback.status = "open";
        if (Object.prototype.hasOwnProperty.call(info, "created_at")) fallback.created_at = new Date().toISOString();

        const ins = await trx("matches").insert(fallback);
        const newId = Array.isArray(ins) ? ins[0] : ins;
        const newRow = await trx("matches").where({ id: newId }).first();
        res.json({ action: "created", match: newRow });
      });
    } catch (err) {
      if (err?.status === 429) return res.status(429).json({ error: "WEEKLY_LIMIT_REACHED" });
      if (err?.status === 403) return res.status(403).json({ error: err.message || "Not allowed" });
      if (err?.status === 404) return res.status(404).json({ error: err.message || "Not found" });
      if (err?.message === "NO_MATCHES_TABLE") {
        return res.status(500).json({ error: "NO_MATCHES_TABLE" });
      }
      const status = err?.status ?? (err?.code === "SQLITE_ERROR" ? 400 : 500);
      console.error("POST /:id/match-search failed:", err && (err.stack || err.message || err));
      return res.status(status).json({ error: err.message || "Datenbankfehler" });
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

