const express = require("express");
const { createMiddleware } = require("./middleware");

module.exports = function meRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;
  const { requireAuth, ensureTables } = createMiddleware(ctx);

  router.get("/me", requireAuth, (req, res) => {
    db.get(
      `SELECT id, firstname, lastname, birthday, email, is_admin, is_confirmed
       FROM users WHERE id = ?`,
      [req.user.id],
      (err, user) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler" });
        if (!user) return res.status(404).json({ error: "User nicht gefunden" });
        db.all(
          `SELECT sports.name FROM user_sports
           JOIN sports ON user_sports.sport_id = sports.id
           WHERE user_sports.user_id = ?`,
          [req.user.id],
          (e2, sports) => {
            if (e2) return res.status(500).json({ error: "Fehler beim Laden der Sportarten" });
            res.json({ ...user, sports: sports.map(s => s.name) });
          }
        );
      }
    );
  });

  router.get("/me/leagues", requireAuth, async (req, res) => {
    await ensureTables();
    const sql = `
      SELECT l.id, l.name, c.name AS city, s.name AS sport, ul.joined_at
      FROM user_leagues ul
      JOIN leagues l ON ul.league_id = l.id
      JOIN cities c  ON l.city_id = c.id
      JOIN sports s  ON l.sport_id = s.id
      WHERE ul.user_id = ?
      ORDER BY c.name, l.name
    `;
    db.all(sql, [req.user.id], (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler", details: err.message }) : res.json(rows || [])
    );
  });

  router.get("/me/games", requireAuth, async (req, res) => {
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

  return router;
};
