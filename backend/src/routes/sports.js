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

  function withSportsColumns(callback) {
    db.all(`PRAGMA table_info(sports)`, [], (err, cols) => {
      if (err) return callback(err);
      const names = new Set((cols || []).map((col) => String(col.name || '').toLowerCase()));
      callback(null, {
        hasPublished: names.has('published'),
        hasActive: names.has('active')
      });
    });
  }

  function sportsVisibilityWhere(meta, alias = 'sports') {
    const filters = [];
    if (meta?.hasPublished) filters.push(`${alias}.published = 1`);
    if (meta?.hasActive) filters.push(`${alias}.active = 1`);
    return filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  }

  // Liste aller Sportarten mit Kategorie-Info
  router.get("/list", (req, res) => {
    withSportsColumns((metaErr, meta) => {
      if (metaErr) return res.status(500).json({ error: "Datenbankfehler" });
      db.all(`
        SELECT 
          s.id, 
          s.name,
          s.name_en,
          s.category_id,
          s.parent_sport_id,
          s.variant_type,
          s.type,
          s.parent_id,
          sc.name as category_name,
          sc.name_en as category_name_en
        FROM sports s
        LEFT JOIN sport_categories sc ON s.category_id = sc.id
        ${sportsVisibilityWhere(meta, 's')}
        ORDER BY s.sort_order, s.name
      `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler" });
        const sports = rows || [];
        const parentIdsWithVisibleChildren = new Set(
          sports
            .filter((row) => row.parent_id)
            .map((row) => Number(row.parent_id))
            .filter((id) => Number.isFinite(id))
        );

        const concreteOptions = sports.filter((row) => {
          const sportId = Number(row.id);
          if (Number.isFinite(sportId) && parentIdsWithVisibleChildren.has(sportId)) {
            return false;
          }
          return true;
        });

        res.json(concreteOptions);
      });
    });
  });

  // Kategorien mit ihren Sportarten (hierarchisch)
  router.get("/categories", (req, res) => {
    withSportsColumns((metaErr, meta) => {
      if (metaErr) {
        console.error('[sports/categories] Column metadata error:', metaErr);
        return res.status(500).json({ error: "Datenbankfehler" });
      }

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
        ${sportsVisibilityWhere(meta, 's')}
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

        const categoryMap = {};
        
        sports.forEach(sport => {
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
          
          if (!sport.parent_id) {
            const variants = sports.filter(v => v.parent_id === sport.id);
            
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
        
        const result = Object.values(categoryMap).sort((a, b) => a.sort_order - b.sort_order);
        console.log(`[sports/categories] Returning ${result.length} categories with ${sports.length} total sports`);
        res.json(result);
      });
    });
  });



  // Einzelne Sportart
  router.get("/:id", (req, res) => {
    const id = Number(req.params.id);
    withSportsColumns((metaErr, meta) => {
      if (metaErr) return res.status(500).json({ error: "Datenbankfehler" });
      const filters = [];
      if (meta?.hasPublished) filters.push('published = 1');
      if (meta?.hasActive) filters.push('active = 1');
      const whereSql = filters.length ? `AND ${filters.join(' AND ')}` : '';
      db.get(`SELECT id, name, name_en, team_size, type, sport_type FROM sports WHERE id = ? ${whereSql}`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler" });
        if (!row) return res.status(404).json({ error: "Nicht gefunden" });
        res.json(row);
      });
    });
  });

  // Namen aller Sportarten (ohne IDs)
  router.get("/names", (_req, res) => {
    withSportsColumns((metaErr, meta) => {
      if (metaErr) return res.status(500).json({ error: "Datenbankfehler" });
      db.all(`SELECT name FROM sports ${sportsVisibilityWhere(meta)} ORDER BY name`, (err, rows) =>
        err ? res.status(500).json({ error: "Datenbankfehler" }) : res.json((rows || []).map(r => r.name))
      );
    });
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
      WHERE l.sport_id = ? AND COALESCE(s.active, 1) = 1
      ORDER BY c.name, l.name
    `;
    db.all(sql, [sportId], (err, rows) =>
      err ? res.status(500).json({ error: "Datenbankfehler", details: err.message }) : res.json(rows || [])
    );
  });

  return router;
};
