const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/countries
 * Get all countries
 */
router.get('/', async (req, res) => {
  try {
    const countries = await db('countries')
      .select('id', 'name', 'code', 'phone_code')
      .orderBy('name', 'asc');

    res.json(countries);
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ 
      error: 'Failed to fetch countries',
      details: error.message 
    });
  }
});

/**
 * GET /api/countries/:id
 * Get country by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const country = await db('countries')
      .select('*')
      .where({ id: parseInt(req.params.id) })
      .first();

    if (!country) {
      return res.status(404).json({ error: 'Country not found' });
    }

    res.json(country);
  } catch (error) {
    console.error('Error fetching country:', error);
    res.status(500).json({ 
      error: 'Failed to fetch country',
      details: error.message 
    });
  }
});

module.exports = router;
