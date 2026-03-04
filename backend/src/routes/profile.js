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
      
      // Include profile fields
      const result = { id: req.user.id, open_for_matches, favorite_sports };
      if (Object.prototype.hasOwnProperty.call(info, 'bio')) result.bio = row.bio || null;
      if (Object.prototype.hasOwnProperty.call(info, 'location')) result.location = row.location || null;
      if (Object.prototype.hasOwnProperty.call(info, 'phone')) result.phone = row.phone || null;
      if (Object.prototype.hasOwnProperty.call(info, 'birth_date')) result.birth_date = row.birth_date || null;
      if (Object.prototype.hasOwnProperty.call(info, 'gender')) result.gender = row.gender || null;
      
      return res.json(result);
    } catch (e) {
      console.error('[GET /profile] failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // PUT /profile -> update user profile fields
  router.put('/profile', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex(db);
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const hasUsers = await k.schema.hasTable('users').catch(() => false);
      if (!hasUsers) return res.status(400).json({ error: 'USERS_TABLE_MISSING' });
      const info = await k('users').columnInfo().catch(() => ({}));
      const patch = {};
      
      // Basic account fields
      if (Object.prototype.hasOwnProperty.call(info, 'firstname') && typeof req.body?.firstname !== 'undefined') {
        patch.firstname = req.body.firstname ? String(req.body.firstname).trim() : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'lastname') && typeof req.body?.lastname !== 'undefined') {
        patch.lastname = req.body.lastname ? String(req.body.lastname).trim() : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'username') && req.body?.username) {
        patch.username = String(req.body.username).trim();
      }
      if (Object.prototype.hasOwnProperty.call(info, 'email') && req.body?.email) {
        patch.email = String(req.body.email).trim();
      }
      
      // Existing fields
      if (Object.prototype.hasOwnProperty.call(info, 'open_for_matches') && typeof req.body?.open_for_matches !== 'undefined') {
        patch.open_for_matches = req.body.open_for_matches ? 1 : 0;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'favorite_sports') && Array.isArray(req.body?.favorite_sports)) {
        patch.favorite_sports = JSON.stringify(req.body.favorite_sports);
      }
      
      // New profile fields
      if (Object.prototype.hasOwnProperty.call(info, 'bio') && typeof req.body?.bio !== 'undefined') {
        patch.bio = req.body.bio ? String(req.body.bio).trim() : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'location') && typeof req.body?.location !== 'undefined') {
        patch.location = req.body.location ? String(req.body.location).trim() : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'phone') && typeof req.body?.phone !== 'undefined') {
        patch.phone = req.body.phone ? String(req.body.phone).trim() : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'birth_date') && typeof req.body?.birth_date !== 'undefined') {
        patch.birth_date = req.body.birth_date ? String(req.body.birth_date).trim() : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'birthday') && typeof req.body?.birthday !== 'undefined') {
        patch.birthday = req.body.birthday ? String(req.body.birthday).trim() : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'city_id') && typeof req.body?.city_id !== 'undefined') {
        patch.city_id = req.body.city_id ? Number(req.body.city_id) : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'district_id') && typeof req.body?.district_id !== 'undefined') {
        patch.district_id = req.body.district_id ? Number(req.body.district_id) : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'gender') && typeof req.body?.gender !== 'undefined') {
        patch.gender = req.body.gender ? String(req.body.gender).trim() : null;
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
      const hasStates = await k.schema.hasTable('counties').catch(() => false);
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
  if (hasStates && hasCities) base.leftJoin({ st: 'counties' }, 'st.id', 'c.state_id');
  if (hasCountries && hasCities) base.leftJoin({ co: 'countries' }, 'co.id', 'c.country_id');

      base.where(function () {
        this.whereNull('m.league_id');
        if (hasLeagues) this.orWhere('l.name', 'Open Matches');
      });
      if (hasStatus) {
        base.andWhere(function () {
          this.whereIn('m.status', ['open', 'proposed']).orWhereNull('m.status');
        });
      }
  if (sportId && hasLeagues && hasSports) base.andWhere('s.id', sportId);
  const cityId = req.query.cityId ? Number(req.query.cityId) : null;
  const stateId = req.query.stateId ? Number(req.query.stateId) : null;
  const countryId = req.query.countryId ? Number(req.query.countryId) : null;
  if (cityId && hasCities && hasLeagues) base.andWhere('c.id', cityId);
  if (stateId && hasStates && hasCities) base.andWhere('st.id', stateId);
  if (countryId && hasCountries && hasCities) base.andWhere('co.id', countryId);

      // Legacy filter: previously only matches without opponent.
      // For multi-participant matches we later filter by capacity using match_participants.
      base.whereNull('m.away_team_id');
      if (Object.prototype.hasOwnProperty.call(info, 'away_user_id')) {
        base.whereNull('m.away_user_id');
      }

      const hasKickoffEndAt = Object.prototype.hasOwnProperty.call(info, 'kickoff_end_at');
      const hasWhenType = Object.prototype.hasOwnProperty.call(info, 'when_type');
      const hasRangeDays = Object.prototype.hasOwnProperty.call(info, 'range_days');
      const hasPlayerLevel = Object.prototype.hasOwnProperty.call(info, 'player_level');
      
      // Date filtering: default next 14 days, or custom range
      const rangeDays = req.query.rangeDays ? Number(req.query.rangeDays) : 14;
      const fromDate = req.query.fromDate ? new Date(req.query.fromDate) : null;
      const toDate = req.query.toDate ? new Date(req.query.toDate) : null;
      
      if (fromDate && toDate && !isNaN(fromDate) && !isNaN(toDate)) {
        // Custom date range
        if (hasKickoffEndAt) {
          base.andWhere(function() {
            this.whereNull('m.kickoff_at')
              .orWhereBetween('m.kickoff_at', [fromDate.toISOString(), toDate.toISOString()])
              .orWhereBetween('m.kickoff_end_at', [fromDate.toISOString(), toDate.toISOString()]);
          });
        } else {
          base.andWhere(function () {
            this.whereNull('m.kickoff_at').orWhereBetween('m.kickoff_at', [fromDate.toISOString(), toDate.toISOString()]);
          });
        }
      } else if (rangeDays && !isNaN(rangeDays)) {
        // Next X days from now
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + rangeDays);
        
        if (hasKickoffEndAt) {
          base.andWhere(function() {
            this.whereNull('m.kickoff_at')
              .orWhereBetween('m.kickoff_at', [now.toISOString(), endDate.toISOString()])
              .orWhereBetween('m.kickoff_end_at', [now.toISOString(), endDate.toISOString()]);
          });
        } else {
          base.andWhere(function () {
            this.whereNull('m.kickoff_at').orWhereBetween('m.kickoff_at', [now.toISOString(), endDate.toISOString()]);
          });
        }
      }
      
      const selectFields = [
        'm.id',
        'm.kickoff_at',
        'm.league_id as leagueId',
        'm.home_user_id',
        'm.away_user_id',
        'm.home_team_id',
        'm.away_team_id'
      ];

      if (Object.prototype.hasOwnProperty.call(info, 'max_players')) selectFields.push('m.max_players');
      if (Object.prototype.hasOwnProperty.call(info, 'team_count')) selectFields.push('m.team_count');
      if (Object.prototype.hasOwnProperty.call(info, 'players_per_team')) selectFields.push('m.players_per_team');
      if (Object.prototype.hasOwnProperty.call(info, 'allow_team_choice')) selectFields.push('m.allow_team_choice');
      
      if (hasKickoffEndAt) selectFields.push('m.kickoff_end_at');
      if (hasWhenType) selectFields.push('m.when_type');
      if (hasRangeDays) selectFields.push('m.range_days');
      if (hasPlayerLevel) selectFields.push('m.player_level');
      if (hasStatus) selectFields.push('m.status');
      if (hasLeagues) selectFields.push('l.name as league');
      if (hasSports && hasLeagues) selectFields.push('s.name as sport');
      if (hasCities && hasLeagues) selectFields.push('c.name as city');
      if (hasStates && hasCities) selectFields.push('st.name as state');
      if (hasCountries && hasCities) selectFields.push('co.name as country');
      
      // Sort by end date (kickoff_end_at) ascending - soonest ending first
      const rows = await base
        .select(selectFields)
        .orderByRaw(hasKickoffEndAt 
          ? 'CASE WHEN m.kickoff_end_at IS NULL THEN 1 ELSE 0 END'
          : 'CASE WHEN m.kickoff_at IS NULL THEN 1 ELSE 0 END')
        .orderBy(hasKickoffEndAt ? 'm.kickoff_end_at' : 'm.kickoff_at', 'asc')
        .orderBy('m.id', 'desc');

      // Capacity filter (best-effort): if match_participants + format columns exist, only keep matches with free slots.
      const hasParticipants = await k.schema.hasTable('match_participants').catch(() => false);
      const matchHasMaxPlayers = Object.prototype.hasOwnProperty.call(info, 'max_players');
      const matchHasTeamCount = Object.prototype.hasOwnProperty.call(info, 'team_count');
      const matchHasPlayersPerTeam = Object.prototype.hasOwnProperty.call(info, 'players_per_team');

      const ids = (rows || []).map(r => r.id).filter(Boolean);
      let countsByMatchId = new Map();
      if (hasParticipants && ids.length) {
        const counts = await k('match_participants')
          .whereIn('match_id', ids)
          .andWhere(function () {
            this.whereNull('status').orWhere('status', 'joined');
          })
          .groupBy('match_id')
          .select('match_id')
          .count({ c: '*' })
          .catch(() => []);
        countsByMatchId = new Map((counts || []).map(r => [Number(r.match_id), Number(r.c || 0)]));
      }

      const computeCapacity = (m) => {
        if (matchHasMaxPlayers) {
          const n = Number(m.max_players);
          if (Number.isFinite(n) && n > 0) return Math.trunc(n);
        }
        if (matchHasTeamCount && matchHasPlayersPerTeam) {
          const tc = Number(m.team_count);
          const ppt = Number(m.players_per_team);
          if (Number.isFinite(tc) && tc > 0 && Number.isFinite(ppt) && ppt > 0) return Math.trunc(tc * ppt);
        }
        return 2;
      };

      const filtered = (rows || []).filter(r => {
        if (!hasParticipants) return true;
        const capacity = computeCapacity(r);
        const joined = countsByMatchId.get(Number(r.id)) || 0;
        return !capacity || joined < capacity;
      }).map(r => {
        if (!hasParticipants) return r;
        const capacity = computeCapacity(r);
        const joined = countsByMatchId.get(Number(r.id)) || 0;
        return { ...r, participant_count: joined, max_players: capacity };
      });

      // Enrich with user and team names
      const enrichedRows = await Promise.all((filtered || []).map(async (row) => {
        const enriched = { ...row };
        
        // Fetch home user/team name
        if (row.home_user_id) {
          try {
            const hasUsers = await k.schema.hasTable('users').catch(() => false);
            if (hasUsers) {
              const userInfo = await k('users').columnInfo().catch(() => ({}));
              const selectCols = ['id'];
              if (userInfo.firstname) selectCols.push('firstname');
              if (userInfo.lastname) selectCols.push('lastname');
              if (userInfo.name) selectCols.push('name');
              if (userInfo.email) selectCols.push('email');
              
              const homeUser = await k('users').where('id', row.home_user_id).first(selectCols);
              if (homeUser) {
                const parts = [];
                if (homeUser.firstname) parts.push(homeUser.firstname);
                if (homeUser.lastname) parts.push(homeUser.lastname);
                enriched.home = parts.length > 0 ? parts.join(' ').trim() : (homeUser.name || homeUser.email || `User ${homeUser.id}`);
                enriched.home_id = homeUser.id;
              }
            }
          } catch (e) { /* ignore */ }
        }
        
        if (row.home_team_id) {
          try {
            const hasTeams = await k.schema.hasTable('teams').catch(() => false);
            if (hasTeams) {
              const homeTeam = await k('teams').where('id', row.home_team_id).first(['id', 'name']);
              if (homeTeam) {
                enriched.home = homeTeam.name || `Team ${homeTeam.id}`;
                enriched.home_id = homeTeam.id;
              }
            }
          } catch (e) { /* ignore */ }
        }
        
        // Fetch away user/team name
        if (row.away_user_id) {
          try {
            const hasUsers = await k.schema.hasTable('users').catch(() => false);
            if (hasUsers) {
              const userInfo = await k('users').columnInfo().catch(() => ({}));
              const selectCols = ['id'];
              if (userInfo.firstname) selectCols.push('firstname');
              if (userInfo.lastname) selectCols.push('lastname');
              if (userInfo.name) selectCols.push('name');
              if (userInfo.email) selectCols.push('email');
              
              const awayUser = await k('users').where('id', row.away_user_id).first(selectCols);
              if (awayUser) {
                const parts = [];
                if (awayUser.firstname) parts.push(awayUser.firstname);
                if (awayUser.lastname) parts.push(awayUser.lastname);
                enriched.away = parts.length > 0 ? parts.join(' ').trim() : (awayUser.name || awayUser.email || `User ${awayUser.id}`);
                enriched.away_id = awayUser.id;
              }
            }
          } catch (e) { /* ignore */ }
        }
        
        if (row.away_team_id) {
          try {
            const hasTeams = await k.schema.hasTable('teams').catch(() => false);
            if (hasTeams) {
              const awayTeam = await k('teams').where('id', row.away_team_id).first(['id', 'name']);
              if (awayTeam) {
                enriched.away = awayTeam.name || `Team ${awayTeam.id}`;
                enriched.away_id = awayTeam.id;
              }
            }
          } catch (e) { /* ignore */ }
        }
        
        return enriched;
      }));

      return res.json(enrichedRows);
    } catch (e) {
      console.error('[GET /open-matches] failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST /open-matches -> create an open friendly match in per-sport/city 'Open Matches' league
  // Body: { sportId, cityId, kickoff_at?, kickoff_end_at?, location_id? }
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

      // Determine default match format from sport variant
      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      let sportRow = null;
      if (hasSports) {
        sportRow = await k('sports').where({ id: sportId }).first().catch(() => null);
      }

      const sportName = String(sportRow?.name || '').toLowerCase();
      const variantType = String(sportRow?.variant_type || '').toLowerCase();
      const sportType = String(sportRow?.sport_type || sportRow?.type || '').toLowerCase();

      const parseVv = (s) => {
        const m = String(s || '').match(/(\d+)\s*v\s*(\d+)/i);
        if (!m) return null;
        const a = Number(m[1]);
        const b = Number(m[2]);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
        if (a !== b) return null;
        return a;
      };

      let teamCount = 2;
      let playersPerTeam = 1;
      let maxPlayers = 2;

      const vv = parseVv(variantType) || parseVv(sportName);
      const isDoubles = variantType.includes('doppel') || sportName.includes('doppel') || variantType.includes('mixed') || sportName.includes('mixed') || sportName.includes('padel');
      const isTeam = sportType.includes('team') || (vv != null);

      if (vv != null) {
        teamCount = 2;
        playersPerTeam = vv;
        maxPlayers = vv * 2;
      } else if (isDoubles) {
        teamCount = 2;
        playersPerTeam = 2;
        maxPlayers = 4;
      } else if (isTeam) {
        // Team sport but unknown size: allow creator override, default to 10 (5v5-like)
        teamCount = 2;
        playersPerTeam = Number(sportRow?.team_size || 0) || 5;
        maxPlayers = teamCount * playersPerTeam;
      } else {
        teamCount = 2;
        playersPerTeam = 1;
        maxPlayers = 2;
      }

      // Allow explicit override (match value is authoritative)
      const bodyMaxPlayers = req.body?.max_players != null ? Number(req.body.max_players) : null;
      if (Number.isFinite(bodyMaxPlayers) && bodyMaxPlayers > 1 && bodyMaxPlayers <= 200) {
        maxPlayers = Math.trunc(bodyMaxPlayers);
      }

      const rec = {
        league_id: leagueId,
        home_user_id: req.user.id || null,
        home_team_id: null,
        away_user_id: null,
        away_team_id: null,
        home_score: null,
        away_score: null,
      };

      if (Object.prototype.hasOwnProperty.call(info, 'max_players')) rec.max_players = maxPlayers;
      if (Object.prototype.hasOwnProperty.call(info, 'team_count')) rec.team_count = teamCount;
      if (Object.prototype.hasOwnProperty.call(info, 'players_per_team')) rec.players_per_team = playersPerTeam;
      if (Object.prototype.hasOwnProperty.call(info, 'allow_team_choice')) {
        rec.allow_team_choice = maxPlayers > 2 ? 1 : 0;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'kickoff_at')) {
        const when = req.body?.kickoff_at ? new Date(req.body.kickoff_at) : null;
        rec.kickoff_at = when && !isNaN(when) ? when.toISOString() : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'kickoff_end_at')) {
        const whenEnd = req.body?.kickoff_end_at ? new Date(req.body.kickoff_end_at) : null;
        rec.kickoff_end_at = whenEnd && !isNaN(whenEnd) ? whenEnd.toISOString() : null;
      }
      if (Object.prototype.hasOwnProperty.call(info, 'when_type') && req.body?.when_type) {
        rec.when_type = String(req.body.when_type).trim();
      }
      if (Object.prototype.hasOwnProperty.call(info, 'range_days') && req.body?.range_days) {
        rec.range_days = Number(req.body.range_days);
      }
      if (Object.prototype.hasOwnProperty.call(info, 'player_level') && req.body?.player_level) {
        rec.player_level = String(req.body.player_level).trim();
      }
      if (Object.prototype.hasOwnProperty.call(info, 'time_of_day') && req.body?.time_of_day) {
        rec.time_of_day = String(req.body.time_of_day).trim();
      }
      if (Object.prototype.hasOwnProperty.call(info, 'time_from') && req.body?.time_from) {
        rec.time_from = String(req.body.time_from).trim();
      }
      if (Object.prototype.hasOwnProperty.call(info, 'time_to') && req.body?.time_to) {
        rec.time_to = String(req.body.time_to).trim();
      }
      if (Object.prototype.hasOwnProperty.call(info, 'location_id') && req.body?.location_id) {
        rec.location_id = Number(req.body.location_id);
      }
      if (Object.prototype.hasOwnProperty.call(info, 'status')) rec.status = 'open';
      if (Object.prototype.hasOwnProperty.call(info, 'created_at')) rec.created_at = new Date().toISOString();

      const ins = await k('matches').insert(rec);
      const id = Array.isArray(ins) ? ins[0] : ins;

      // Insert host as participant (if table exists)
      const hasParticipants = await k.schema.hasTable('match_participants').catch(() => false);
      if (hasParticipants) {
        await k('match_participants')
          .insert({
            match_id: id,
            user_id: req.user.id,
            // Creator is always Team 1 in MVP1 open matches
            team_index: 1,
            status: 'joined',
            joined_at: new Date().toISOString(),
          })
          .catch(() => {});
      }

      // Save availability slots if provided (match creation availability)
      const availability = req.body?.availability || [];
      if (Array.isArray(availability) && availability.length > 0) {
        const hasDays = await k.schema.hasTable('match_availability_days').catch(() => false);
        const hasWindows = await k.schema.hasTable('match_availability_windows').catch(() => false);
        if (hasDays && hasWindows) {
          // Group availability by date
          const grouped = {};
          availability.forEach((slot) => {
            if (!slot.date || !slot.timeStart || !slot.timeEnd) return;
            if (!grouped[slot.date]) grouped[slot.date] = [];
            grouped[slot.date].push({ timeStart: slot.timeStart, timeEnd: slot.timeEnd });
          });

          // Insert days and windows
          for (const [date, windows] of Object.entries(grouped)) {
            const dayIns = await k('match_availability_days').insert({
              match_id: id,
              user_id: req.user.id,
              date,
              created_at: new Date().toISOString()
            });
            const dayId = Array.isArray(dayIns) ? dayIns[0] : dayIns;

            for (const w of windows) {
              await k('match_availability_windows').insert({
                day_id: dayId,
                time_start: w.timeStart,
                time_end: w.timeEnd,
                created_at: new Date().toISOString()
              });
            }
          }
        }
      }

      const row = await k('matches').where({ id }).first();
      return res.status(201).json(row);
    } catch (e) {
      console.error('[POST /open-matches] failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  return router;
};
