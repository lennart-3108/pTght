const express = require("express");

module.exports = function citiesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  router.get("/cities/list", (req, res) => {
    console.log('[citiesRoutes /cities/list] Request received, query:', req.query);
    const { country_id, state_id, type } = req.query;
    // Only return cities (not districts) - districts are loaded separately
    let sql = "SELECT id, name, state_id AS stateId, country_id AS countryId, type, parent_city_id AS parentCityId, latitude, longitude FROM cities WHERE type = 'city'";
    const params = [];
    
    if (country_id) {
      sql += " AND country_id = ?";
      params.push(Number(country_id));
    }
    if (state_id) {
      sql += " AND state_id = ?";
      params.push(Number(state_id));
    }
    // Note: type parameter ignored since we always filter to cities only
    
    sql += " ORDER BY name";
    
    console.log('[citiesRoutes] SQL:', sql);
    console.log('[citiesRoutes] Params:', params);
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[citiesRoutes] DB Error:', err);
        return res.status(500).json({ error: "Datenbankfehler" });
      }
      console.log(`[citiesRoutes] Returning ${rows ? rows.length : 0} cities`);
      return res.json(rows);
    });
  });

  router.get("/cities/:id", (req, res) => {
    const cityId = Number(req.params.id);
    db.get("SELECT id, name, type, state_id AS stateId, country_id AS countryId, parent_city_id AS parentCityId, latitude, longitude FROM cities WHERE id = ?", [cityId], (e1, city) => {
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

  // Get districts (Stadtteile) for a city
  router.get("/cities/:id/districts", (req, res) => {
    const cityId = Number(req.params.id);
    const sql = "SELECT id, name, type, parent_city_id AS parentCityId, parent_city_id AS cityId, latitude, longitude FROM cities WHERE parent_city_id = ? AND type = 'district' ORDER BY name";
    db.all(sql, [cityId], (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler" }) : res.json(rows)
    );
  });

  return router;
};
