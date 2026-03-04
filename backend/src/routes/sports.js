const express = require("express");

function normalizeHost(req) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = (forwardedHost || req.headers.host || req.hostname || '').split(',')[0].trim();
  return host.split(':')[0].toLowerCase();
}

function isTestHost(req) {
  return normalizeHost(req) === 'test.matchleague.org';
}

function isTennisSinglesOrDoubles(name) {
  const lowerName = String(name || '').toLowerCase();
  if (!lowerName.includes('tennis')) return false;
  if (lowerName.includes('mixed')) return false;
  return (
    lowerName.includes('einzel') ||
    lowerName.includes('single') ||
    lowerName.includes('doppel') ||
    lowerName.includes('double')
  );
}

function isRacketSport(row) {
  const lowerName = String(row?.name || '').toLowerCase();
  const lowerCategory = String(row?.category_name || row?.cat_name || '').toLowerCase();
  const lowerCategorySlug = String(row?.category_slug || row?.cat_slug || '').toLowerCase();

  const isRacketCategory =
    lowerCategory.includes('schläger') ||
    lowerCategory.includes('schlaeger') ||
    lowerCategory.includes('racket') ||
    lowerCategory.includes('racquet') ||
    lowerCategorySlug.includes('racket') ||
    lowerCategorySlug.includes('racquet') ||
    lowerCategorySlug.includes('schlaeger');

  const isKnownRacketByName =
    lowerName.includes('tennis') ||
    lowerName.includes('badminton') ||
    lowerName.includes('tischtennis') ||
    lowerName.includes('table tennis') ||
    lowerName.includes('padel') ||
    lowerName.includes('squash') ||
    lowerName.includes('pickleball') ||
    lowerName.includes('racquetball');

  return isRacketCategory || isKnownRacketByName;
}

function filterSportsForTest(rows) {
  return (rows || []).filter((row) => {
    if (!isRacketSport(row)) return false;
    const lowerName = String(row?.name || '').toLowerCase();
    if (!lowerName.includes('tennis')) return true;
    return isTennisSinglesOrDoubles(row?.name);
  });
}

module.exports = function sportsRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // Liste aller Sportarten mit Kategorie-Info
  router.get("/list", (req, res) => {
    db.all(`
      SELECT 
        s.id, 
        s.name,
        s.name_en,
        s.category_id,
        s.parent_sport_id,
        s.variant_type,
        s.type,
        sc.name as category_name,
        sc.name_en as category_name_en
      FROM sports s
      LEFT JOIN sport_categories sc ON s.category_id = sc.id
      WHERE s.published = 1
      ORDER BY s.sort_order, s.name
    `, [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      const resultRows = isTestHost(req) ? filterSportsForTest(rows) : (rows || []);
      res.json(resultRows);
    });
  });

  // Kategorien mit ihren Sportarten (hierarchisch)
  router.get("/categories", (req, res) => {
    // Get all sports with their category info
    db.all(`
      SELECT 
        s.id, 
        s.name,
        s.name_en,
        s.type,
        s.category,
        s.parent_id,
        s.team_size,
        s.sport_type,
        s.category_id,
        sc.id as cat_id,
        sc.name as cat_name,
        sc.name_en as cat_name_en,
        sc.slug as cat_slug,
        sc.name as category_name,
        sc.slug as category_slug,
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

      const filteredSports = isTestHost(req) ? filterSportsForTest(sports) : sports;
      
      // Group by sport_categories
      const categoryMap = {};
      
      filteredSports.forEach(sport => {
        // Use category from sport_categories table if available
        const catId = sport.cat_id || 'uncategorized';
        const catName = sport.cat_name || 'Sonstige';
        const catNameEn = sport.cat_name_en || catName;
        const catSlug = sport.cat_slug || 'other';
        const catIcon = sport.cat_icon || '🏆';
        const catSort = sport.cat_sort || 99;
        
        if (!categoryMap[catId]) {
          categoryMap[catId] = {
            id: catId,
            name: catName,
            name_en: catNameEn,
            slug: catSlug,
            icon: catIcon,
            sort_order: catSort,
            sports: []
          };
        }
        
        // Only add main sports (not variants with parent_id)
        if (!sport.parent_id) {
          // Find variants for this sport
          const variants = filteredSports.filter(v => v.parent_id === sport.id);
          
          categoryMap[catId].sports.push({
            id: sport.id,
            name: sport.name,
            name_en: sport.name_en || sport.name,
            type: sport.type,
            category: sport.category,
            team_size: sport.team_size,
            sport_type: sport.sport_type,
            variants: variants.map(v => ({
              id: v.id,
              name: v.name,
              name_en: v.name_en || v.name,
              type: v.type,
              category: v.category
            }))
          });
        }
      });
      
      // Sort by sort_order and convert to array
      const result = Object.values(categoryMap).sort((a, b) => a.sort_order - b.sort_order);
      console.log(`[sports/categories] Returning ${result.length} categories with ${filteredSports.length} total sports`);
      res.json(result);
    });
  });



  // Einzelne Sportart
  router.get("/:id", (req, res) => {
    const id = Number(req.params.id);
    db.get(`SELECT id, name, name_en FROM sports WHERE id = ? AND published = 1`, [id], (err, row) => {
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
