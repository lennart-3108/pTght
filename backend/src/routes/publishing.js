const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAdmin } = require('../middleware/auth');

// ==================== SPORTS PUBLISHING ====================

// Get all sports with publishing status
router.get('/sports', isAdmin, async (req, res) => {
  try {
    const sports = await db('sports')
      .leftJoin('sport_categories', 'sports.category_id', 'sport_categories.id')
      .leftJoin('result_types', 'sports.result_type_id', 'result_types.id')
      .select(
        'sports.*',
        'sport_categories.name as category_name',
        'result_types.name as result_type_name'
      )
      .orderBy('sports.published', 'asc')
      .orderBy('sport_categories.sort_order', 'asc')
      .orderBy('sports.name', 'asc');

    // Build hierarchy
    const categorized = {};
    sports.forEach(sport => {
      const catName = sport.category_name || 'Ohne Kategorie';
      if (!categorized[catName]) {
        categorized[catName] = { parents: [], children: [] };
      }
      if (!sport.parent_id) {
        categorized[catName].parents.push(sport);
      } else {
        categorized[catName].children.push(sport);
      }
    });

    res.json({ success: true, data: categorized });
  } catch (error) {
    console.error('Error fetching sports for publishing:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Sportarten' });
  }
});

// Publish single sport
router.post('/sports/:id/publish', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db('sports').where({ id }).update({ published: true });
    res.json({ success: true, message: 'Sportart veröffentlicht' });
  } catch (error) {
    console.error('Error publishing sport:', error);
    res.status(500).json({ error: 'Fehler beim Veröffentlichen' });
  }
});

// Unpublish single sport
router.post('/sports/:id/unpublish', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db('sports').where({ id }).update({ published: false });
    res.json({ success: true, message: 'Sportart verborgen' });
  } catch (error) {
    console.error('Error unpublishing sport:', error);
    res.status(500).json({ error: 'Fehler beim Verbergen' });
  }
});

// Publish sport with all children (hierarchy)
router.post('/sports/:id/publish-hierarchy', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Publish parent
    await db('sports').where({ id }).update({ published: true });
    
    // Publish all children
    await db('sports').where({ parent_id: id }).update({ published: true });
    
    res.json({ success: true, message: 'Sportart und alle Disziplinen veröffentlicht' });
  } catch (error) {
    console.error('Error publishing sport hierarchy:', error);
    res.status(500).json({ error: 'Fehler beim Veröffentlichen der Hierarchie' });
  }
});

// Unpublish sport with all children (hierarchy)
router.post('/sports/:id/unpublish-hierarchy', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Unpublish parent
    await db('sports').where({ id }).update({ published: false });
    
    // Unpublish all children
    await db('sports').where({ parent_id: id }).update({ published: false });
    
    res.json({ success: true, message: 'Sportart und alle Disziplinen verborgen' });
  } catch (error) {
    console.error('Error unpublishing sport hierarchy:', error);
    res.status(500).json({ error: 'Fehler beim Verbergen der Hierarchie' });
  }
});

// ==================== LOCATIONS PUBLISHING ====================

// Get all locations with publishing status
router.get('/locations', isAdmin, async (req, res) => {
  try {
    const locations = await db('locations')
      .select('*')
      .orderBy('published', 'asc')
      .orderBy('name', 'asc');

    // Build hierarchy
    const hierarchy = {};
    locations.forEach(loc => {
      if (!loc.parent_id) {
        hierarchy[loc.id] = { ...loc, children: [] };
      }
    });
    
    locations.forEach(loc => {
      if (loc.parent_id && hierarchy[loc.parent_id]) {
        hierarchy[loc.parent_id].children.push(loc);
      }
    });

    res.json({ success: true, data: Object.values(hierarchy) });
  } catch (error) {
    console.error('Error fetching locations for publishing:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Locations' });
  }
});

