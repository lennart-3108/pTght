const express = require("express");

module.exports = function districtsRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // Get all districts
  router.get("/list", (_req, res) => {
    db.all(
      `SELECT 
        d.id, 
        d.name, 
        d.type,
        d.population,
        d.city_id as cityId,
        c.name as cityName
      FROM districts d
      LEFT JOIN cities c ON d.city_id = c.id
      ORDER BY c.name, d.name`,
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler" });
        res.json(rows || []);
      }
    );
  });

  // Get districts by city
  router.get("/by-city/:cityId", (req, res) => {
    const cityId = Number(req.params.cityId);
    if (!Number.isInteger(cityId)) {
      return res.status(400).json({ error: "Ungültige City ID" });
    }
    
    db.all(
      `SELECT 
        id, 
        name, 
        type,
        population,
        city_id as cityId
      FROM districts
      WHERE city_id = ?
      ORDER BY name`,
      [cityId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler" });
        res.json(rows || []);
      }
    );
  });

  // Get single district
  router.get("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Ungültige ID" });
    }
    
    db.get(
      `SELECT 
        d.id, 
        d.name, 
        d.type,
        d.population,
        d.description,
        d.city_id as cityId,
        c.name as cityName
      FROM districts d
      LEFT JOIN cities c ON d.city_id = c.id
      WHERE d.id = ?`,
      [id],
      (err, row) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler" });
        if (!row) return res.status(404).json({ error: "Nicht gefunden" });
        res.json(row);
      }
    );
  });

  return router;
};
