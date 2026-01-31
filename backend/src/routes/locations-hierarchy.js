const express = require('express');
const { isAdmin } = require('../../middleware/auth');

module.exports = function locationsHierarchyRoutes(ctx) {
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

  /**
   * GET /api/locations-hierarchy
   * Returns simplified location hierarchy: Country -> Cities -> Districts -> Locations
   * Note: state_id in cities is an external reference, not a self-reference
   * Query params:
   *   - country_id: filter by country
   */
  router.get('/', isAdmin, async (req, res) => {
    try {
      const { country_id } = req.query;

      // Get all countries
      const countries = await knex('countries')
        .select('id', 'name', 'code')
        .orderBy('name', 'asc');

      // Build hierarchy for each country
      const hierarchy = [];

      for (const country of countries) {
        // Skip if filtering by country_id
        if (country_id && parseInt(country_id) !== country.id) {
          continue;
        }

        // Get all cities for this country (type = 'city', excluding districts)
        const cities = await knex('cities')
          .where({ country_id: country.id, type: 'city' })
          .select('id', 'name', 'state_id', 'leagues_enabled')
          .orderBy('name', 'asc');

        const citiesData = [];

        for (const city of cities) {
          // Get districts for this city
          const districts = await knex('cities')
            .where({ parent_city_id: city.id, type: 'district' })
            .select('id', 'name', 'type', 'leagues_enabled')
            .orderBy('name', 'asc');

          // Get locations for this city
          const locations = await knex('locations')
            .where({ city: city.name, published: true })
            .select('id', 'name', 'address')
            .orderBy('name', 'asc');

          // Get community leagues count
          const leaguesCount = await knex('leagues')
            .where({ city_id: city.id, level: 'community', published: true })
            .count('* as count')
            .first();

          citiesData.push({
            id: city.id,
            name: city.name,
            state_id: city.state_id,
            leagues_enabled: city.leagues_enabled || false,
            districts: districts.map(d => ({
              id: d.id,
              name: d.name,
              leagues_enabled: d.leagues_enabled || false
            })),
            locations: locations,
            community_leagues_count: leaguesCount?.count || 0
          });
        }

        hierarchy.push({
          id: country.id,
          name: country.name,
          code: country.code,
          cities: citiesData
        });
      }

      res.json({
        success: true,
        data: hierarchy
      });

    } catch (error) {
      console.error('Error fetching locations hierarchy:', error);
      res.status(500).json({ 
        success: false,
        error: 'Fehler beim Laden der Location-Hierarchie',
        details: error.message
      });
    }
  });

  /**
   * POST /api/locations-hierarchy/:cityId/enable
   * Enable community leagues for a city and all its children
   */
  router.post('/:cityId/enable', isAdmin, async (req, res) => {
    try {
      const { cityId } = req.params;

      // Check if leagues_enabled column exists in cities table
      const hasColumn = await knex.schema.hasColumn('cities', 'leagues_enabled');
      if (!hasColumn) {
        await knex.schema.table('cities', (table) => {
          table.boolean('leagues_enabled').defaultTo(false);
        });
      }

      // Enable for this city
      await knex('cities')
        .where({ id: cityId })
        .update({ leagues_enabled: true });

      // Get all child cities (where state_id = cityId)
      const childCities = await knex('cities')
        .where({ state_id: cityId })
        .select('id');

      // Enable for all child cities
      if (childCities.length > 0) {
        await knex('cities')
          .whereIn('id', childCities.map(c => c.id))
          .update({ leagues_enabled: true });
      }

      // Get all districts (where parent_city_id in childCities or cityId)
      const allCityIds = [cityId, ...childCities.map(c => c.id)];
      const districts = await knex('cities')
        .whereIn('parent_city_id', allCityIds)
        .where({ type: 'district' })
        .select('id');

      // Enable for all districts
      if (districts.length > 0) {
        await knex('cities')
          .whereIn('id', districts.map(d => d.id))
          .update({ leagues_enabled: true });
      }

      // Now create community leagues for all locations in these cities
      const city = await knex('cities').where({ id: cityId }).first();
      const allCities = await knex('cities')
        .whereIn('id', allCityIds)
        .select('name');

      const cityNames = allCities.map(c => c.name);

      // Get all locations in these cities
      const locations = await knex('locations')
        .whereIn('city', cityNames)
        .where({ published: true })
        .select('id', 'name', 'city');

      // Get all published sports
      const sports = await knex('sports')
        .where({ published: true })
        .whereNull('parent_id')
        .select('id', 'name');

      let createdCount = 0;

      // Create community leagues for each location × sport combination
      for (const location of locations) {
        for (const sport of sports) {
          // Check if league already exists
          const existing = await knex('leagues')
            .where({
              city_id: cityId,
              sport_id: sport.id,
              level: 'community'
            })
            .whereRaw('LOWER(name) = LOWER(?)', [`${sport.name} Community Liga - ${city.name}`])
            .first();

          if (!existing) {
            // Create the league
            await knex('leagues').insert({
              name: `${sport.name} Community Liga - ${city.name}`,
              sport_id: sport.id,
              city_id: cityId,
              level: 'community',
              published: true, // Auto-publish when enabled via hierarchy
              start_date: new Date().toISOString(),
              status: 'active',
              max_participants: 100,
              organizer_id: 1 // System/Admin
            });
            createdCount++;
          }
        }
      }

      res.json({
        success: true,
        message: `Community Ligen aktiviert für ${city.name} und alle Untereinheiten`,
        data: {
          city: city.name,
          childCitiesCount: childCities.length,
          districtsCount: districts.length,
          locationsCount: locations.length,
          leaguesCreated: createdCount
        }
      });

    } catch (error) {
      console.error('Error enabling community leagues:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Aktivieren der Community Ligen'
      });
    }
  });

  /**
   * POST /api/locations-hierarchy/:cityId/disable
   * Disable community leagues for a city and all its children
   */
  router.post('/:cityId/disable', isAdmin, async (req, res) => {
    try {
      const { cityId } = req.params;

      // Disable for this city
      await knex('cities')
        .where({ id: cityId })
        .update({ leagues_enabled: false });

      // Get all child cities
      const childCities = await knex('cities')
        .where({ state_id: cityId })
        .select('id');

      // Disable for all child cities
      if (childCities.length > 0) {
        await knex('cities')
          .whereIn('id', childCities.map(c => c.id))
          .update({ leagues_enabled: false });
      }

      // Get all districts
      const allCityIds = [cityId, ...childCities.map(c => c.id)];
      const districts = await knex('cities')
        .whereIn('parent_city_id', allCityIds)
        .where({ type: 'district' })
        .select('id');

      // Disable for all districts
      if (districts.length > 0) {
        await knex('cities')
          .whereIn('id', districts.map(d => d.id))
          .update({ leagues_enabled: false });
      }

      // Unpublish (hide) all community leagues for this city
      await knex('leagues')
        .where({ city_id: cityId, level: 'community' })
        .update({ published: false });

      res.json({
        success: true,
        message: 'Community Ligen deaktiviert'
      });

    } catch (error) {
      console.error('Error disabling community leagues:', error);
      res.status(500).json({
        success: false,
        error: 'Fehler beim Deaktivieren'
      });
    }
  });

  return router;
};
