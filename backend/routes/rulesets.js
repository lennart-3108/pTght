const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/rulesets
 * List all rulesets, optionally filtered by sport_id
 */
router.get('/', async (req, res) => {
  try {
    const { sport_id } = req.query;

    let query = db('rulesets as r')
      .select(
        'r.*',
        's.name as sport_name'
      )
      .leftJoin('sports as s', 'r.sport_id', 's.id')
      .where('r.is_active', true);

    if (sport_id) {
      query = query.where('r.sport_id', sport_id);
    }

    const rulesets = await query.orderBy('r.version', 'desc');

    res.json(rulesets);
  } catch (error) {
    console.error('Error fetching rulesets:', error);
    res.status(500).json({ error: 'Failed to fetch rulesets' });
  }
});

/**
 * GET /api/rulesets/:id
 * Get a specific ruleset
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const ruleset = await db('rulesets as r')
      .select(
        'r.*',
        's.name as sport_name'
      )
      .leftJoin('sports as s', 'r.sport_id', 's.id')
      .where('r.id', id)
      .first();

    if (!ruleset) {
      return res.status(404).json({ error: 'Ruleset not found' });
    }

    res.json(ruleset);
  } catch (error) {
    console.error('Error fetching ruleset:', error);
    res.status(500).json({ error: 'Failed to fetch ruleset' });
  }
});

module.exports = router;
