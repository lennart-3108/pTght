/**
 * Asset Routes
 * API endpoints for asset management
 */

const express = require('express');
const { isAuthenticated } = require('../../middleware/auth');
const AssetService = require('../services/AssetService');

function resolveKnex(db) {
  if (db?.client && typeof db.raw === "function") return db;
  if (db?.knex?.client) return db.knex;
  try { return require("../../db"); } catch { /* no-op */ }
  throw new Error("No knex instance available");
}

module.exports = function assetRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;
  const knex = resolveKnex(db);
  const assetService = new AssetService(knex);

  /**
   * GET /assets - Search assets
   */
  router.get('/', async (req, res) => {
    try {
      const filters = {
        location_id: req.query.location_id,
        city: req.query.city,
        type: req.query.type,
        indoor: req.query.indoor === 'true' ? true : req.query.indoor === 'false' ? false : undefined,
        surface: req.query.surface,
      };

      const assets = await assetService.searchAssets(filters);
      return res.json(assets);
    } catch (error) {
      console.error('[GET /assets] error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch assets' });
    }
  });

  /**
   * GET /assets/:id - Get asset by ID
   */
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const asset = await assetService.getAssetById(parseInt(id));
      
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }
      
      return res.json(asset);
    } catch (error) {
      console.error(`[GET /assets/${req.params.id}] error:`, error);
      return res.status(500).json({ error: error.message || 'Failed to fetch asset' });
    }
  });

  /**
   * GET /assets/location/:locationId - Get all assets for a location
   */
  router.get('/location/:locationId', async (req, res) => {
    try {
      const { locationId } = req.params;
      const assets = await assetService.getAssetsByLocation(parseInt(locationId));
      return res.json(assets);
    } catch (error) {
      console.error(`[GET /assets/location/${req.params.locationId}] error:`, error);
      return res.status(500).json({ error: error.message || 'Failed to fetch assets' });
    }
  });

  /**
   * POST /assets - Create new asset
   */
  router.post('/', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const { location_id, ...assetData } = req.body;
      
      if (!location_id) {
        return res.status(400).json({ error: 'location_id is required' });
      }
      
      const asset = await assetService.createAsset(location_id, userId, assetData);
      return res.status(201).json(asset);
    } catch (error) {
      console.error('[POST /assets] error:', error);
      const status = error.message.includes('required') || error.message.includes('Invalid') ? 400 :
                     error.message.includes('not found') || error.message.includes('access denied') ? 404 : 500;
      return res.status(status).json({ error: error.message || 'Failed to create asset' });
    }
  });

  /**
   * PUT /assets/:id - Update asset
   */
  router.put('/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const asset = await assetService.updateAsset(parseInt(id), userId, req.body);
      return res.json(asset);
    } catch (error) {
      console.error(`[PUT /assets/${req.params.id}] error:`, error);
      const status = error.message.includes('not found') || error.message.includes('access denied') ? 404 :
                     error.message.includes('Invalid') ? 400 : 500;
      return res.status(status).json({ error: error.message || 'Failed to update asset' });
    }
  });

  /**
   * DELETE /assets/:id - Delete asset (soft delete)
   */
  router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const result = await assetService.deleteAsset(parseInt(id), userId);
      return res.json(result);
    } catch (error) {
      console.error(`[DELETE /assets/${req.params.id}] error:`, error);
      const status = error.message.includes('not found') || error.message.includes('access denied') ? 404 :
                     error.message.includes('active bookings') ? 409 : 500;
      return res.status(status).json({ error: error.message || 'Failed to delete asset' });
    }
  });

  return router;
};
