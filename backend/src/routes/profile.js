const express = require('express');
const { isAuthenticated } = require('../../middleware/auth');

function resolveKnex(db) {
  if (db?.client && typeof db.raw === 'function') return db;
  if (db?.knex?.client) return db.knex;
  try { return require('../../db'); } catch { /* no-op */ }
  return null;
}

module.exports = function profileRoutes(ctx) {
  const router = express.Router();
  const db = ctx && ctx.db;

  // GET /profile -> return current user's profile fields
  router.get('/profile', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const hasUsers = await k.schema.hasTable('users').catch(() => false);
      if (!hasUsers) return res.json({ id: req.user.id, open_for_matches: false, favorite_sports: [] });
      const info = await k('users').columnInfo().catch(() => ({}));
      const row = await k('users').where({ id: req.user.id }).first().catch(() => null);
      if (!row) return res.json({ id: req.user.id, open_for_matches: false, favorite_sports: [] });
      const open_for_matches = Object.prototype.hasOwnProperty.call(info, 'open_for_matches') ? !!row.open_for_matches : false;
      const favRaw = Object.prototype.hasOwnProperty.call(info, 'favorite_sports') ? (row.favorite_sports || '') : '';
      let favorite_sports = [];
      try {
        if (typeof favRaw === 'string' && favRaw.trim().startsWith('[')) favorite_sports = JSON.parse(favRaw);
        else if (typeof favRaw === 'string') favorite_sports = favRaw.split(',').map(s => s.trim()).filter(Boolean);
      } catch {}
      return res.json({ id: req.user.id, open_for_matches, favorite_sports });
    } catch (e) {
      console.error('[GET /profile] failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // PUT /profile -> update open_for_matches and favorite_sports
  router.put('/profile', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const hasUsers = await k.schema.hasTable('users').catch(() => false);
      if (!hasUsers) return res.status(400).json({ error: 'USERS_TABLE_MISSING' });
      const info = await k('users').columnInfo().catch(() => ({}));
      const patch = {};
      if (Object.prototype.hasOwnProperty.call(info, 'open_for_matches') && typeof req.body?.open_for_matches !== 'undefined') {
        patch.open_for_matches = req.body.open_for_matches ? 1 : 0;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'favorite_sports') && Array.isArray(req.body?.favorite_sports)) {
        patch.favorite_sports = JSON.stringify(req.body.favorite_sports);
      }
      if (!Object.keys(patch).length) return res.json({ ok: true });
      await k('users').where({ id: req.user.id }).update(patch);
      return res.json({ ok: true });
    } catch (e) {
      console.error('[PUT /profile] failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // GET /open-matches?sportId=&sport=&cityId=&stateId=&countryId -> list matches without league (Open Matches per sport)
  // Public: used on landing/start page; keep read-only and safe
  router.get('/open-matches', async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const hasMatches = await k.schema.hasTable('matches').catch(() => false);
      if (!hasMatches) return res.json([]);
      // Detect sports linking
      const hasLeagues = await k.schema.hasTable('leagues').catch(() => false);
      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      const hasCities = await k.schema.hasTable('cities').catch(() => false);
      const hasStates = await k.schema.hasTable('states').catch(() => false);
      const hasCountries = await k.schema.hasTable('countries').catch(() => false);
      let sportId = req.query.sportId ? Number(req.query.sportId) : null;
      const sportName = (req.query.sport || '').trim();
      if (!sportId && sportName && hasSports) {
        const srow = await k('sports').whereRaw('LOWER(name) = ?', [sportName.toLowerCase()]).first().catch(() => null);
        sportId = srow && srow.id ? Number(srow.id) : null;
      }
      // Select matches:
      // - Either no league_id (null) OR league is the special Open Matches league
      // - status is 'open' if such column exists, otherwise any without away assigned
      const info = await k('matches').columnInfo().catch(() => ({}));
      const hasStatus = Object.prototype.hasOwnProperty.call(info, 'status');
      const base = k({ m: 'matches' });
  if (hasLeagues) base.leftJoin({ l: 'leagues' }, 'l.id', 'm.league_id');
  if (hasSports && hasLeagues) base.leftJoin({ s: 'sports' }, 's.id', 'l.sport_id');
  if (hasCities && hasLeagues) base.leftJoin({ c: 'cities' }, 'c.id', 'l.city_id');
  if (hasStates && hasCities) base.leftJoin({ st: 'states' }, 'st.id', 'c.state_id');
  if (hasCountries && hasCities) base.leftJoin({ co: 'countries' }, 'co.id', 'c.country_id');

      base.where(function () {
        this.whereNull('m.league_id');
        if (hasLeagues) this.orWhere('l.name', 'Open Matches');
      });
      if (hasStatus) base.whereIn('m.status', ['open', 'proposed']).orWhereNull('m.status');
  if (sportId && hasLeagues && hasSports) base.andWhere('s.id', sportId);
  const cityId = req.query.cityId ? Number(req.query.cityId) : null;
  const stateId = req.query.stateId ? Number(req.query.stateId) : null;
  const countryId = req.query.countryId ? Number(req.query.countryId) : null;
  if (cityId && hasCities && hasLeagues) base.andWhere('c.id', cityId);
  if (stateId && hasStates && hasCities) base.andWhere('st.id', stateId);
  if (countryId && hasCountries && hasCities) base.andWhere('co.id', countryId);

      // Without status: keep only rows without opponent
      if (!hasStatus) {
        const hasInfoHome = Object.prototype.hasOwnProperty.call(info, 'home_user_id') || Object.prototype.hasOwnProperty.call(info, 'home');
        const hasInfoAway = Object.prototype.hasOwnProperty.call(info, 'away_user_id') || Object.prototype.hasOwnProperty.call(info, 'away');
        base.andWhere(function () {
          if (Object.prototype.hasOwnProperty.call(info, 'away_user_id')) this.whereNull('m.away_user_id');
          if (Object.prototype.hasOwnProperty.call(info, 'away_team_id')) this.whereNull('m.away_team_id');
          if (!hasInfoAway) this.whereRaw('1=1');
        });
      }

      const rows = await base
        .select(
          'm.id', 'm.kickoff_at',
          { leagueId: 'm.league_id' },
          hasLeagues ? { league: 'l.name' } : { league: null },
          hasSports && hasLeagues ? { sport: 's.name' } : { sport: null },
          hasCities && hasLeagues ? { city: 'c.name' } : { city: null },
          hasStates && hasCities ? { state: 'st.name' } : { state: null },
          hasCountries && hasCities ? { country: 'co.name' } : { country: null },
          'm.home_user_id', 'm.away_user_id', 'm.home_team_id', 'm.away_team_id',
          ...(hasStatus ? [{ status: 'm.status' }] : [])
        )
        .orderBy('m.id', 'desc');

      return res.json(rows || []);
    } catch (e) {
      console.error('[GET /open-matches] failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST /open-matches -> create an open friendly match in per-sport/city 'Open Matches' league
  // Body: { sportId, cityId, kickoff_at? }
  router.post('/open-matches', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const hasMatches = await k.schema.hasTable('matches').catch(() => false);
      if (!hasMatches) return res.status(500).json({ error: 'NO_MATCHES_TABLE' });
      const hasLeagues = await k.schema.hasTable('leagues').catch(() => false);
      if (!hasLeagues) return res.status(500).json({ error: 'NO_LEAGUES_TABLE' });
      const sportId = Number(req.body?.sportId) || null;
      const cityId = Number(req.body?.cityId) || null;
      if (!sportId || !cityId) return res.status(400).json({ error: 'sportId and cityId are required' });

      // ensure or create 'Open Matches' league for given sport/city
      let leagueId = null;
      const existing = await k('leagues').where({ name: 'Open Matches', sport_id: sportId, city_id: cityId }).first().catch(() => null);
      if (existing && existing.id) leagueId = Number(existing.id);
      else {
        try {
          const insL = await k('leagues').insert({ name: 'Open Matches', sport_id: sportId, city_id: cityId });
          leagueId = Array.isArray(insL) ? insL[0] : insL;
        } catch (e) {
          const retry = await k('leagues').where({ name: 'Open Matches', sport_id: sportId, city_id: cityId }).first().catch(() => null);
          leagueId = retry && retry.id ? Number(retry.id) : null;
        }
      }
      if (!leagueId) return res.status(500).json({ error: 'OPEN_LEAGUE_CREATE_FAILED' });

      const info = await k('matches').columnInfo().catch(() => ({}));
      const rec = {
        league_id: leagueId,
        home_user_id: req.user.id || null,
        home_team_id: null,
        away_user_id: null,
        away_team_id: null,
        home_score: null,
        away_score: null,
      };
      if (Object.prototype.hasOwnProperty.call(info, 'kickoff_at')) {
        const when = req.body?.kickoff_at ? new Date(req.body.kickoff_at) : null;
        rec.kickoff_at = when && !isNaN(when) ? when.toISOString() : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'status')) rec.status = 'open';
      if (Object.prototype.hasOwnProperty.call(info, 'created_at')) rec.created_at = new Date().toISOString();

      const ins = await k('matches').insert(rec);
      const id = Array.isArray(ins) ? ins[0] : ins;
      const row = await k('matches').where({ id }).first();
      return res.status(201).json(row);
    } catch (e) {
      console.error('[POST /open-matches] failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  return router;
};
