/**
 * Slot Service
 * Handles CRUD operations for slots with buffer enforcement and overlap detection
 */

const moment = require('moment-timezone');

class SlotService {
  constructor(knex) {
    this.db = knex;
  }

  /**
   * Create a new slot with overlap and buffer validation
   */
  async createSlot(assetId, ownerId, data) {
    // Verify asset ownership
    const asset = await this.db('assets as a')
      .join('locations as l', 'a.location_id', 'l.id')
      .where({ 'a.id': assetId, 'l.owner_id': ownerId })
      .select('a.*', 'l.timezone', 'l.id as location_id')
      .first();

    if (!asset) {
      throw new Error('Asset not found or access denied');
    }

    // Validation
    if (!data.start_time || !data.end_time) {
      throw new Error('Start time and end time are required');
    }

    // Parse dates using location timezone
    const startTime = moment.tz(data.start_time, asset.timezone).utc();
    const endTime = moment.tz(data.end_time, asset.timezone).utc();

    if (!startTime.isValid() || !endTime.isValid()) {
      throw new Error('Invalid date/time format');
    }

    if (endTime.isSameOrBefore(startTime)) {
      throw new Error('End time must be after start time');
    }

    const durationMinutes = endTime.diff(startTime, 'minutes');
    
    const bufferBefore = parseInt(data.buffer_before) || 0;
    const bufferAfter = parseInt(data.buffer_after) || 0;

    if (bufferBefore < 0 || bufferAfter < 0) {
      throw new Error('Buffers must be non-negative');
    }

    // Check for overlap including buffers
    await this.checkOverlap(assetId, startTime, endTime, bufferBefore, bufferAfter);

    // Prepare slot data
    const slotData = {
      asset_id: assetId,
      location_id: asset.location_id,
      start_time: startTime.format('YYYY-MM-DD HH:mm:ss'),
      end_time: endTime.format('YYYY-MM-DD HH:mm:ss'),
      duration_minutes: durationMinutes,
      buffer_before: bufferBefore,
      buffer_after: bufferAfter,
      base_price: data.base_price || 0,
      currency: data.currency || 'EUR',
      pricing_rule_id: data.pricing_rule_id || null,
      sport_id: data.sport_id || null,
      format: data.format || null,
      status: 'available',
      visibility: data.visibility || 'public',
      is_recurring: false,
      recurrence_id: null,
      recurrence_rule: null,
      is_boosted: data.is_boosted || false,
      boost_rank: data.boost_rank || 0,
      boost_discount_pct: data.boost_discount_pct || 0,
    };

    const [id] = await this.db('slots').insert(slotData);
    return this.getSlotById(id);
  }

  /**
   * Check for overlapping slots (including buffers)
   */
  async checkOverlap(assetId, startTime, endTime, bufferBefore, bufferAfter, excludeSlotId = null) {
    // Calculate effective time range including buffers
    const effectiveStart = moment(startTime).subtract(bufferBefore, 'minutes');
    const effectiveEnd = moment(endTime).add(bufferAfter, 'minutes');

    let query = this.db('slots')
      .where({ asset_id: assetId })
      .whereIn('status', ['available', 'held', 'booked'])
      .where(function() {
        // Check if new slot overlaps with existing slots (including their buffers)
        this.where(function() {
          // Existing slot starts during our slot
          this.where('start_time', '>=', effectiveStart.format('YYYY-MM-DD HH:mm:ss'))
            .where('start_time', '<', effectiveEnd.format('YYYY-MM-DD HH:mm:ss'));
        }).orWhere(function() {
          // Existing slot ends during our slot
          this.where('end_time', '>', effectiveStart.format('YYYY-MM-DD HH:mm:ss'))
            .where('end_time', '<=', effectiveEnd.format('YYYY-MM-DD HH:mm:ss'));
        }).orWhere(function() {
          // Existing slot completely contains our slot
          this.where('start_time', '<=', effectiveStart.format('YYYY-MM-DD HH:mm:ss'))
            .where('end_time', '>=', effectiveEnd.format('YYYY-MM-DD HH:mm:ss'));
        });
      });

    if (excludeSlotId) {
      query = query.where('id', '!=', excludeSlotId);
    }

    const overlapping = await query.first();

    if (overlapping) {
      // Also check if the overlapping slot's buffers conflict
      const overlapStart = moment(overlapping.start_time).subtract(overlapping.buffer_before || 0, 'minutes');
      const overlapEnd = moment(overlapping.end_time).add(overlapping.buffer_after || 0, 'minutes');

      if (effectiveEnd.isAfter(overlapStart) && effectiveStart.isBefore(overlapEnd)) {
        throw new Error('Slot overlaps with existing slot (including buffers)');
      }
    }
  }

