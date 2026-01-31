const express = require('express');
const { isAdmin } = require('../../middleware/auth');

module.exports = function publishingRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  // Helper to get knex instance
  function resolveKnex(d) {
    try {
      if (!d) {
      } else {
        if (typeof d === "function" && d.client) return d;
        if (d.client && typeof d.raw === "function") return d;
        if (d.knex && d.knex.client) return d.knex;
      }
    } catch (e) {}
    const tryRequire = (p) => { try { return require(p); } catch { return null; } };
    return tryRequire("../../db") || tryRequire("../../../db") || tryRequire("../../../../db") || null;
  }

  const knex = resolveKnex(db);

  // ==================== COMMUNITY LIGA LOCATION ACTIVATION ====================

  // Get all cities/locations with community league status
  router.get('/community-leagues', isAdmin, async (req, res) => {
    try {
      // Get all cities with their community league activation status
      const cities = await knex('cities')
        .select('*')
        .orderBy('name', 'asc');

      // Get all locations grouped by city
      const locations = await knex('locations')
        .select('*')
        .orderBy('city', 'asc')
        .orderBy('name', 'asc');

      // Get all sports for reference
      const sports = await knex('sports')
        .where({ published: true, parent_id: null })
        .select('id', 'name')
        .orderBy('name', 'asc');

      // Get existing community leagues
      const communityLeagues = await knex('leagues')
        .where({ is_community: true })
        .select('*');
      .select('*');

    // Build city data with locations
    const cityData = cities.map(city => {
      const cityLocations = locations.filter(loc => loc.city === city.name);
      
      return {
        id: city.id,
        name: city.name,
        country: city.country,
        community_leagues_enabled: city.community_leagues_enabled || false,
        locations: cityLocations.map(loc => ({
          id: loc.id,
          name: loc.name,
          address: loc.address,
          community_leagues_enabled: loc.community_leagues_enabled || false,
          leagues: communityLeagues.filter(l => l.location_id === loc.id)
        }))
      };
    });

    res.json({ 
      success: true, 
      data: {
        cities: cityData,
        sports: sports
      }
    });
  } catch (error) {
    console.error('Error fetching community leagues:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Community Ligen' });
  }
});

// Enable community leagues for a city
router.post('/cities/:id/enable-community', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if column exists
    const hasColumn = await knex.schema.hasColumn('cities', 'community_leagues_enabled');
    if (!hasColumn) {
      await knex.schema.table('cities', (table) => {
        table.boolean('community_leagues_enabled').defaultTo(false);
      });
    }
    
    await knex('cities').where({ id }).update({ community_leagues_enabled: true });
    res.json({ success: true, message: 'Community Ligen für Stadt aktiviert' });
  } catch (error) {
    console.error('Error enabling community leagues for city:', error);
    res.status(500).json({ error: 'Fehler beim Aktivieren' });
  }
});

// Disable community leagues for a city
router.post('/cities/:id/disable-community', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await knex('cities').where({ id }).update({ community_leagues_enabled: false });
    res.json({ success: true, message: 'Community Ligen für Stadt deaktiviert' });
  } catch (error) {
    console.error('Error disabling community leagues for city:', error);
    res.status(500).json({ error: 'Fehler beim Deaktivieren' });
  }
});

// Enable community leagues for a location
router.post('/locations/:id/enable-community', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { sports } = req.body; // Array of sport IDs to create leagues for
    
    // Check if column exists
    const hasColumn = await knex.schema.hasColumn('locations', 'community_leagues_enabled');
    if (!hasColumn) {
      await knex.schema.table('locations', (table) => {
        table.boolean('community_leagues_enabled').defaultTo(false);
      });
    }
    
    // Enable community leagues for location
    await knex('locations').where({ id }).update({ community_leagues_enabled: true });
    
    // Get location details
    const location = await knex('locations').where({ id }).first();
    
    // Create community leagues for all published sports if not exists
    if (sports && sports.length > 0) {
      for (const sportId of sports) {
        const sport = await knex('sports').where({ id: sportId }).first();
        if (!sport) continue;
        
        // Check if league already exists
        const existingLeague = await knex('leagues')
          .where({
            location_id: id,
            sport_id: sportId,
            is_community: true
          })
          .first();
        
        if (!existingLeague) {
          // Create community league
          await knex('leagues').insert({
            name: `${sport.name} Community Liga - ${location.name}`,
            location_id: id,
            sport_id: sportId,
            is_community: true,
            published: true,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }
    } else {
      // Create for all published sports
      const allSports = await knex('sports')
        .where({ published: true, parent_id: null })
        .select('id', 'name');
      
      for (const sport of allSports) {
        const existingLeague = await knex('leagues')
          .where({
            location_id: id,
            sport_id: sport.id,
            is_community: true
          })
          .first();
        
        if (!existingLeague) {
          await knex('leagues').insert({
            name: `${sport.name} Community Liga - ${location.name}`,
            location_id: id,
            sport_id: sport.id,
            is_community: true,
            published: true,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }
    }
    
    res.json({ success: true, message: 'Community Ligen für Location aktiviert und erstellt' });
  } catch (error) {
    console.error('Error enabling community leagues for location:', error);
    res.status(500).json({ error: 'Fehler beim Aktivieren' });
  }
});

// Disable community leagues for a location
router.post('/locations/:id/disable-community', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await knex('locations').where({ id }).update({ community_leagues_enabled: false });
    
    // Optionally unpublish the leagues (don't delete them)
    await knex('leagues')
      .where({ location_id: id, is_community: true })
      .update({ published: false });
    
    res.json({ success: true, message: 'Community Ligen für Location deaktiviert' });
  } catch (error) {
    console.error('Error disabling community leagues for location:', error);
    res.status(500).json({ error: 'Fehler beim Deaktivieren' });
  }
});

// Delete a community league
router.delete('/leagues/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await knex('leagues').where({ id }).del();
    res.json({ success: true, message: 'Liga gelöscht' });
  } catch (error) {
    console.error('Error deleting league:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

  return router;
};
