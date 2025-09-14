const express = require("express");
const { createMiddleware } = require("./middleware");

module.exports = function meRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;
  const { requireAuth, ensureTables } = createMiddleware(ctx);

  // Profil des eingeloggten Nutzers
  router.get("/", requireAuth, (req, res) => {
    const userId = req.user.id;
    const sql = `
      SELECT id, firstname, lastname, birthday, email,
             is_confirmed AS isConfirmed, is_admin AS isAdmin
      FROM users WHERE id = ? LIMIT 1
    `;
    db.get(sql, [userId], (err, row) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      if (!row) return res.status(404).json({ error: "User nicht gefunden" });
      res.json(row);
    });
  });

  // Eigene Ligen
  router.get("/leagues", requireAuth, async (req, res) => {
    await ensureTables();
    const sql = `
      SELECT l.id, l.name,
             c.id AS cityId, c.name AS city,
             s.id AS sportId, s.name AS sport,
             l.publicState
      FROM user_leagues ul
      JOIN leagues l ON l.id = ul.league_id
      JOIN cities  c ON l.city_id = c.id
      JOIN sports  s ON l.sport_id = s.id
      WHERE ul.user_id = ?
      ORDER BY c.name, l.name
    `;
    db.all(sql, [req.user.id], (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler", details: err.message }) : res.json(rows || [])
    );
  });

  // Eigene Spiele (über Ligen-Mitgliedschaft) – liefert upcoming/completed und League-Infos
  router.get("/games", requireAuth, async (req, res) => {
    await ensureTables();
    const sql = `
      SELECT g.id, g.kickoff_at, g.home, g.away, g.home_score, g.away_score,
             l.id AS leagueId, l.name AS league,
             c.name AS city, s.name AS sport
      FROM games g
      JOIN leagues l ON g.league_id = l.id
      JOIN cities  c ON l.city_id = c.id
      JOIN sports  s ON l.sport_id = s.id
      WHERE g.league_id IN (SELECT league_id FROM user_leagues WHERE user_id = ?)
      ORDER BY g.kickoff_at ASC
    `;
    db.all(sql, [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler", details: err.message });
      const now = Date.now();
      const all = (rows || []).map(r => ({ ...r, ts: Date.parse(r.kickoff_at) || 0 }));
      const upcoming = all.filter(r => r.ts > now || (r.home_score == null && r.away_score == null));
      const completed = all.filter(r => r.ts <= now || (r.home_score != null || r.away_score != null));
      res.json({ upcoming, completed });
    });
  });

  // Entfernte Duplikate: zuvor fälschlich "/me", "/me/leagues", "/me/games" sowie zweite "/games"-Implementierung
  return router;
};