// Publish single location
router.post('/locations/:id/publish', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db('locations').where({ id }).update({ published: true });
    res.json({ success: true, message: 'Location veröffentlicht' });
  } catch (error) {
    console.error('Error publishing location:', error);
    res.status(500).json({ error: 'Fehler beim Veröffentlichen' });
  }
});

// Unpublish single location
router.post('/locations/:id/unpublish', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db('locations').where({ id }).update({ published: false });
    res.json({ success: true, message: 'Location verborgen' });
  } catch (error) {
    console.error('Error unpublishing location:', error);
    res.status(500).json({ error: 'Fehler beim Verbergen' });
  }
});

// Publish location with all children (hierarchy)
router.post('/locations/:id/publish-hierarchy', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Publish parent
    await db('locations').where({ id }).update({ published: true });
    
    // Publish all children recursively
    const publishChildren = async (parentId) => {
      const children = await db('locations').where({ parent_id: parentId });
      for (const child of children) {
        await db('locations').where({ id: child.id }).update({ published: true });
        await publishChildren(child.id);
      }
    };
    
    await publishChildren(id);
    
    res.json({ success: true, message: 'Location und alle Unterlocations veröffentlicht' });
  } catch (error) {
    console.error('Error publishing location hierarchy:', error);
    res.status(500).json({ error: 'Fehler beim Veröffentlichen der Hierarchie' });
  }
});

// Unpublish location with all children (hierarchy)
router.post('/locations/:id/unpublish-hierarchy', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Unpublish parent
    await db('locations').where({ id }).update({ published: false });
    
    // Unpublish all children recursively
    const unpublishChildren = async (parentId) => {
      const children = await db('locations').where({ parent_id: parentId });
      for (const child of children) {
        await db('locations').where({ id: child.id }).update({ published: false });
        await unpublishChildren(child.id);
      }
    };
    
    await unpublishChildren(id);
    
    res.json({ success: true, message: 'Location und alle Unterlocations verborgen' });
  } catch (error) {
    console.error('Error unpublishing location hierarchy:', error);
    res.status(500).json({ error: 'Fehler beim Verbergen der Hierarchie' });
  }
});

// ==================== LEAGUES PUBLISHING ====================

// Get all community leagues with publishing status
router.get('/leagues', isAdmin, async (req, res) => {
  try {
    const leagues = await db('leagues')
      .leftJoin('sports', 'leagues.sport_id', 'sports.id')
      .leftJoin('locations', 'leagues.location_id', 'locations.id')
      .leftJoin('users', 'leagues.created_by', 'users.id')
      .select(
        'leagues.*',
        'sports.name as sport_name',
        'locations.name as location_name',
        'users.username as creator_name',
        'users.email as creator_email'
      )
      .where('leagues.is_community', true)
      .orderBy('leagues.published', 'asc')
      .orderBy('leagues.created_at', 'desc');

    res.json({ success: true, data: leagues });
  } catch (error) {
    console.error('Error fetching leagues for publishing:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Ligen' });
  }
});

// Publish league
router.post('/leagues/:id/publish', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db('leagues').where({ id }).update({ published: true });
    res.json({ success: true, message: 'Liga veröffentlicht' });
  } catch (error) {
    console.error('Error publishing league:', error);
    res.status(500).json({ error: 'Fehler beim Veröffentlichen' });
  }
});

// Unpublish league
router.post('/leagues/:id/unpublish', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db('leagues').where({ id }).update({ published: false });
    res.json({ success: true, message: 'Liga verborgen' });
  } catch (error) {
    console.error('Error unpublishing league:', error);
    res.status(500).json({ error: 'Fehler beim Verbergen' });
  }
});

// Delete league (permanent)
router.delete('/leagues/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db('leagues').where({ id }).del();
    res.json({ success: true, message: 'Liga gelöscht' });
  } catch (error) {
    console.error('Error deleting league:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

module.exports = router;
