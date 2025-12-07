const express = require("express");

module.exports = function sportsRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // Liste aller Sportarten mit Kategorie-Info
  router.get("/list", (_req, res) => {
    db.all(`
      SELECT 
        s.id, 
        s.name,
        s.category_id,
        s.parent_sport_id,
        s.variant_type,
        s.type,
        sc.name as category_name
      FROM sports s
      LEFT JOIN sport_categories sc ON s.category_id = sc.id
      ORDER BY s.sort_order, s.name
    `, [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      res.json(rows || []);
    });
  });

  // Kategorien mit ihren Sportarten (hierarchisch)
  router.get("/categories", (_req, res) => {
    // Get all sports from sports table
    db.all(`
      SELECT 
        id, 
        name,
        type,
        category,
        parent_id,
        team_size,
        sport_type
      FROM sports
      ORDER BY name
    `, [], (err, sports) => {
      if (err) {
        console.error('[sports/categories] Database error:', err);
        return res.status(500).json({ error: "Datenbankfehler" });
      }
      
      if (!sports || !sports.length) {
        console.log('[sports/categories] No sports found in database');
        return res.json([]);
      }
      
      // Group by type (Single/Team) as categories
      const categoryMap = {};
      
      sports.forEach(sport => {
        const catKey = sport.type || 'Sonstige';
        if (!categoryMap[catKey]) {
          categoryMap[catKey] = {
            id: catKey,
            name: catKey === 'Single' ? 'Einzelsportarten' : catKey === 'Team' ? 'Teamsportarten' : catKey,
            slug: catKey.toLowerCase(),
            sports: []
          };
        }
        
        // Only add main sports (not variants with parent_id)
        if (!sport.parent_id) {
          // Find variants for this sport
          const variants = sports.filter(v => v.parent_id === sport.id);
          
          categoryMap[catKey].sports.push({
            id: sport.id,
            name: sport.name,
            type: sport.type,
            category: sport.category,
            team_size: sport.team_size,
            sport_type: sport.sport_type,
            variants: variants.map(v => ({
              id: v.id,
              name: v.name,
              type: v.type,
              category: v.category
            }))
          });
        }
      });
      
      const result = Object.values(categoryMap);
      console.log(`[sports/categories] Returning ${result.length} categories with ${sports.length} total sports`);
      res.json(result);
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
