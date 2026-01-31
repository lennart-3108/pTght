const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAdmin } = require('../../middleware/auth');

// ==================== COMMUNITY LIGA LOCATION ACTIVATION ====================

// Get all cities/locations with community league status
router.get('/community-leagues', isAdmin, async (req, res) => {
  try {
    // Get all cities with their community league activation status
    const cities = await db('cities')
      .select('*')
      .orderBy('name', 'asc');

    // Get all locations grouped by city
    const locations = await db('locations')
      .select('*')
      .orderBy('city', 'asc')
      .orderBy('name', 'asc');

    // Get all sports for reference
    const sports = await db('sports')
      .where({ published: true, parent_id: null })
      .select('id', 'name')
      .orderBy('name', 'asc');

    // Get existing community leagues
    const communityLeagues = await db('leagues')
      .where({ is_community: true })
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
    const hasColumn = await db.schema.hasColumn('cities', 'community_leagues_enabled');
    if (!hasColumn) {
      await db.schema.table('cities', (table) => {
        table.boolean('community_leagues_enabled').defaultTo(false);
      });
    }
    
    await db('cities').where({ id }).update({ community_leagues_enabled: true });
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
    await db('cities').where({ id }).update({ community_leagues_enabled: false });
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
    const hasColumn = await db.schema.hasColumn('locations', 'community_leagues_enabled');
    if (!hasColumn) {
      await db.schema.table('locations', (table) => {
        table.boolean('community_leagues_enabled').defaultTo(false);
      });
    }
    
    // Enable community leagues for location
    await db('locations').where({ id }).update({ community_leagues_enabled: true });
    
    // Get location details
    const location = await db('locations').where({ id }).first();
    
    // Create community leagues for all published sports if not exists
    if (sports && sports.length > 0) {
      for (const sportId of sports) {
        const sport = await db('sports').where({ id: sportId }).first();
        if (!sport) continue;
        
        // Check if league already exists
        const existingLeague = await db('leagues')
          .where({
            location_id: id,
            sport_id: sportId,
            is_community: true
          })
          .first();
        
        if (!existingLeague) {
          // Create community league
          await db('leagues').insert({
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
      const allSports = await db('sports')
        .where({ published: true, parent_id: null })
        .select('id', 'name');
      
      for (const sport of allSports) {
        const existingLeague = await db('leagues')
          .where({
            location_id: id,
            sport_id: sport.id,
            is_community: true
          })
          .first();
        
        if (!existingLeague) {
          await db('leagues').insert({
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
    await db('locations').where({ id }).update({ community_leagues_enabled: false });
    
    // Optionally unpublish the leagues (don't delete them)
    await db('leagues')
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
    await db('leagues').where({ id }).del();
    res.json({ success: true, message: 'Liga gelöscht' });
  } catch (error) {
    console.error('Error deleting league:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
});

module.exports = router;
