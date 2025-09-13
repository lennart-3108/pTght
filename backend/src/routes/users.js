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

  // Ligen eines Users
  router.get("/users/:id/leagues", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Ungültige ID" });

    const sql = `
      SELECT
        l.id,
        l.name,
        c.id AS cityId, c.name AS city,
        s.id AS sportId, s.name AS sport,
        lm.joined_at
      FROM league_members lm
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

  // Spiele eines Users (über seine Ligen)
  router.get("/users/:id/games", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Ungültige ID" });

    const sql = `
      SELECT
        g.id,
        g.kickoff_at,
        g.home, g.away,
        g.home_score, g.away_score,
        l.id AS leagueId, l.name AS league,
        c.name AS city,
        s.name AS sport
      FROM games g
      JOIN leagues l ON l.id = g.league_id
      JOIN cities c ON c.id = l.city_id
      JOIN sports s ON s.id = l.sport_id
      WHERE g.league_id IN (SELECT league_id FROM league_members WHERE user_id = ?)
      ORDER BY g.kickoff_at DESC
    `;
    db.all(sql, [id], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler", details: err.message });
      const now = Date.now();
      const split = (rows || []).reduce(
        (acc, r) => {
          const t = new Date(r.kickoff_at).getTime();
          const completed = r.home_score != null && r.away_score != null;
          if (completed || t < now) acc.completed.push(r);
          else acc.upcoming.push(r);
          return acc;
        },
        { upcoming: [], completed: [] }
      );
      res.json(split);
    });
  });

  return router;
};
