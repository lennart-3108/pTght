const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/regions
 * Get all regions
 */
router.get('/', async (req, res) => {
  try {
    const regions = await db('regions')
      .select('id', 'name', 'code', 'created_at')
      .orderBy('name', 'asc');

    res.json(regions);
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

/**
 * GET /api/regions/:id
 * Get single region with country count
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const region = await db('regions')
      .where({ 'regions.id': id })
      .select('regions.*')
      .first();

    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    // Get country count
    const countResult = await db('countries')
      .where({ region_id: id })
      .count('* as count')
      .first();

    region.countryCount = parseInt(countResult.count);

    res.json(region);
  } catch (error) {
    console.error('Error fetching region:', error);
    res.status(500).json({ error: 'Failed to fetch region' });
  }
});

/**
 * GET /api/regions/:id/countries
 * Get all countries in a region
 */
router.get('/:id/countries', async (req, res) => {
  try {
    const { id } = req.params;

    const countries = await db('countries')
      .where({ region_id: id })
      .select('id', 'code', 'name', 'iso2', 'created_at')
      .orderBy('name', 'asc');

    res.json(countries);
  } catch (error) {
    console.error('Error fetching region countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

module.exports = router;
