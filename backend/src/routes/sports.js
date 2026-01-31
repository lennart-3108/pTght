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
      WHERE s.published = 1
      ORDER BY s.sort_order, s.name
    `, [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      res.json(rows || []);
    });
  });

  // Kategorien mit ihren Sportarten (hierarchisch)
  router.get("/categories", (_req, res) => {
    // Get all sports with their category info
    db.all(`
      SELECT 
        s.id, 
        s.name,
        s.type,
        s.category,
        s.parent_id,
        s.team_size,
        s.sport_type,
        s.category_id,
        sc.id as cat_id,
        sc.name as cat_name,
        sc.slug as cat_slug,
        sc.icon as cat_icon,
        sc.sort_order as cat_sort
      FROM sports s
      LEFT JOIN sport_categories sc ON s.category_id = sc.id
      WHERE s.published = 1
      ORDER BY sc.sort_order, s.name
    `, [], (err, sports) => {
      if (err) {
        console.error('[sports/categories] Database error:', err);
        return res.status(500).json({ error: "Datenbankfehler" });
      }
      
      if (!sports || !sports.length) {
        console.log('[sports/categories] No sports found in database');
        return res.json([]);
      }
      
      // Group by sport_categories
      const categoryMap = {};
      
      sports.forEach(sport => {
        // Use category from sport_categories table if available
        const catId = sport.cat_id || 'uncategorized';
        const catName = sport.cat_name || 'Sonstige';
        const catSlug = sport.cat_slug || 'other';
        const catIcon = sport.cat_icon || '🏆';
        const catSort = sport.cat_sort || 99;
        
        if (!categoryMap[catId]) {
          categoryMap[catId] = {
            id: catId,
            name: catName,
            slug: catSlug,
            icon: catIcon,
            sort_order: catSort,
            sports: []
          };
        }
        
        // Only add main sports (not variants with parent_id)
        if (!sport.parent_id) {
          // Find variants for this sport
          const variants = sports.filter(v => v.parent_id === sport.id);
          
          categoryMap[catId].sports.push({
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
      
      // Sort by sort_order and convert to array
      const result = Object.values(categoryMap).sort((a, b) => a.sort_order - b.sort_order);
      console.log(`[sports/categories] Returning ${result.length} categories with ${sports.length} total sports`);
      res.json(result);
    });
  });



  // Einzelne Sportart
  router.get("/:id", (req, res) => {
    const id = Number(req.params.id);
    db.get(`SELECT id, name FROM sports WHERE id = ? AND published = 1`, [id], (err, row) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      if (!row) return res.status(404).json({ error: "Nicht gefunden" });
      res.json(row);
    });
  });

  // Namen aller Sportarten (ohne IDs)
  router.get("/names", (_req, res) => {
    db.all("SELECT name FROM sports WHERE published = 1 ORDER BY name", (err, rows) =>
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
