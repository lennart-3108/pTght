class SuggestService {
  constructor(db) {
    this.db = db;
  }

  async nextFreeSlot({ cityId, sport, from, to, duration = 60 }) {
    const k = this.db;
    let query = k('slots as s')
      .join('assets as a', 's.asset_id', 'a.id')
      .join('locations as l', 's.location_id', 'l.id')
      .where('s.status', 'available')
      .select(
        's.*',
        'a.name as asset_name',
        'l.name as location_name',
        'l.city as location_city',
        'l.latitude', 'l.longitude'
      )
      .orderBy('s.start_time', 'asc')
      .limit(1);

    if (cityId) query = query.where('l.city', cityId);
    if (sport) query = query.where('a.sport_id', sport);
    if (duration) query = query.where('s.duration_minutes', '>=', duration);
    if (from) query = query.where('s.start_time', '>=', new Date(from));
    if (to) query = query.where('s.start_time', '<=', new Date(to));

    const row = await query.first();
    return row || null;
  }

  async bestSlots({ cityId, sport, limit = 10 }) {
    const k = this.db;
    let query = k('slots as s')
      .join('assets as a', 's.asset_id', 'a.id')
      .join('locations as l', 's.location_id', 'l.id')
      .where('s.status', 'available')
      .select(
        's.*',
        'a.name as asset_name',
        'l.name as location_name',
        'l.city as location_city',
        'l.latitude', 'l.longitude',
        's.base_price'
      );

    if (cityId) query = query.where('l.city', cityId);
    if (sport) query = query.where('a.sport_id', sport);

    // Ranking:
    // 1) earliest start_time
    // 2) placeholder for proximity (if lat/lng present) — client may refine
    // 3) price ascending
    query = query.orderBy('s.start_time', 'asc').orderBy('s.base_price', 'asc').limit(limit);

    const rows = await query;
    return rows || [];
  }
}

module.exports = SuggestService;
