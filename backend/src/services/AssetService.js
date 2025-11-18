/**
 * Asset Service
 * Handles CRUD operations for assets (courts, fields, halls, etc.)
 */

class AssetService {
  constructor(knex) {
    this.db = knex;
  }

  /**
   * Create a new asset
   */
  async createAsset(locationId, ownerId, data) {
    // Verify location ownership
    const location = await this.db('locations')
      .where({ id: locationId, owner_id: ownerId })
      .first();

    if (!location) {
      throw new Error('Location not found or access denied');
    }

    // Validation
    if (!data.name || !data.type) {
      throw new Error('Name and type are required');
    }

    const validTypes = ['court', 'field', 'hall', 'table', 'room', 'other'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid asset type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Prepare asset data
    const assetData = {
      location_id: locationId,
      name: data.name,
      description: data.description || null,
      type: data.type,
      sports_json: typeof data.sports_json === 'string' ? data.sports_json : JSON.stringify(data.sports_json || null),
      surface: data.surface || null,
      capacity: data.capacity || null,
      length: data.length || null,
      width: data.width || null,
      status: data.status || 'active',
      slot_duration: data.slot_duration || 60,
      slot_pause: data.slot_pause || 0,
      min_booking_duration: data.min_booking_duration || 60,
      max_booking_duration: data.max_booking_duration || 120,
      slot_interval: data.slot_interval || 15,
      advance_booking_days: data.advance_booking_days || 30,
      cancellation_hours: data.cancellation_hours || 24
    };

    const [id] = await this.db('assets').insert(assetData);
    return this.getAssetById(id);
  }

  /**
   * Get asset by ID
   */
  async getAssetById(id) {
    const asset = await this.db('assets')
      .where({ id })
      .first();

    if (!asset) {
      return null;
    }

    // Parse JSON fields
    if (asset.supported_sports) asset.supported_sports = JSON.parse(asset.supported_sports);
    if (asset.equipment) asset.equipment = JSON.parse(asset.equipment);
    if (asset.amenities) asset.amenities = JSON.parse(asset.amenities);
    if (asset.photos) asset.photos = JSON.parse(asset.photos);

    return asset;
  }

  /**
   * Get all assets for a location
   */
  async getAssetsByLocation(locationId) {
    const assets = await this.db('assets')
      .where({ location_id: locationId })
      .orderBy('display_order', 'asc')
      .orderBy('name', 'asc');

    return assets.map(asset => {
      if (asset.supported_sports) asset.supported_sports = JSON.parse(asset.supported_sports);
      if (asset.equipment) asset.equipment = JSON.parse(asset.equipment);
      if (asset.amenities) asset.amenities = JSON.parse(asset.amenities);
      if (asset.photos) asset.photos = JSON.parse(asset.photos);
      return asset;
    });
  }

  /**
   * Update asset
   */
  async updateAsset(id, ownerId, data) {
    // Verify ownership via location
    const asset = await this.db('assets as a')
      .join('locations as l', 'a.location_id', 'l.id')
      .where({ 'a.id': id, 'l.owner_id': ownerId })
      .select('a.*')
      .first();

    if (!asset) {
      throw new Error('Asset not found or access denied');
    }

    // Prepare update data
    const updateData = {};
    const allowedFields = [
      'name', 'description', 'type', 'surface', 'capacity',
      'length', 'width', 'status',
      'min_booking_duration', 'max_booking_duration', 'slot_interval',
      'advance_booking_days', 'cancellation_hours'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    if (data.sports_json !== undefined) {
      updateData.sports_json = typeof data.sports_json === 'string' ? data.sports_json : JSON.stringify(data.sports_json);
    }

    await this.db('assets')
      .where({ id })
      .update({ ...updateData, updated_at: this.db.fn.now() });

    return this.getAssetById(id);
  }

  /**
   * Delete asset
   */
  async deleteAsset(id, ownerId) {
    // Verify ownership
    const asset = await this.db('assets as a')
      .join('locations as l', 'a.location_id', 'l.id')
      .where({ 'a.id': id, 'l.owner_id': ownerId })
      .select('a.*')
      .first();

    if (!asset) {
      throw new Error('Asset not found or access denied');
    }

    // Check for active bookings
    const activeBookings = await this.db('bookings')
      .where({ asset_id: id })
      .whereIn('status', ['held', 'confirmed', 'paid'])
      .where('start_time', '>', this.db.fn.now())
      .count('* as count')
      .first();

    if (activeBookings.count > 0) {
      throw new Error('Cannot delete asset with active bookings');
    }

    // Soft delete by setting status to inactive
    await this.db('assets')
      .where({ id })
      .update({ status: 'inactive', updated_at: this.db.fn.now() });

    return { success: true };
  }

  /**
   * Check if asset supports a specific sport
   */
  async supportsSport(assetId, sportId, format = null) {
    const asset = await this.getAssetById(assetId);
    
    if (!asset || !asset.supported_sports) {
      return false;
    }

    const sportSupport = asset.supported_sports.find(s => s.sport_id === sportId);
    
    if (!sportSupport) {
      return false;
    }

    // If format specified, check if it's supported
    if (format && sportSupport.formats && !sportSupport.formats.includes(format)) {
      return false;
    }

    return true;
  }

  /**
   * Search assets by sport and location
   */
  async searchAssets(filters = {}) {
    let query = this.db('assets as a')
      .join('locations as l', 'a.location_id', 'l.id')
      .where({ 'a.status': 'active', 'l.status': 'active' })
      .select('a.*', 'l.name as location_name', 'l.city', 'l.latitude', 'l.longitude');

    // Location filter
    if (filters.location_id) {
      query = query.where({ 'a.location_id': filters.location_id });
    }

    // City filter
    if (filters.city) {
      query = query.where('l.city', 'like', `%${filters.city}%`);
    }

    // Type filter
    if (filters.type) {
      query = query.where({ 'a.type': filters.type });
    }

    // Indoor/outdoor filter
    if (filters.indoor !== undefined) {
      query = query.where({ 'a.indoor': filters.indoor });
    }

    // Surface filter
    if (filters.surface) {
      query = query.where({ 'a.surface': filters.surface });
    }

    const assets = await query.orderBy('l.name', 'asc').orderBy('a.display_order', 'asc');

    return assets.map(asset => {
      if (asset.supported_sports) asset.supported_sports = JSON.parse(asset.supported_sports);
      if (asset.equipment) asset.equipment = JSON.parse(asset.equipment);
      if (asset.amenities) asset.amenities = JSON.parse(asset.amenities);
      if (asset.photos) asset.photos = JSON.parse(asset.photos);
      return asset;
    });
  }
}

module.exports = AssetService;
