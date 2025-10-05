const express = require("express");

module.exports = function usersRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  router.get("/users/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Ungültige ID" });

    db.get(
      `SELECT id, firstname, lastname, email FROM users WHERE id = ?`,
      [id],
      (err, user) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler" });
        if (!user) return res.status(404).json({ error: "Nutzer nicht gefunden" });

        db.all(
          `SELECT s.id, s.name
           FROM user_sports us
           JOIN sports s ON s.id = us.sport_id
           WHERE us.user_id = ?
           ORDER BY s.name`,
          [id],
          (e2, sports) => {
            if (e2) return res.status(500).json({ error: "Datenbankfehler" });
            res.json({ ...user, sports: sports || [] });
          }
        );
      }
    );
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
  router.get("/users/:id/games", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Ungültige ID" });

    // Ermittele verfügbare Tabelle
    db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('matches','games')`, [], (te, tabs) => {
      if (te) return res.status(500).json({ error: 'Datenbankfehler', details: te.message });
      const names = (tabs || []).map(r => (r.name || r.NAME)).filter(Boolean);
      const useMatches = names.includes('matches');
      const table = useMatches ? 'matches' : (names.includes('games') ? 'games' : null);
      if (!table) return res.json({ upcoming: [], completed: [] });

      // Lese Spalteninformationen
      db.all(`PRAGMA table_info(${table})`, [], (pe, cols) => {
        if (pe) return res.status(500).json({ error: 'Datenbankfehler', details: pe.message });
        const has = (n) => Array.isArray(cols) && cols.some(c => String(c.name || '').toLowerCase() === n);
        const hasKick = has('kickoff_at') || has('kickoff') || has('scheduled_at') || has('date') || has('datetime') || has('start_time');
        const tsCol = has('kickoff_at') ? 'kickoff_at'
          : has('kickoff') ? 'kickoff'
          : has('scheduled_at') ? 'scheduled_at'
          : has('date') ? 'date'
          : has('datetime') ? 'datetime'
          : has('start_time') ? 'start_time'
          : null;
        const hasHomeText = has('home');
        const hasAwayText = has('away');
        const hasHomeId = has('home_user_id');
        const hasAwayId = has('away_user_id');

        // Nutzer-Spalten bestimmen (für Namensanzeige)
        db.all(`PRAGMA table_info(users)`, [], (ue, userCols) => {
          if (ue) return res.status(500).json({ error: 'Datenbankfehler', details: ue.message });
          const uHas = (n) => Array.isArray(userCols) && userCols.some(c => String(c.name || '').toLowerCase() === n);
          const hasFirst = uHas('firstname');
          const hasLast = uHas('lastname');
          const hasName = uHas('name');
          const hasEmail = uHas('email');
          const fullNameExpr = (hasFirst || hasLast)
            ? "NULLIF(TRIM(COALESCE(u.firstname,'') || ' ' || COALESCE(u.lastname,'')), '')"
            : null;
          const displayExpr = (alias) => {
            const parts = [];
            if (fullNameExpr) parts.push(fullNameExpr.replace(/u\./g, `${alias}.`));
            if (hasName) parts.push(`${alias}.name`);
            if (hasEmail) parts.push(`${alias}.email`);
            if (!parts.length) parts.push("'User'");
            return `COALESCE(${parts.join(', ')})`;
          };
          const homeName = hasHomeId ? `(SELECT ${displayExpr('u')} FROM users u WHERE u.id = g.home_user_id)`
            : (hasHomeText ? 'g.home' : 'NULL');
          const awayName = hasAwayId ? `(SELECT ${displayExpr('u')} FROM users u WHERE u.id = g.away_user_id)`
            : (hasAwayText ? 'g.away' : 'NULL');
          const tsSelect = tsCol ? `g.${tsCol} AS kickoff_at` : `NULL AS kickoff_at`;

          const sql = `
            SELECT
              g.id,
              ${tsSelect},
              ${homeName} AS home,
              ${awayName} AS away,
              g.home_score, g.away_score,
              l.id AS leagueId, l.name AS league,
              c.name AS city,
              s.name AS sport
            FROM ${table} g
            JOIN leagues l ON l.id = g.league_id
            JOIN cities c ON c.id = l.city_id
            JOIN sports s ON s.id = l.sport_id
            WHERE g.league_id IN (SELECT league_id FROM user_leagues WHERE user_id = ?)
            ORDER BY ${tsCol ? `g.${tsCol} DESC` : 'g.id DESC'}
          `;

          db.all(sql, [id], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Datenbankfehler', details: err.message });
            const now = Date.now();
            const split = (rows || []).reduce((acc, r) => {
              const t = r.kickoff_at ? Date.parse(r.kickoff_at) : 0;
              const completed = r.home_score != null && r.away_score != null;
              if (completed || (t && t < now)) acc.completed.push(r);
              else acc.upcoming.push(r);
              return acc;
            }, { upcoming: [], completed: [] });
            return res.json(split);
          });
        });
      });
    });
  });

  return router;
};
