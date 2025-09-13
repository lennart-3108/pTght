const express = require("express");

module.exports = function sportsRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  router.get("/sports", (_req, res) => {
    db.all("SELECT name FROM sports ORDER BY name", (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler" }) : res.json(rows.map(r => r.name))
    );
  });

  router.get("/sports/list", (_req, res) => {
    db.all("SELECT id, name FROM sports ORDER BY name", (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler" }) : res.json(rows)
    );
  });

  router.get("/sports/:id", (req, res) => {
    const id = Number(req.params.id);
    db.get("SELECT * FROM sports WHERE id = ?", [id], (err, row) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      if (!row) return res.status(404).json({ error: "Sportart nicht gefunden" });
      res.json(row);
    });
  });

  router.get("/sports/:id/leagues", (req, res) => {
    const sportId = Number(req.params.id);
    const sql = `
      SELECT l.id, l.name,
             c.id AS cityId, c.name AS city,
             s.id AS sportId, s.name AS sport
      FROM leagues l
      JOIN cities c ON l.city_id = c.id
      JOIN sports s ON l.sport_id = s.id
      WHERE l.sport_id = ?
      ORDER BY c.name, l.name
    `;
    db.all(sql, [sportId], (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler", details: err.message }) : res.json(rows || [])
    );
  });

  return router;
};
