const express = require("express");
const { isAuthenticated } = require("../../middleware/auth");

module.exports = function usersRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // Try to resolve a Knex instance for more complex queries if available
  function resolveKnex() {
    if (ctx && ctx.db && ctx.db.knex && ctx.db.knex.client) return ctx.db.knex;
    try {
      // fallback to legacy knex instance
      // path relative to this file: backend/src/routes/users.js -> ../../db.js
      const k = require("../../db");
      if (k && k.client) return k;
    } catch (_) {}
    return null;
  }

  router.get("/users/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Ungültige ID" });
    // Be tolerant to missing avatar_url column
    db.all(`PRAGMA table_info(users)`, [], (pe, cols) => {
      if (pe) return res.status(500).json({ error: "Datenbankfehler", details: pe.message });
      const hasAvatar = Array.isArray(cols) && cols.some(c => String(c.name || "").toLowerCase() === "avatar_url");
      const sql = hasAvatar
        ? `SELECT id, firstname, lastname, email, avatar_url FROM users WHERE id = ?`
        : `SELECT id, firstname, lastname, email FROM users WHERE id = ?`;
      db.get(sql, [id], (err, user) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler", details: err.message });
        if (!user) return res.status(404).json({ error: "Nutzer nicht gefunden" });
        // Check if user_sports table exists; if not, try fallback via user_leagues→leagues→sports
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_sports'`, [], (te, rs) => {
          const avatar_url = hasAvatar ? (user.avatar_url || null) : null;
          if (te) return res.status(500).json({ error: "Datenbankfehler", details: te.message });
          if (rs && rs.name === 'user_sports') {
            db.all(
              `SELECT s.id, s.name
               FROM user_sports us
               JOIN sports s ON s.id = us.sport_id
               WHERE us.user_id = ?
               ORDER BY s.name`,
              [id],
              (e2, sports) => {
                if (e2) return res.status(500).json({ error: "Datenbankfehler", details: e2.message });
                return res.json({ ...user, avatar_url, sports: sports || [] });
              }
            );
          } else {
            // Fallback: infer sports via user_leagues
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_leagues'`, [], (te2, rs2) => {
              if (te2) return res.status(500).json({ error: "Datenbankfehler", details: te2.message });
              if (!rs2) return res.json({ ...user, avatar_url, sports: [] });
              const sql2 = `
                SELECT DISTINCT s.id, s.name
                FROM user_leagues ul
                JOIN leagues l ON l.id = ul.league_id
                JOIN sports s ON s.id = l.sport_id
                WHERE ul.user_id = ?
                ORDER BY s.name`;
              db.all(sql2, [id], (e3, sports2) => {
                if (e3) return res.status(500).json({ error: "Datenbankfehler", details: e3.message });
                return res.json({ ...user, avatar_url, sports: sports2 || [] });
              });
            });
          }
        });
      });
    });
  });

    // Upload avatar (simple base64 image) → stores under /uploads/avatars/<id>.png and sets users.avatar_url
    router.post('/users/:id/avatar', isAuthenticated, (req, res) => {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) return res.status(400).json({ error: 'Ungültige ID' });
      // Only allow users to upload their own avatar unless admin
      const reqUserId = Number(req.user && req.user.id);
      const isAdmin = !!(req.user && (req.user.is_admin || req.user.isAdmin));
      if (!isAdmin && reqUserId !== userId) {
        return res.status(403).json({ error: 'FORBIDDEN' });
      }
      try {
        const raw = req.body?.image || req.body?.avatar || '';
        const m = String(raw).match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
        if (!m) return res.status(400).json({ error: 'INVALID_IMAGE' });
        const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
        const buf = Buffer.from(m[2], 'base64');
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(__dirname, '../../uploads/avatars');
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${userId}.${ext}`);
        fs.writeFileSync(filePath, buf);
        const publicUrl = `/uploads/avatars/${userId}.${ext}`;
        // Ensure avatar_url column exists (add if missing)
        db.all(`PRAGMA table_info(users)`, [], (pe, cols) => {
          if (pe) return res.status(500).json({ error: 'DB_ERROR', details: pe.message });
          const hasAvatar = Array.isArray(cols) && cols.some(c => String(c.name || '').toLowerCase() === 'avatar_url');
          const proceed = () => {
            db.run(`UPDATE users SET avatar_url = ? WHERE id = ?`, [publicUrl, userId], function (err) {
              if (err) return res.status(500).json({ error: 'DB_ERROR', details: err.message });
              return res.json({ ok: true, url: publicUrl });
            });
          };
          if (hasAvatar) return proceed();
          db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT`, [], (altErr) => {
            // ignore error if column already exists (race or incompatible)
            if (altErr && !/duplicate column|exists/i.test(altErr.message || '')) {
              return res.status(500).json({ error: 'DB_ALTER_FAILED', details: altErr.message });
            }
            proceed();
          });
        });
      } catch (e) {
        return res.status(500).json({ error: 'UPLOAD_FAILED', details: e?.message || String(e) });
      }
    });

  // Ligen eines Users (tolerant gegenüber fehlender joined_at-Spalte)
  router.get("/users/:id/leagues", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Ungültige ID" });

    // Prüfe, ob user_leagues.joined_at existiert
    db.all(`PRAGMA table_info(user_leagues)`, [], (pe, cols) => {
      if (pe) return res.status(500).json({ error: "Datenbankfehler", details: pe.message });
      const hasJoinedAt = Array.isArray(cols) && cols.some(c => String(c.name || c.cid || '').toLowerCase() === 'joined_at');
      const joinedSelect = hasJoinedAt ? 'lm.joined_at as joined_at' : 'NULL as joined_at';

      const sql = `
        SELECT
          l.id,
          l.name,
          c.id AS cityId, c.name AS city,
          s.id AS sportId, s.name AS sport,
          ${joinedSelect}
        FROM user_leagues lm
        JOIN leagues l ON l.id = lm.league_id
        JOIN cities c ON c.id = l.city_id
        JOIN sports s ON s.id = l.sport_id
        WHERE lm.user_id = ?
        ORDER BY c.name, l.name
      `;
      db.all(sql, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler", details: err.message });
        res.json(rows || []);
      });
    });
  });

  // Simple search/autocomplete for users: GET /users?search=term
  router.get('/users', (req, res) => {
    const q = (req.query.search || '').trim();
    if (!q) return res.json([]);

    // basic tokenization: match against email, firstname, lastname
    const like = `%${q.replace(/%/g, '')}%`;
    const sql = `SELECT id, firstname, lastname, email FROM users WHERE email LIKE ? OR firstname LIKE ? OR lastname LIKE ? ORDER BY firstname, lastname LIMIT 20`;
    db.all(sql, [like, like, like], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
      const out = (rows || []).map(r => ({ id: r.id, firstname: r.firstname, lastname: r.lastname, email: r.email, displayName: (r.firstname || r.lastname) ? `${(r.firstname||'').trim()} ${(r.lastname||'').trim()}`.trim() : r.email }));
      res.json(out);
    });
  });

  // Spiele eines Users (über seine Ligen) – tolerant: bevorzugt 'matches', fallback 'games'
  router.get("/users/:id/games", async (req, res) => {
    try {
      const userId = Number(req.params.id);
      if (!Number.isFinite(userId)) return res.status(400).json({ error: "Ungültige ID" });

      // Wähle eine Knex-Instanz aus dem Kontext oder fallback
      const k = resolveKnex();
      if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

      // Ermittele verfügbare Tabelle
      const table = (await k.schema.hasTable("matches")) ? "matches" : ((await k.schema.hasTable("games")) ? "games" : null);
      if (!table) return res.json({ upcoming: [], completed: [] });

      // Lese Spalteninformationen
      const info = await k(table).columnInfo().catch(() => ({}));
      const hasHomeUserId = Object.prototype.hasOwnProperty.call(info, "home_user_id");
      const hasAwayUserId = Object.prototype.hasOwnProperty.call(info, "away_user_id");
      const hasHomeText = Object.prototype.hasOwnProperty.call(info, "home");
      const hasAwayText = Object.prototype.hasOwnProperty.call(info, "away");

      const tsCandidates = ["kickoff_at", "kickoff", "scheduled_at", "date", "datetime", "start_time"];
      const tsCol = tsCandidates.find(c => Object.prototype.hasOwnProperty.call(info, c)) || null;

      const usersInfo = await k("users").columnInfo().catch(() => ({}));
      const hasFirst = Object.prototype.hasOwnProperty.call(usersInfo, "firstname");
      const hasLast = Object.prototype.hasOwnProperty.call(usersInfo, "lastname");
      const hasName = Object.prototype.hasOwnProperty.call(usersInfo, "name");
      const hasEmail = Object.prototype.hasOwnProperty.call(usersInfo, "email");
      const fullNameExpr = (hasFirst || hasLast) ? "NULLIF(TRIM(COALESCE(u.firstname,'') || ' ' || COALESCE(u.lastname,'')), '')" : null;
      const displayExpr = (alias) => {
        const parts = [];
        if (fullNameExpr) parts.push(fullNameExpr.replace(/u\./g, `${alias}.`));
        if (hasName) parts.push(`${alias}.name`);
        if (hasEmail) parts.push(`${alias}.email`);
        if (!parts.length) parts.push("'User'");
        return `COALESCE(${parts.join(', ')})`;
      };
      const homeName = hasHomeUserId ? k.raw(`(SELECT ${displayExpr('u')} FROM users u WHERE u.id = g.home_user_id) as home`) : (hasHomeText ? k.raw("g.home as home") : k.raw("NULL as home"));
      const awayName = hasAwayUserId ? k.raw(`(SELECT ${displayExpr('u')} FROM users u WHERE u.id = g.away_user_id) as away`) : (hasAwayText ? k.raw("g.away as away") : k.raw("NULL as away"));
      const tsSelect = tsCol ? k.raw(`g.${tsCol} as kickoff_at`) : k.raw("NULL as kickoff_at");

      let q = k({ g: table })
        .leftJoin({ l: "leagues" }, "l.id", "g.league_id")
        .leftJoin({ c: "cities" }, "c.id", "l.city_id")
        .leftJoin({ s: "sports" }, "s.id", "l.sport_id")
        .select(
          "g.id",
          tsSelect,
          { leagueId: "g.league_id" },
          { league: "l.name" },
          k.raw("COALESCE(c.name, '') as city"),
          k.raw("COALESCE(s.name, '') as sport"),
          homeName,
          awayName,
          "g.home_score",
          "g.away_score"
        );

      if (hasHomeUserId || hasAwayUserId) {
        q = q.where(function () {
          if (hasHomeUserId) this.orWhere("g.home_user_id", userId);
          if (hasAwayUserId) this.orWhere("g.away_user_id", userId);
        });
      } else if (hasHomeText || hasAwayText) {
        q = q.join({ ul: "user_leagues" }, "ul.league_id", "g.league_id").where("ul.user_id", userId);
      } else {
        return res.json({ upcoming: [], completed: [] });
      }

      if (tsCol) q = q.orderBy(`g.${tsCol}`, "desc"); else q = q.orderBy("g.id", "desc");

      const rows = await q;
      const withTs = (rows || []).map(r => ({ ...r, ts: r.kickoff_at ? (Date.parse(r.kickoff_at) || 0) : 0 }));
      const completed = withTs.filter(r => (r.home_score != null && r.away_score != null)).sort((a, b) => (b.ts - a.ts));
      const upcoming = withTs.filter(r => (r.home_score == null && r.away_score == null)).sort((a, b) => (a.ts - b.ts));
      return res.json({ upcoming, completed });
    } catch (e) {
      return res.status(500).json({ error: "Datenbankfehler", details: e?.message || String(e) });
    }
  });

    // Start a direct chat intent between current user and target user (creates an empty chat page link)
    router.post('/users/:id/start-chat', (req, res) => {
      const targetId = Number(req.params.id);
      if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Ungültige ID' });
      // For now, we just respond with a placeholder URL for a future direct chat page
      return res.json({ ok: true, url: `/chat/user/${targetId}` });
    });

  return router;
};
