const express = require("express");

module.exports = function sportsRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // Liste aller Sportarten
  router.get("/list", (_req, res) => {
    db.all(`SELECT id, name FROM sports ORDER BY name`, [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      res.json(rows || []);
    });
  });

  // Hierarchische Liste aller Sportarten (Parent-Child Struktur)
  router.get("/hierarchy", (_req, res) => {
    const sql = `
      SELECT 
        s.id, 
        s.name, 
        s.parent_id,
        s.category,
        p.name as parent_name
      FROM sports s
      LEFT JOIN sports p ON s.parent_id = p.id
      ORDER BY 
        CASE WHEN s.parent_id IS NULL THEN s.name ELSE p.name END,
        s.parent_id IS NULL DESC,
        s.name
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      
      // Organisiere Daten in hierarchische Struktur
      const parentSports = {};
      const childSports = {};
      
      rows.forEach(row => {
        if (row.parent_id === null) {
          parentSports[row.id] = {
            id: row.id,
            name: row.name,
            children: []
          };
        } else {
          if (!childSports[row.parent_id]) {
            childSports[row.parent_id] = [];
          }
          childSports[row.parent_id].push({
            id: row.id,
            name: row.name,
            category: row.category,
            parent_id: row.parent_id,
            parent_name: row.parent_name
          });
        }
      });
      
      // Füge Children zu Parents hinzu
      Object.keys(childSports).forEach(parentId => {
        if (parentSports[parentId]) {
          parentSports[parentId].children = childSports[parentId];
        }
      });
      
      res.json(Object.values(parentSports));
    });
  });

  // Alle Child-Sportarten einer Parent-Sportart
  router.get("/:id/children", (req, res) => {
    const parentId = Number(req.params.id);
    if (!Number.isInteger(parentId)) {
      return res.status(400).json({ error: "Ungültige ID" });
    }
    
    const sql = `
      SELECT id, name, category, parent_id
      FROM sports 
      WHERE parent_id = ?
      ORDER BY name
    `;
    db.all(sql, [parentId], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      res.json(rows || []);
    });
  });

  // Einzelne Sportart
  router.get("/:id", (req, res) => {
    const id = Number(req.params.id);
    db.get(`SELECT id, name FROM sports WHERE id = ?`, [id], (err, row) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      if (!row) return res.status(404).json({ error: "Nicht gefunden" });
      res.json(row);
    });
  });

  // Namen aller Sportarten (ohne IDs)
  router.get("/names", (_req, res) => {
    db.all("SELECT name FROM sports ORDER BY name", (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler" }) : res.json((rows || []).map(r => r.name))
    );
  });

  // Ligen einer Sportart
  router.get("/:id/leagues", (req, res) => {
    const sportId = Number(req.params.id);
    if (!Number.isInteger(sportId)) {
      return res.status(400).json({ error: "Ungültige ID" });
    }
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
