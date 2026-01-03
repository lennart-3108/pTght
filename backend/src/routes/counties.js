const express = require("express");

module.exports = function countiesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // GET /counties/list - List all counties/states, optionally filtered by country
  router.get("/counties/list", (req, res) => {
    const { country_id } = req.query;
    let sql = "SELECT id, name, code, country_id AS countryId, latitude, longitude FROM counties WHERE 1=1";
    const params = [];
    
    if (country_id) {
      sql += " AND country_id = ?";
      params.push(Number(country_id));
    }
    
    sql += " ORDER BY name";
    
    db.all(sql, params, (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler" }) : res.json(rows)
    );
  });

  // Alias: support /states/list for older frontend clients
  router.get("/states/list", (req, res) => {
    const { country_id } = req.query;
    let sql = "SELECT id, name, code, country_id AS countryId, latitude, longitude FROM counties WHERE 1=1";
    const params = [];
    if (country_id) {
      sql += " AND country_id = ?";
      params.push(Number(country_id));
    }
    sql += " ORDER BY name";
    db.all(sql, params, (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler" }) : res.json(rows)
    );
  });

  // GET /counties/:id - Get single county by ID
  router.get("/counties/:id", (req, res) => {
    const countyId = Number(req.params.id);
    const sql = "SELECT id, name, code, country_id AS countryId, latitude, longitude FROM counties WHERE id = ?";
    db.get(sql, [countyId], (err, county) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      if (!county) return res.status(404).json({ error: "Bundesland nicht gefunden" });
      res.json(county);
    });
  });

  // Alias: support /states/:id
  router.get("/states/:id", (req, res) => {
    const countyId = Number(req.params.id);
    const sql = "SELECT id, name, code, country_id AS countryId, latitude, longitude FROM counties WHERE id = ?";
    db.get(sql, [countyId], (err, county) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      if (!county) return res.status(404).json({ error: "Bundesland nicht gefunden" });
      res.json(county);
    });
  });

  return router;
};
