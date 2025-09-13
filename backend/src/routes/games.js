const express = require("express");

module.exports = function gamesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  router.get("/games/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Ungültige ID" });

    const sql = `
      SELECT
        g.id,
        g.league_id AS leagueId,
        g.kickoff_at,
        g.home, g.away,
        g.home_score, g.away_score,
        l.name AS league,
        c.id AS cityId, c.name AS city,
        s.id AS sportId, s.name AS sport
      FROM games g
      JOIN leagues l ON l.id = g.league_id
      JOIN cities c ON c.id = l.city_id
      JOIN sports s ON s.id = l.sport_id
      WHERE g.id = ?
    `;
    db.get(sql, [id], (err, row) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      if (!row) return res.status(404).json({ error: "Spiel nicht gefunden" });
      res.json(row);
    });
  });

  return router;
};
