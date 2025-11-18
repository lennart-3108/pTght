/**
 * Location Service
 * Handles CRUD operations and business logic for locations
 */

const { validateTimezone, validateCoordinates } = require('../utils/validators');

class LocationService {
  constructor(knex) {
    this.db = knex;
  }

  /**
   * Create a new location
   */
  async createLocation(ownerId, data) {
    // Validation
    if (!data.name) {
      throw new Error('Name is required');
    }

    // Prepare location data (only columns that exist in schema)
    const locationData = {
      owner_id: ownerId,
      name: data.name,
      description: data.description || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      postal_code: data.postal_code || null,
      country: data.country || null,
      country_code: data.country_code || null,
      timezone: data.timezone || 'Europe/Berlin',
      status: data.status || 'draft',
    };

    const [id] = await this.db('locations').insert(locationData);
    return this.getLocationById(id);
  }

  /**
   * Get location by ID with assets
   */
  async getLocationById(id, includeAssets = false) {
    const location = await this.db('locations')
      .where({ id })
      .first();

    if (!location) {
      return null;
    }

    // No JSON fields to parse in current schema

    if (includeAssets) {
      location.assets = await this.db('assets')
        .where({ location_id: id })
        .orderBy('id', 'asc');

      // Parse JSON for assets if they have such fields
      location.assets = location.assets.map(asset => {
        if (asset.sports_json) {
          try {
            asset.sports_json = JSON.parse(asset.sports_json);
          } catch (e) { /* keep as string */ }
        }
        return asset;
      });
    }

    return location;
  }

  /**
   * Get all locations for an owner
   */
  async getLocationsByOwner(ownerId) {
    const locations = await this.db('locations')
      .where({ owner_id: ownerId })
      .orderBy('created_at', 'desc');

    return locations.map(loc => {
      if (loc.opening_hours) loc.opening_hours = JSON.parse(loc.opening_hours);
      if (loc.photos) loc.photos = JSON.parse(loc.photos);
      return loc;
    });
  }

  /**
   * Update location
   */
  async updateLocation(id, ownerId, data) {
    // Verify ownership
    const location = await this.db('locations')
      .where({ id, owner_id: ownerId })
      .first();

    if (!location) {
      throw new Error('Location not found or access denied');
    }

    // Validate timezone if provided
    if (data.timezone && !validateTimezone(data.timezone)) {
      throw new Error(`Invalid timezone: ${data.timezone}`);
    }

    // Validate coordinates if provided
    if ((data.latitude || data.longitude) && !validateCoordinates(data.latitude, data.longitude)) {
      throw new Error('Invalid coordinates');
    }

    // Prepare update data
    const updateData = {};
    const allowedFields = [
      'name', 'description', 'address', 'city', 'postal_code', 'country',
      'latitude', 'longitude', 'phone', 'email', 'website', 'timezone', 'status'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    if (data.opening_hours) {
      updateData.opening_hours = JSON.stringify(data.opening_hours);
    }
    if (data.photos) {
      updateData.photos = JSON.stringify(data.photos);
    }

    await this.db('locations')
      .where({ id })
      .update({ ...updateData, updated_at: this.db.fn.now() });

    return this.getLocationById(id);
  }

  /**
   * Delete location (soft delete by setting status to inactive)
   */
  async deleteLocation(id, ownerId) {
    const location = await this.db('locations')
      .where({ id, owner_id: ownerId })
      .first();

    if (!location) {
      throw new Error('Location not found or access denied');
    }

    // Check if there are active bookings
    const activeBookings = await this.db('bookings')
      .where({ location_id: id })
      .whereIn('status', ['held', 'confirmed', 'paid'])
      .where('start_time', '>', this.db.fn.now())
      .count('* as count')
      .first();

    if (activeBookings.count > 0) {
      throw new Error('Cannot delete location with active bookings');
    }

    // Soft delete
    await this.db('locations')
      .where({ id })
      .update({ status: 'inactive', updated_at: this.db.fn.now() });

    return { success: true };
  }

  /**
   * Search locations by filters
   */
  async searchLocations(filters = {}) {
    let query = this.db('locations')
      .where({ status: 'active' });

    // City filter
    if (filters.city) {
      query = query.where('city', 'like', `%${filters.city}%`);
    }

    // Country filter
    if (filters.country) {
      query = query.where({ country: filters.country });
    }

    // Geo radius search (if lat/lng provided)
    if (filters.latitude && filters.longitude && filters.radius_km) {
      // Haversine formula for distance calculation
      const lat = parseFloat(filters.latitude);
      const lng = parseFloat(filters.longitude);
      const radius = parseFloat(filters.radius_km);

      query = query.select('*')
        .select(this.db.raw(`
          (6371 * acos(
            cos(radians(?)) * cos(radians(latitude)) * 
            cos(radians(longitude) - radians(?)) + 
            sin(radians(?)) * sin(radians(latitude))
          )) as distance_km
        `, [lat, lng, lat]))
        .having('distance_km', '<=', radius);
    }

    const locations = await query.orderBy('name', 'asc');

    return locations.map(loc => {
      if (loc.opening_hours) loc.opening_hours = JSON.parse(loc.opening_hours);
      if (loc.photos) loc.photos = JSON.parse(loc.photos);
      return loc;
    });
  }
}

module.exports = LocationService;
