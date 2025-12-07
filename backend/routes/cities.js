const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/cities
 * Get all cities with country and state information
 */
router.get('/', async (req, res) => {
  try {
    const { country_id, state_id } = req.query;
    
    let query = db('cities')
      .select(
        'cities.id',
        'cities.name',
        'cities.country_id',
        'cities.state_id',
        'cities.type',
        'cities.parent_city_id',
        'cities.population',
        'cities.latitude',
        'cities.longitude',
        'countries.name as country_name',
        'countries.code as country_code',
        'counties.name as state_name',
        'counties.code as state_code'
      )
      .leftJoin('countries', 'cities.country_id', 'countries.id')
      .leftJoin('counties', 'cities.state_id', 'counties.id')
      .orderBy('cities.name', 'asc');

    // Filter by country if specified
    if (country_id) {
      query = query.where('cities.country_id', parseInt(country_id));
    }

    // Filter by state if specified
    if (state_id) {
      query = query.where('cities.state_id', parseInt(state_id));
    }

    const cities = await query;

    res.json(cities);
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ 
      error: 'Failed to fetch cities',
      details: error.message 
    });
  }
});

/**
 * GET /api/cities/:id
 * Get city by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const city = await db('cities')
      .select(
        'cities.*',
        'countries.name as country_name',
        'countries.code as country_code',
        'counties.name as state_name',
        'counties.code as state_code'
      )
      .leftJoin('countries', 'cities.country_id', 'countries.id')
      .leftJoin('counties', 'cities.state_id', 'counties.id')
      .where('cities.id', parseInt(req.params.id))
      .first();

    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    res.json(city);
  } catch (error) {
    console.error('Error fetching city:', error);
    res.status(500).json({ 
      error: 'Failed to fetch city',
      details: error.message 
    });
  }
});

/**
 * POST /api/cities
 * Create a new city
 */
router.post('/', async (req, res) => {
  try {
    const { name, country_id, state_id, population, latitude, longitude } = req.body;

    if (!name || !country_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, country_id' 
      });
    }

    const cityId = await db('cities').insert({
      name,
      country_id,
      state_id: state_id || null,
      population: population || null,
      latitude: latitude || null,
      longitude: longitude || null
    }).returning('id');

    const city = await db('cities')
      .select(
        'cities.*',
        'countries.name as country_name',
        'counties.name as state_name',
        'counties.code as state_code'
      )
      .leftJoin('countries', 'cities.country_id', 'countries.id')
      .leftJoin('counties', 'cities.state_id', 'counties.id')
      .where('cities.id', cityId[0])
      .first();

    res.status(201).json(city);
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ 
      error: 'Failed to create city',
      details: error.message 
    });
  }
});

module.exports = router;
