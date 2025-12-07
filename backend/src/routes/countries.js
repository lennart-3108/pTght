const express = require("express");

module.exports = function countriesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // GET /countries/list - List all countries
  router.get("/countries/list", (req, res) => {
    const sql = "SELECT id, name, code, iso2, flag, phonecode, currency, latitude, longitude FROM countries ORDER BY name";
    db.all(sql, [], (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler" }) : res.json(rows)
    );
  });

  // GET /countries/:id - Get single country by ID
  router.get("/countries/:id", (req, res) => {
    const countryId = Number(req.params.id);
    const sql = "SELECT id, name, code, iso2, flag, phonecode, currency, latitude, longitude FROM countries WHERE id = ?";
    db.get(sql, [countryId], (err, country) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      if (!country) return res.status(404).json({ error: "Land nicht gefunden" });
      res.json(country);
    });
  });

  return router;
};
