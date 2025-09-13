const express = require("express");

module.exports = function citiesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  router.get("/cities/list", (_req, res) => {
    db.all("SELECT id, name FROM cities ORDER BY name", (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler" }) : res.json(rows)
    );
  });

  router.get("/cities/:id", (req, res) => {
    const cityId = Number(req.params.id);
    db.get("SELECT id, name FROM cities WHERE id = ?", [cityId], (e1, city) => {
      if (e1) return res.status(500).json({ error: "Datenbankfehler" });
      if (!city) return res.status(404).json({ error: "Stadt nicht gefunden" });

      const sql = `
        SELECT l.id, l.name,
               s.id AS sportId, s.name AS sport
        FROM leagues l
        JOIN sports s ON l.sport_id = s.id
        WHERE l.city_id = ?
        ORDER BY l.name
      `;
      db.all(sql, [cityId], (e2, leagues) => {
        if (e2) return res.status(500).json({ error: "Datenbankfehler" });
        res.json({ city, leagues });
      });
    });
  });

  return router;
};