  /**
   * Get slot by ID
   */
  async getSlotById(id) {
    const slot = await this.db('slots')
      .where({ id })
      .first();

    if (!slot) {
      return null;
    }

    // Parse JSON fields
    if (slot.recurrence_rule) {
      slot.recurrence_rule = JSON.parse(slot.recurrence_rule);
    }

    return slot;
  }

  /**
   * Get available slots for an asset within a time range
   */
  async getAvailableSlots(assetId, startDate, endDate, filters = {}) {
    let query = this.db('slots')
      .where({ asset_id: assetId, status: 'available' })
      .where('start_time', '>=', startDate)
      .where('start_time', '<', endDate);

    if (filters.sport_id) {
      query = query.where(function() {
        this.where({ sport_id: filters.sport_id }).orWhereNull('sport_id');
      });
    }

    if (filters.visibility) {
      query = query.where({ visibility: filters.visibility });
    }

    const slots = await query.orderBy('start_time', 'asc');

    return slots.map(slot => {
      if (slot.recurrence_rule) slot.recurrence_rule = JSON.parse(slot.recurrence_rule);
      return slot;
    });
  }

  /**
   * Update slot
   */
  async updateSlot(id, ownerId, data) {
    // Verify ownership
    const slot = await this.db('slots as s')
      .join('assets as a', 's.asset_id', 'a.id')
      .join('locations as l', 'a.location_id', 'l.id')
      .where({ 's.id': id, 'l.owner_id': ownerId })
      .select('s.*', 'l.timezone')
      .first();

    if (!slot) {
      throw new Error('Slot not found or access denied');
    }

    // Cannot update booked or held slots
    if (['booked', 'held'].includes(slot.status)) {
      throw new Error('Cannot update slot that is booked or held');
    }

    const updateData = {};

    // Update times if provided
    if (data.start_time || data.end_time) {
      const startTime = data.start_time 
        ? moment.tz(data.start_time, slot.timezone).utc()
        : moment(slot.start_time);
      const endTime = data.end_time 
        ? moment.tz(data.end_time, slot.timezone).utc()
        : moment(slot.end_time);

      if (endTime.isSameOrBefore(startTime)) {
        throw new Error('End time must be after start time');
      }

      // Check overlap with new times
      await this.checkOverlap(
        slot.asset_id,
        startTime,
        endTime,
        data.buffer_before !== undefined ? data.buffer_before : slot.buffer_before,
        data.buffer_after !== undefined ? data.buffer_after : slot.buffer_after,
        id
      );

      updateData.start_time = startTime.format('YYYY-MM-DD HH:mm:ss');
      updateData.end_time = endTime.format('YYYY-MM-DD HH:mm:ss');
      updateData.duration_minutes = endTime.diff(startTime, 'minutes');
    }

    // Update other fields
    const allowedFields = [
      'buffer_before', 'buffer_after', 'base_price', 'currency',
      'sport_id', 'format', 'visibility', 'is_boosted', 'boost_rank', 'boost_discount_pct'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    });

    await this.db('slots')
      .where({ id })
      .update({ ...updateData, updated_at: this.db.fn.now() });

