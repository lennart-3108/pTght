/**
 * ensureTestLocation
 * Guarantees a developer test dataset exists:
 * - Location: "center courts" in Bremen
 * - Asset: "center court" (hardcourt) supporting Tennis (singles+doubles)
 * - Slots: a handful of available slots for tomorrow afternoon
 *
 * Idempotent: safe to run on every startup.
 */

function asDateTime(y, m, d, hh, mm) {
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  // store without timezone suffix to match existing schema inserts
  return dt.toISOString().slice(0, 19).replace('T', ' ');
}

async function ensureTestLocation(knex) {
  if (!knex || !knex.schema) return;

  const hasLocations = await knex.schema.hasTable('locations').catch(() => false);
  const hasAssets = await knex.schema.hasTable('assets').catch(() => false);
  const hasSlots = await knex.schema.hasTable('slots').catch(() => false);
  const hasSports = await knex.schema.hasTable('sports').catch(() => false);
  const hasUsers = await knex.schema.hasTable('users').catch(() => false);
  if (!hasLocations || !hasAssets || !hasSlots || !hasSports || !hasUsers) return;

  // pick an owner id
  let ownerId = null;
  const anyUser = await knex('users').select('id').orderBy('id', 'asc').first().catch(() => null);
  ownerId = anyUser && anyUser.id ? Number(anyUser.id) : null;
  if (!ownerId) return; // wait until startup user exists

  // ensure Tennis sport exists
  let tennis = await knex('sports').where({ name: 'Tennis' }).first().catch(() => null);
  if (!tennis) {
    const ins = await knex('sports').insert({ name: 'Tennis' });
    const id = Array.isArray(ins) ? ins[0] : ins;
    tennis = { id, name: 'Tennis' };
  }

  // ensure Bremen city exists (optional)
  const cityName = 'Bremen';

  // ensure location
  const locName = 'center courts';
  let location = await knex('locations').where({ name: locName }).first().catch(() => null);
  if (!location) {
    const rec = {
      owner_id: ownerId,
      name: locName,
      description: 'Der center court an der Weser',
      address: 'Osterdeich 54',
      city: cityName,
      postal_code: '28203',
      country: 'Deutschland',
      timezone: 'Europe/Berlin',
      status: 'active',
      is_verified: 1,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    };
    const ins = await knex('locations').insert(rec);
    const id = Array.isArray(ins) ? ins[0] : ins;
    location = await knex('locations').where({ id }).first();
  }

  if (!location || !location.id) return;

  // ensure asset
  const assetName = 'center court';
  let asset = await knex('assets').where({ location_id: location.id, name: assetName }).first().catch(() => null);
  if (!asset) {
    const supported = [{ sport_id: Number(tennis.id), formats: ['singles', 'doubles'] }];
    const rec = {
      location_id: location.id,
      name: assetName,
      description: null,
      type: 'court',
      supported_sports: JSON.stringify(supported),
      surface: 'hardcourt',
      indoor: 0,
      capacity: 20,
      length: 23.77,
      width: 10.97,
      status: 'active',
      display_order: 1,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    };
    const ins = await knex('assets').insert(rec);
    const id = Array.isArray(ins) ? ins[0] : ins;
    asset = await knex('assets').where({ id }).first();
  }

  if (!asset || !asset.id) return;

  // ensure a handful of available slots for tomorrow
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const Y = tomorrow.getFullYear();
  const M = tomorrow.getMonth() + 1;
  const D = tomorrow.getDate();

  // check if we already have slots tomorrow for this asset
  const existingTomorrow = await knex('slots')
    .where({ asset_id: asset.id, location_id: location.id })
    .whereRaw("DATE(start_time) = DATE(?)", [asDateTime(Y, M, D, 0, 0)])
    .count({ c: '*' })
    .first()
    .catch(() => ({ c: 0 }));

  const count = Number(existingTomorrow && (existingTomorrow.c || existingTomorrow.count || 0));
  if (count === 0) {
    const make = (sh, sm, eh, em, price) => ({
      asset_id: asset.id,
      location_id: location.id,
      start_time: asDateTime(Y, M, D, sh, sm),
      end_time: asDateTime(Y, M, D, eh, em),
      duration_minutes: (eh * 60 + em) - (sh * 60 + sm),
      buffer_before: 5,
      buffer_after: 5,
      base_price: price,
      currency: 'EUR',
      status: 'available',
      visibility: 'public',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
    const slots = [
      make(9, 0, 10, 0, 25),
      make(10, 15, 11, 15, 25),
      make(14, 0, 15, 0, 30),
      make(16, 0, 17, 0, 30),
      make(19, 0, 20, 0, 35),
    ];
    try {
      await knex('slots').insert(slots);
    } catch (err) {
      // Gracefully skip duplicates due to unique(asset_id, start_time)
      if (String(err.message || '').includes('UNIQUE constraint failed: slots.asset_id, slots.start_time')) {
        console.warn('[ensureTestLocation] slots already exist for tomorrow, skipping insert');
      } else {
        throw err;
      }
    }
  }
}

module.exports = { ensureTestLocation };
