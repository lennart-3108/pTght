const express = require("express");
const { isAuthenticated } = require("../../middleware/auth");

module.exports = function usersRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  const dbAllAsync = (sql, params = []) => new Promise((resolve, reject) => {
    if (!db || typeof db.all !== 'function') return reject(new Error('DB_NOT_AVAILABLE'));
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

  const dbGetAsync = (sql, params = []) => new Promise((resolve, reject) => {
    if (!db || typeof db.get !== 'function') return reject(new Error('DB_NOT_AVAILABLE'));
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

  const dbRunAsync = (sql, params = []) => new Promise((resolve, reject) => {
    if (!db || typeof db.run !== 'function') return reject(new Error('DB_NOT_AVAILABLE'));
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

  let friendshipsEnsured = false;
  
  function getDb() {
    return (db && db.knex && db.knex.client) ? db.knex : (db && db.db ? db.db : null);
  }
  
  function getFrontendBase() {
    return process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:3000';
  }
  
  async function ensureFriendshipsTable() {
    if (friendshipsEnsured) return true;
    await dbRunAsync(
      `CREATE TABLE IF NOT EXISTS user_friendships (
        user_low INTEGER NOT NULL,
        user_high INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        initiator_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        responded_at TEXT,
        PRIMARY KEY (user_low, user_high)
      )`
    );
    await dbRunAsync(`CREATE INDEX IF NOT EXISTS idx_user_friendships_status ON user_friendships(status)`);
    friendshipsEnsured = true;
    return true;
  }

  const normalizePair = (a, b) => {
    const aNum = Number(a);
    const bNum = Number(b);
    return aNum <= bNum ? [aNum, bNum] : [bNum, aNum];
  };

  const buildDisplayName = (row) => {
    const parts = [row.firstname || "", row.lastname || ""].map(s => String(s || "").trim()).filter(Boolean);
    if (parts.length) return parts.join(" ");
    if (row.name && String(row.name).trim()) return String(row.name).trim();
    if (row.email && String(row.email).trim()) return String(row.email).trim();
    const id = row.id || row.user_id || row.friend_id;
    return id ? `User ${id}` : "Unbekannt";
  };

  const parseFavoriteSports = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string') return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (_) {}
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  };

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

  const handleGetUser = async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Ungültige ID" });

      const cols = await dbAllAsync(`PRAGMA table_info(users)`);
      // Select all columns to ensure profile fields are returned
      const user = await dbGetAsync(`SELECT * FROM users WHERE id = ?`, [id]);
      if (!user) return res.status(404).json({ error: "Nutzer nicht gefunden" });

      const avatar_url = Object.prototype.hasOwnProperty.call(user, 'avatar_url') ? (user.avatar_url || null) : null;
      const open_for_matches = Object.prototype.hasOwnProperty.call(user, 'open_for_matches') ? !!user.open_for_matches : null;
      const favorite_sports = Object.prototype.hasOwnProperty.call(user, 'favorite_sports') ? parseFavoriteSports(user.favorite_sports) : [];

      let sports = [];
      const userSportsTable = await dbGetAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_sports'`);
      if (userSportsTable && userSportsTable.name === 'user_sports') {
        sports = await dbAllAsync(
          `SELECT s.id, s.name
             FROM user_sports us
             JOIN sports s ON s.id = us.sport_id
             WHERE us.user_id = ?
             ORDER BY s.name`,
          [id]
        ).catch(() => []);
      } else {
        const hasUserLeagues = await dbGetAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name='user_leagues'`);
        if (hasUserLeagues && hasUserLeagues.name === 'user_leagues') {
          sports = await dbAllAsync(
            `SELECT DISTINCT s.id, s.name
               FROM user_leagues ul
               JOIN leagues l ON l.id = ul.league_id
               JOIN sports s ON s.id = l.sport_id
               WHERE ul.user_id = ?
               ORDER BY s.name`,
            [id]
          ).catch(() => []);
        }
      }

      const responseData = {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        avatar_url,
        open_for_matches,
        favorite_sports,
        sports: sports || [],
        birthday: Object.prototype.hasOwnProperty.call(user, 'birthday') ? user.birthday : null,
        city_id: Object.prototype.hasOwnProperty.call(user, 'city_id') ? user.city_id : null,
        district_id: Object.prototype.hasOwnProperty.call(user, 'district_id') ? user.district_id : null,
        gender: Object.prototype.hasOwnProperty.call(user, 'gender') ? user.gender : null
      };

      return res.json(responseData);
    } catch (e) {
      return res.status(500).json({ error: "Datenbankfehler", details: e?.message || String(e) });
    }
  };

  router.get("/users/:id", handleGetUser);
  // Legacy singular route used by older frontend builds
  router.get("/user/:id", handleGetUser);

  router.get("/users/:id/friends", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Ungültige ID" });
      await ensureFriendshipsTable().catch(() => {});
      const rows = await dbAllAsync(
        `SELECT
           CASE WHEN uf.user_low = ? THEN uf.user_high ELSE uf.user_low END AS friend_id,
           uf.status,
           uf.created_at,
           u.id,
           u.firstname,
           u.lastname,
           u.name,
           u.email,
           u.avatar_url
         FROM user_friendships uf
         JOIN users u ON u.id = CASE WHEN uf.user_low = ? THEN uf.user_high ELSE uf.user_low END
         WHERE (uf.user_low = ? OR uf.user_high = ?) AND uf.status = 'accepted'
         ORDER BY uf.created_at DESC
         LIMIT 50`,
        [id, id, id, id]
      ).catch(() => []);

      const list = (rows || []).map(row => ({
        id: row.friend_id,
        displayName: buildDisplayName(row),
        avatar_url: row.avatar_url || null,
        since: row.created_at || null
      }));
      return res.json(list);
    } catch (e) {
      return res.status(500).json({ error: "Datenbankfehler", details: e?.message || String(e) });
    }
  });

  router.get("/users/:id/mutual-friends", isAuthenticated, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      const viewerId = Number(req.user && req.user.id);
      if (!Number.isFinite(targetId)) return res.status(400).json({ error: "Ungültige ID" });
      if (!Number.isFinite(viewerId)) return res.status(401).json({ error: "AUTH_REQUIRED" });
      if (targetId === viewerId) return res.json([]);

      await ensureFriendshipsTable().catch(() => {});

      const viewerFriends = await dbAllAsync(
        `SELECT CASE WHEN user_low = ? THEN user_high ELSE user_low END AS friend_id
         FROM user_friendships
         WHERE (user_low = ? OR user_high = ?) AND status = 'accepted'`,
        [viewerId, viewerId, viewerId]
      ).catch(() => []);
      const targetFriends = await dbAllAsync(
        `SELECT CASE WHEN user_low = ? THEN user_high ELSE user_low END AS friend_id
         FROM user_friendships
         WHERE (user_low = ? OR user_high = ?) AND status = 'accepted'`,
        [targetId, targetId, targetId]
      ).catch(() => []);

      const viewerSet = new Set((viewerFriends || []).map(r => Number(r.friend_id)).filter(Number.isFinite));
      const sharedIds = Array.from(new Set((targetFriends || []).map(r => Number(r.friend_id)).filter(id => viewerSet.has(id)))).slice(0, 12);
      if (!sharedIds.length) return res.json([]);

      const placeholders = sharedIds.map(() => '?').join(', ');
      const rows = await dbAllAsync(
        `SELECT id, firstname, lastname, name, email, avatar_url
         FROM users
         WHERE id IN (${placeholders})`,
        sharedIds
      ).catch(() => []);

      const ordered = sharedIds
        .map(id => {
          const row = (rows || []).find(r => Number(r.id) === Number(id));
          if (!row) return null;
          return {
            id: row.id,
            displayName: buildDisplayName(row),
            avatar_url: row.avatar_url || null
          };
        })
        .filter(Boolean);

      return res.json(ordered);
    } catch (e) {
      return res.status(500).json({ error: "Datenbankfehler", details: e?.message || String(e) });
    }
  });

  router.get("/users/:id/friendship-status", isAuthenticated, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      const viewerId = Number(req.user && req.user.id);
      if (!Number.isFinite(targetId)) return res.status(400).json({ error: "Ungültige ID" });
      if (!Number.isFinite(viewerId)) return res.status(401).json({ error: "AUTH_REQUIRED" });
      if (targetId === viewerId) return res.json({ status: "self" });

      await ensureFriendshipsTable().catch(() => {});
      const [low, high] = normalizePair(viewerId, targetId);
      const row = await dbGetAsync(`SELECT * FROM user_friendships WHERE user_low = ? AND user_high = ?`, [low, high]).catch(() => null);
      if (!row) return res.json({ status: "none" });
      const pendingDirection = row.status === 'pending' ? (row.initiator_id === viewerId ? 'outgoing' : 'incoming') : null;
      return res.json({
        status: row.status,
        initiatorId: row.initiator_id,
        created_at: row.created_at || null,
        responded_at: row.responded_at || null,
        pendingDirection
      });
    } catch (e) {
      return res.status(500).json({ error: "Datenbankfehler", details: e?.message || String(e) });
    }
  });

  router.post("/users/:id/friendships", isAuthenticated, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      const viewerId = Number(req.user && req.user.id);
      if (!Number.isFinite(targetId)) return res.status(400).json({ error: "Ungültige ID" });
      if (!Number.isFinite(viewerId)) return res.status(401).json({ error: "AUTH_REQUIRED" });
      if (targetId === viewerId) return res.status(400).json({ error: "SELF_FRIEND" });

      await ensureFriendshipsTable();
      const [low, high] = normalizePair(viewerId, targetId);
      const now = new Date().toISOString();
      const existing = await dbGetAsync(`SELECT * FROM user_friendships WHERE user_low = ? AND user_high = ?`, [low, high]).catch(() => null);

      if (!existing) {
        await dbRunAsync(
          `INSERT INTO user_friendships (user_low, user_high, status, initiator_id, created_at)
           VALUES (?, ?, 'pending', ?, ?)`,
          [low, high, viewerId, now]
        );
        
        // Send notification to target user
        try {
          const hasNotifications = await getDb().schema.hasTable('notifications').catch(() => false);
          if (hasNotifications) {
            const viewer = await dbGetAsync('SELECT firstname, lastname, username FROM users WHERE id = ?', [viewerId]);
            const viewerName = [viewer?.firstname, viewer?.lastname].filter(Boolean).join(' ') || viewer?.username || `User ${viewerId}`;
            
            await getDb()('notifications').insert({
              user_id: targetId,
              from_user_id: viewerId,
              type: 'friend_request',
              title: 'Neue Freundschaftsanfrage',
              message: `${viewerName} möchte mit dir befreundet sein.`,
              created_at: now
            });
          }
          
          // Send email notification
          const targetUser = await dbGetAsync('SELECT email, firstname FROM users WHERE id = ?', [targetId]);
          if (targetUser?.email) {
            const { renderEmailTemplate } = require('../emailTemplate');
            const viewer = await dbGetAsync('SELECT firstname, lastname, username FROM users WHERE id = ?', [viewerId]);
            const viewerName = [viewer?.firstname, viewer?.lastname].filter(Boolean).join(' ') || viewer?.username || `User ${viewerId}`;
            
            const emailHtml = renderEmailTemplate({
              title: 'Neue Freundschaftsanfrage',
              preheader: `${viewerName} möchte mit dir befreundet sein`,
              greeting: targetUser.firstname || 'Hallo',
              body: `
                <p>${viewerName} möchte mit dir befreundet sein.</p>
                <p>Melde dich an, um die Anfrage anzunehmen oder abzulehnen.</p>
              `,
              ctaText: 'Anfrage ansehen',
              ctaUrl: `${getFrontendBase()}/user/${viewerId}`,
              footerText: 'Diese Email wurde gesendet, weil jemand eine Freundschaftsanfrage an dich gesendet hat.'
            });
            
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
              host: process.env.MAILER_HOST || 'localhost',
              port: process.env.MAILER_PORT || 1025,
              secure: false,
              tls: { rejectUnauthorized: false }
            });
            
            await transporter.sendMail({
              from: process.env.MAILER_FROM || 'noreply@matchleague.com',
              to: targetUser.email,
              subject: 'Neue Freundschaftsanfrage bei MatchLeague',
              html: emailHtml
            }).catch(err => console.error('[Friendship] Email send failed:', err));
          }
        } catch (notifErr) {
          console.error('[Friendship] Notification failed:', notifErr);
        }
        
        return res.status(201).json({ status: 'pending', pendingDirection: 'outgoing', message: 'Freundschaftsanfrage gesendet.' });
      }

      if (existing.status === 'accepted') {
        return res.json({ status: 'accepted', pendingDirection: null, message: 'Ihr seid bereits befreundet.' });
      }

      if (existing.status === 'pending') {
        if (existing.initiator_id === viewerId) {
          return res.json({ status: 'pending', pendingDirection: 'outgoing', message: 'Freundschaftsanfrage bereits gesendet.' });
        }
        await dbRunAsync(
          `UPDATE user_friendships
             SET status = 'accepted', responded_at = ?
             WHERE user_low = ? AND user_high = ?`,
          [now, low, high]
        );
        return res.json({ status: 'accepted', pendingDirection: null, message: 'Freundschaftsanfrage angenommen.' });
      }

      // For any other status (declined/blocked), reset to pending with new initiator
      await dbRunAsync(
        `UPDATE user_friendships
           SET status = 'pending', initiator_id = ?, created_at = ?, responded_at = NULL
           WHERE user_low = ? AND user_high = ?`,
        [viewerId, now, low, high]
      );
      return res.json({ status: 'pending', pendingDirection: 'outgoing', message: 'Freundschaftsanfrage erneut gesendet.' });
    } catch (e) {
      return res.status(500).json({ error: "Datenbankfehler", details: e?.message || String(e) });
    }
  });

  router.delete("/users/:id/friendships", isAuthenticated, async (req, res) => {
    try {
      const targetId = Number(req.params.id);
      const viewerId = Number(req.user && req.user.id);
      if (!Number.isFinite(targetId)) return res.status(400).json({ error: "Ungültige ID" });
      if (!Number.isFinite(viewerId)) return res.status(401).json({ error: "AUTH_REQUIRED" });
      if (targetId === viewerId) return res.status(400).json({ error: "SELF_FRIEND" });

      await ensureFriendshipsTable();
      const [low, high] = normalizePair(viewerId, targetId);
      const existing = await dbGetAsync(`SELECT * FROM user_friendships WHERE user_low = ? AND user_high = ?`, [low, high]).catch(() => null);
      if (!existing) return res.status(404).json({ error: "NOT_FRIENDS" });
      await dbRunAsync(`DELETE FROM user_friendships WHERE user_low = ? AND user_high = ?`, [low, high]);
      return res.json({ status: 'removed' });
    } catch (e) {
      return res.status(500).json({ error: "Datenbankfehler", details: e?.message || String(e) });
    }
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
        // Build public URL
        // Prefer explicit env BACKEND_PUBLIC_URL (e.g., https://dev.matchleague.org/api)
        // Otherwise derive from the incoming request host (works for local dev: http://localhost:5002)
        const rel = `/uploads/avatars/${userId}.${ext}`;
        let publicUrl = rel;
        const envBase = process.env.BACKEND_PUBLIC_URL && String(process.env.BACKEND_PUBLIC_URL).trim();
        if (envBase) {
          publicUrl = `${envBase.replace(/\/$/, '')}${rel}`;
        } else {
          try {
            const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http');
            const host = req.get && req.get('host');
            if (host) publicUrl = `${proto}://${host}${rel}`;
          } catch (_) {}
        }
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

      const selectColumns = [
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
      ];

      if (hasHomeUserId) selectColumns.push(k.raw("g.home_user_id as home_user_id"));
      if (hasAwayUserId) selectColumns.push(k.raw("g.away_user_id as away_user_id"));

      let q = k({ g: table })
        .leftJoin({ l: "leagues" }, "l.id", "g.league_id")
        .leftJoin({ c: "cities" }, "c.id", "l.city_id")
        .leftJoin({ s: "sports" }, "s.id", "l.sport_id")
        .select(selectColumns);

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

  // Avatar likes and comments
  let avatarTablesEnsured = false;
  async function ensureAvatarTables() {
    if (avatarTablesEnsured) return true;
    await dbRunAsync(
      `CREATE TABLE IF NOT EXISTS avatar_likes (
        user_id INTEGER NOT NULL,
        liker_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, liker_id)
      )`
    );
    await dbRunAsync(
      `CREATE TABLE IF NOT EXISTS avatar_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        commenter_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    );
    avatarTablesEnsured = true;
    return true;
  }

  // GET avatar likes count and whether current user liked
  router.get('/users/:id/avatar/likes', isAuthenticated, async (req, res) => {
    try {
      await ensureAvatarTables();
      const userId = Number(req.params.id);
      const currentUserId = req.user?.id;
      
      const count = await dbGetAsync(
        'SELECT COUNT(*) as count FROM avatar_likes WHERE user_id = ?',
        [userId]
      );
      
      let userLiked = false;
      if (currentUserId) {
        const like = await dbGetAsync(
          'SELECT 1 FROM avatar_likes WHERE user_id = ? AND liker_id = ?',
          [userId, currentUserId]
        );
        userLiked = !!like;
      }
      
      res.json({ count: count?.count || 0, userLiked });
    } catch (err) {
      console.error('Error fetching avatar likes:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // POST like avatar
  router.post('/users/:id/avatar/like', isAuthenticated, async (req, res) => {
    try {
      await ensureAvatarTables();
      const userId = Number(req.params.id);
      const likerId = req.user?.id;
      
      if (!likerId) return res.status(401).json({ error: 'Nicht autorisiert' });
      
      await dbRunAsync(
        'INSERT OR IGNORE INTO avatar_likes (user_id, liker_id) VALUES (?, ?)',
        [userId, likerId]
      );
      
      res.json({ ok: true });
    } catch (err) {
      console.error('Error liking avatar:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // DELETE unlike avatar
  router.delete('/users/:id/avatar/like', isAuthenticated, async (req, res) => {
    try {
      await ensureAvatarTables();
      const userId = Number(req.params.id);
      const likerId = req.user?.id;
      
      if (!likerId) return res.status(401).json({ error: 'Nicht autorisiert' });
      
      await dbRunAsync(
        'DELETE FROM avatar_likes WHERE user_id = ? AND liker_id = ?',
        [userId, likerId]
      );
      
      res.json({ ok: true });
    } catch (err) {
      console.error('Error unliking avatar:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // GET avatar comments
  router.get('/users/:id/avatar/comments', async (req, res) => {
    try {
      await ensureAvatarTables();
      const userId = Number(req.params.id);
      
      const comments = await dbAllAsync(
        `SELECT 
          ac.id, 
          ac.text, 
          ac.created_at,
          u.id as commenter_id,
          u.firstname,
          u.lastname,
          u.name,
          u.email
        FROM avatar_comments ac
        LEFT JOIN users u ON u.id = ac.commenter_id
        WHERE ac.user_id = ?
        ORDER BY ac.created_at DESC`,
        [userId]
      );
      
      const formatted = (comments || []).map(c => ({
        id: c.id,
        text: c.text,
        username: buildDisplayName(c),
        created_at: c.created_at
      }));
      
      res.json(formatted);
    } catch (err) {
      console.error('Error fetching avatar comments:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // POST avatar comment
  router.post('/users/:id/avatar/comment', isAuthenticated, async (req, res) => {
    try {
      await ensureAvatarTables();
      const userId = Number(req.params.id);
      const commenterId = req.user?.id;
      const { text } = req.body;
      
      if (!commenterId) return res.status(401).json({ error: 'Nicht autorisiert' });
      if (!text || !text.trim()) return res.status(400).json({ error: 'Text erforderlich' });
      
      const result = await dbRunAsync(
        'INSERT INTO avatar_comments (user_id, commenter_id, text) VALUES (?, ?, ?)',
        [userId, commenterId, text.trim()]
      );
      
      const commenter = await dbGetAsync('SELECT * FROM users WHERE id = ?', [commenterId]);
      
      res.json({
        id: result.lastID,
        text: text.trim(),
        username: buildDisplayName(commenter || {}),
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error posting avatar comment:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};