    return this.getSlotById(id);
  }

  /**
   * Delete slot
   */
  async deleteSlot(id, ownerId) {
    // Verify ownership
    const slot = await this.db('slots as s')
      .join('assets as a', 's.asset_id', 'a.id')
      .join('locations as l', 'a.location_id', 'l.id')
      .where({ 's.id': id, 'l.owner_id': ownerId })
      .select('s.*')
      .first();

    if (!slot) {
      throw new Error('Slot not found or access denied');
    }

    // Cannot delete booked or held slots
    if (['booked', 'held'].includes(slot.status)) {
      throw new Error('Cannot delete slot that is booked or held');
    }

    await this.db('slots').where({ id }).delete();

    return { success: true };
  }

  /**
   * Block a slot (set status to blocked)
   */
  async blockSlot(id, ownerId, reason = null) {
    const slot = await this.db('slots as s')
      .join('assets as a', 's.asset_id', 'a.id')
      .join('locations as l', 'a.location_id', 'l.id')
      .where({ 's.id': id, 'l.owner_id': ownerId })
      .select('s.*')
      .first();

    if (!slot) {
      throw new Error('Slot not found or access denied');
    }

    if (slot.status === 'booked') {
      throw new Error('Cannot block a booked slot');
    }

    await this.db('slots')
      .where({ id })
      .update({ 
        status: 'blocked',
        updated_at: this.db.fn.now()
      });

    return this.getSlotById(id);
  }

  /**
   * Search slots across locations
   */
  async searchSlots(filters = {}) {
    let query = this.db('slots as s')
      .join('assets as a', 's.asset_id', 'a.id')
      .join('locations as l', 'a.location_id', 'l.id')
      .where({ 's.status': 'available', 'l.status': 'active', 'a.status': 'active' })
      .select(
        's.*',
        'a.name as asset_name',
        'a.type as asset_type',
        'a.surface',
        'a.indoor',
        'l.name as location_name',
        'l.city',
        'l.latitude',
        'l.longitude'
      );

    // Date range filter
    if (filters.start_date) {
      query = query.where('s.start_time', '>=', filters.start_date);
    }
    if (filters.end_date) {
      query = query.where('s.start_time', '<', filters.end_date);
    }

    // City filter
    if (filters.city) {
      query = query.where('l.city', 'like', `%${filters.city}%`);
    }

    // Sport filter
    if (filters.sport_id) {
      query = query.where(function() {
        this.where({ 's.sport_id': filters.sport_id }).orWhereNull('s.sport_id');
      });
    }

    // Price range
    if (filters.min_price) {
      query = query.where('s.base_price', '>=', filters.min_price);
    }
    if (filters.max_price) {
      query = query.where('s.base_price', '<=', filters.max_price);
    }

    // Indoor/outdoor
    if (filters.indoor !== undefined) {
      query = query.where({ 'a.indoor': filters.indoor });
    }

    // Surface filter
    if (filters.surface) {
      query = query.where({ 'a.surface': filters.surface });
    }

    // Geo radius
    if (filters.latitude && filters.longitude && filters.radius_km) {
      const lat = parseFloat(filters.latitude);
      const lng = parseFloat(filters.longitude);
      const radius = parseFloat(filters.radius_km);

      query = query.select(this.db.raw(`
        (6371 * acos(
          cos(radians(?)) * cos(radians(l.latitude)) * 
          cos(radians(l.longitude) - radians(?)) + 
          sin(radians(?)) * sin(radians(l.latitude))
        )) as distance_km
      `, [lat, lng, lat]))
      .having('distance_km', '<=', radius);
    }

    // Boost priority
    const slots = await query.orderBy('s.is_boosted', 'desc')
      .orderBy('s.boost_rank', 'desc')
      .orderBy('s.start_time', 'asc');

    return slots.map(slot => {
      if (slot.recurrence_rule) slot.recurrence_rule = JSON.parse(slot.recurrence_rule);
      return slot;
    });
  }
}

module.exports = SlotService;
