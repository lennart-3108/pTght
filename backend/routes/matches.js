const express = require('express');
const { isAuthenticated } = require('../middleware/auth');

module.exports = function matchesRoutes({ db }) {
  const router = express.Router();

  function getKnex() {
    const dbArg = db;
    if (!dbArg) return null;
    if (dbArg.knex && dbArg.knex.client) return dbArg.knex;
    if (dbArg.client) return dbArg;
    if (typeof dbArg === 'function' && typeof dbArg.raw === 'function') return dbArg;
    return null;
  }

  // Helpers: compute current ISO week (Mon-Sun) window and weekly-limit checks
  function getCurrentWeekWindow() {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - day);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday.toISOString(), end: sunday.toISOString() };
  }

  async function isCommunityLeague(k, leagueId) {
    const l = await k('leagues').where('id', leagueId).first().catch(() => null);
    if (!l) return false;
    return !!(l.publicState === 'community' || l.is_community || l.isCommunity);
  }

  async function hasWeeklyMatchForUser(k, leagueId, userId) {
    const info = await k('matches').columnInfo().catch(() => ({}));
    const hasHomeUserId = !!info.home_user_id;
    const { start, end } = getCurrentWeekWindow();
    const q = k('matches')
      .where({ league_id: leagueId })
      .where(function () {
        if (hasHomeUserId) this.where('home_user_id', userId).orWhere('away_user_id', userId);
        else this.where('home', String(userId)).orWhere('away', String(userId));
      })
      .where(function () {
        const possibleTs = [];
        if (Object.prototype.hasOwnProperty.call(info, 'completed_at')) possibleTs.push('completed_at');
        if (Object.prototype.hasOwnProperty.call(info, 'kickoff_at')) possibleTs.push('kickoff_at');
        if (Object.prototype.hasOwnProperty.call(info, 'created_at')) possibleTs.push('created_at');
        if (possibleTs.length === 0) {
          this.whereNotNull('id');
        } else {
          this.where(function () {
            for (const c of possibleTs) this.orWhereBetween(c, [start, end]);
          });
        }
      })
      .count({ c: '*' });
    const row = await q;
    const cnt = Array.isArray(row) ? (row[0].c || 0) : (row.c || 0);
    return Number(cnt) >= 1;
  }

  router.post('/', isAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const leagueId = req.body?.leagueId;
    if (!leagueId) return res.status(400).json({ error: 'leagueId fehlt' });
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const member = await k('user_leagues').where({ league_id: leagueId, user_id: userId }).first();
      if (!member) return res.status(403).json({ error: 'Nur Mitglieder der Liga können Spiele erstellen' });
      // Weekly limit enforcement for community leagues
      if (await isCommunityLeague(k, leagueId)) {
        const reached = await hasWeeklyMatchForUser(k, leagueId, userId);
        if (reached) return res.status(429).json({ error: 'WEEKLY_LIMIT_REACHED' });
      }
      const league = await k('leagues as l')
        .leftJoin('sports as s', 's.id', 'l.sport_id')
        .select({ id: 'l.id' }, { sportType: 's.type' })
        .where('l.id', leagueId)
        .first();
      if (!league) return res.status(404).json({ error: 'Liga nicht gefunden' });
      const sportType = league.sportType || 'Single';
      let home_user_id = null, home_team_id = null;
      if (sportType === 'Team') {
        const team = await k('teams as t')
          .leftJoin('team_members as tm', 'tm.team_id', 't.id')
          .where('t.league_id', leagueId)
          .andWhere('tm.user_id', userId)
          .andWhere('tm.is_captain', 1)
          .select('t.id')
          .first();
        if (!team) return res.status(403).json({ error: 'Nur Captains können Team-Spiele erstellen' });
        home_team_id = team.id;
      } else {
        home_user_id = userId;
      }
      const info = await k('matches').columnInfo().catch(() => ({}));
      const rec = { league_id: leagueId, kickoff_at: null, home_user_id, home_team_id, away_user_id: null, away_team_id: null, home_score: null, away_score: null };
      if (Object.prototype.hasOwnProperty.call(info, 'status')) rec.status = 'open';
      if (Object.prototype.hasOwnProperty.call(info, 'created_at')) rec.created_at = new Date().toISOString();
      // season_id: set to current year season if seasons table exists
      try {
        const hasSeasons = await k.schema.hasTable('seasons');
        if (hasSeasons && Object.prototype.hasOwnProperty.call(info, 'season_id')) {
          const year = new Date().getFullYear();
          const s = await k('seasons').where({ league_id: leagueId, name: String(year) }).first();
          if (s && s.id) rec.season_id = s.id;
        }
      } catch {}
      const [id] = await k('matches').insert(rec);
      const match = await k('matches').where({ id }).first();
      res.status(201).json(match);
    } catch (e) {
      console.error('Create match error:', e);
      res.status(500).json({ error: 'Datenbankfehler', details: e && e.message });
    }
  });

  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      // inspect matches table to avoid selecting non-existent columns
      const info = await k('matches').columnInfo().catch(() => ({}));
      const hasHomeText = Object.prototype.hasOwnProperty.call(info, 'home');
      const hasAwayText = Object.prototype.hasOwnProperty.call(info, 'away');
      // build safe display-name expressions depending on users table columns
      const usersInfo = await k('users').columnInfo().catch(() => ({}));
      const hasFirst = Object.prototype.hasOwnProperty.call(usersInfo, 'firstname');
      const hasLast = Object.prototype.hasOwnProperty.call(usersInfo, 'lastname');
      const hasName = Object.prototype.hasOwnProperty.call(usersInfo, 'name');
      const hasEmail = Object.prototype.hasOwnProperty.call(usersInfo, 'email');
      const fullNameExpr = (hasFirst || hasLast)
        ? "NULLIF(TRIM(COALESCE(u.firstname,'') || ' ' || COALESCE(u.lastname,'')), '')"
        : null;

      const makeDisplayForAlias = (alias) => {
        const parts = [];
        if (fullNameExpr) parts.push(fullNameExpr.replace(/u\./g, `${alias}.`));
        if (hasName) parts.push(`${alias}.name`);
        if (hasEmail) parts.push(`${alias}.email`);
        if (!parts.length) parts.push("'User'");
        return `COALESCE(${parts.join(', ')})`;
      };

      const homeDisplay = makeDisplayForAlias('uh');
      const awayDisplay = makeDisplayForAlias('ua');

      const match = await k('matches as m')
        .leftJoin('leagues as l', 'l.id', 'm.league_id')
        .modify(qb => { if (hasSports) qb.leftJoin('sports as s', 's.id', 'l.sport_id'); })
        .leftJoin({ uh: 'users' }, 'uh.id', 'm.home_user_id')
        .leftJoin({ ua: 'users' }, 'ua.id', 'm.away_user_id')
        .select(
          'm.id',
          'm.kickoff_at',
          'm.home_user_id',
          'm.away_user_id',
          // include home/away text only if columns exist to avoid errors
          ...(hasHomeText ? ['m.home as home'] : [k.raw('NULL as home')]),
          ...(hasAwayText ? ['m.away as away'] : [k.raw('NULL as away')]),
          'm.home_score',
          'm.away_score',
          { leagueId: 'm.league_id' },
          { league: 'l.name' },
          ...(hasSports ? [{ sport: 's.name' }] : [k.raw("'' as sport")]),
          k.raw(`${homeDisplay} as home_user_name`),
          k.raw(`${awayDisplay} as away_user_name`)
        )
        .where('m.id', id)
        .first();
      if (!match) return res.status(404).json({ error: 'Match nicht gefunden' });
      res.json(match);
    } catch (e) {
      console.error('Error fetching match:', e);
      res.status(500).json({ error: 'Datenbankfehler', details: e && e.message });
    }
  });

  router.post('/:id/join', isAuthenticated, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.user.id;
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      // Robust sport type detection (some schemas have sports.sport_type or sports.team_size, not sports.type)
      const sInfoJoin = hasSports ? await k('sports').columnInfo().catch(() => ({})) : {};
      const gRaw = await k('matches as m')
        .leftJoin('leagues as l', 'l.id', 'm.league_id')
        .modify(qb => { if (hasSports) qb.leftJoin('sports as s', 's.id', 'l.sport_id'); })
        .select([
          'm.id', 'm.league_id', 'm.home_user_id', 'm.home_team_id', 'm.away_user_id', 'm.away_team_id',
          ...(Object.prototype.hasOwnProperty.call(sInfoJoin, 'sport_type') ? [{ sport_type: 's.sport_type' }] : [k.raw('NULL as sport_type')]),
          ...(Object.prototype.hasOwnProperty.call(sInfoJoin, 'team_size') ? [{ team_size: 's.team_size' }] : [k.raw('NULL as team_size')]),
          ...(Object.prototype.hasOwnProperty.call(sInfoJoin, 'type') ? [{ type: 's.type' }] : [k.raw('NULL as type')])
        ])
        .where('m.id', gameId)
        .first();
      if (!gRaw) return res.status(404).json({ error: 'Match nicht gefunden' });
      const sportType = (gRaw.sport_type ? String(gRaw.sport_type) : (gRaw.type ? String(gRaw.type) : (Number(gRaw.team_size) > 1 ? 'Team' : 'Single')));
      const g = { ...gRaw, sportType };
      if (!g) return res.status(404).json({ error: 'Match nicht gefunden' });
      const member = await k('user_leagues').where({ league_id: g.league_id, user_id: userId }).first();
      if (!member) return res.status(403).json({ error: 'Nur Mitglieder der Liga können Matches beitreten' });
      // Weekly limit for community leagues
      if (await isCommunityLeague(k, g.league_id)) {
        const reached = await hasWeeklyMatchForUser(k, g.league_id, userId);
        if (reached) return res.status(429).json({ error: 'WEEKLY_LIMIT_REACHED' });
      }
      const hasAway = g.away_user_id != null || g.away_team_id != null;
      if (hasAway) return res.status(409).json({ error: 'Match ist bereits voll' });
      if (g.sportType === 'Team') {
        const team = await k('teams as t')
          .leftJoin('team_members as tm', 'tm.team_id', 't.id')
          .where('t.league_id', g.league_id)
          .andWhere('tm.user_id', userId)
          .andWhere('tm.is_captain', 1)
          .select('t.id')
          .first();
        if (!team) return res.status(403).json({ error: 'Nur Captains können Team-Matches beitreten' });
        if (String(team.id) === String(g.home_team_id)) return res.status(400).json({ error: 'Gleiche Mannschaft nicht erlaubt' });
        await k('matches').where({ id: gameId }).update({ away_team_id: team.id });
      } else {
        if (String(userId) === String(g.home_user_id)) return res.status(400).json({ error: 'Gleicher User nicht erlaubt' });
        await k('matches').where({ id: gameId }).update({ away_user_id: userId });
      }
      const updated = await k('matches').where({ id: gameId }).first();
      // Enrich like GET /:id so client preserves names without reload
      try {
        const usersInfo = await k('users').columnInfo().catch(() => ({}));
        const hasFirst = Object.prototype.hasOwnProperty.call(usersInfo, 'firstname');
        const hasLast = Object.prototype.hasOwnProperty.call(usersInfo, 'lastname');
        const hasName = Object.prototype.hasOwnProperty.call(usersInfo, 'name');
        const hasEmail = Object.prototype.hasOwnProperty.call(usersInfo, 'email');
        const fullNameExpr = (hasFirst || hasLast)
          ? "NULLIF(TRIM(COALESCE(u.firstname,'') || ' ' || COALESCE(u.lastname,'')), '')"
          : null;
        const makeDisplayForAlias = (alias) => {
          const parts = [];
          if (fullNameExpr) parts.push(fullNameExpr.replace(/u\./g, `${alias}.`));
          if (hasName) parts.push(`${alias}.name`);
          if (hasEmail) parts.push(`${alias}.email`);
          if (!parts.length) parts.push("'User'");
          return `COALESCE(${parts.join(', ')})`;
        };
        const homeDisplay = makeDisplayForAlias('uh');
        const awayDisplay = makeDisplayForAlias('ua');
        const info = await k('matches').columnInfo().catch(() => ({}));
        const hasHomeText = Object.prototype.hasOwnProperty.call(info, 'home');
        const hasAwayText = Object.prototype.hasOwnProperty.call(info, 'away');
        const matchInfo = await k('matches as m')
          .leftJoin('leagues as l', 'l.id', 'm.league_id')
          .modify(qb => { if (hasSports) qb.leftJoin('sports as s', 's.id', 'l.sport_id'); })
          .leftJoin({ uh: 'users' }, 'uh.id', 'm.home_user_id')
          .leftJoin({ ua: 'users' }, 'ua.id', 'm.away_user_id')
          .select(
            'm.id', 'm.kickoff_at', 'm.home_user_id', 'm.away_user_id',
            ...(hasHomeText ? ['m.home as home'] : [k.raw('NULL as home')]),
            ...(hasAwayText ? ['m.away as away'] : [k.raw('NULL as away')]),
            'm.home_score', 'm.away_score',
            { leagueId: 'm.league_id' }, { league: 'l.name' }, ...(hasSports ? [{ sport: 's.name' }] : [k.raw("'' as sport")]),
            k.raw(`${homeDisplay} as home_user_name`),
            k.raw(`${awayDisplay} as away_user_name`)
          )
          .where('m.id', gameId)
          .first();
        return res.json(matchInfo || updated);
      } catch (_) {
        return res.json(updated);
      }
    } catch (e) {
      console.error('Join match error:', e);
      res.status(500).json({ error: 'Datenbankfehler', details: e && e.message });
    }
  });

  // Accept a proposed match (challenge). Only the challenged participant may accept.
  router.post('/:id/accept', isAuthenticated, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.user.id;
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

      const info = await k('matches').columnInfo().catch(() => ({}));
      const hasStatus = Object.prototype.hasOwnProperty.call(info, 'status');
      const m = await k('matches').where({ id: gameId }).first();
      if (!m) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      // ensure user is participant
      const isParticipant = (String(m.home_user_id) === String(userId)) || (String(m.away_user_id) === String(userId))
        || (String(m.home) === String(userId)) || (String(m.away) === String(userId));
      if (!isParticipant) return res.status(403).json({ error: 'ONLY_PARTICIPANTS' });

      // if status exists, require 'proposed' or 'open'
      if (hasStatus) {
        const st = m.status || 'open';
        if (!['proposed', 'open', 'scheduled'].includes(st)) return res.status(409).json({ error: 'INVALID_STATE' });
      }

      const patch = {};
      if (hasStatus) patch.status = 'scheduled';
      await k('matches').where({ id: gameId }).update(patch);
      const updated = await k('matches').where({ id: gameId }).first();
      return res.json(updated);
    } catch (e) {
      console.error('Accept match error:', e);
      return res.status(500).json({ error: 'DB_ERROR', details: e && e.message });
    }
  });

  // Decline a proposed match; keep record with status declined or delete if no status column
  router.post('/:id/decline', isAuthenticated, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.user.id;
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const info = await k('matches').columnInfo().catch(() => ({}));
      const hasStatus = Object.prototype.hasOwnProperty.call(info, 'status');
      const m = await k('matches').where({ id: gameId }).first();
      if (!m) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const isParticipant = (String(m.home_user_id) === String(userId)) || (String(m.away_user_id) === String(userId))
        || (String(m.home) === String(userId)) || (String(m.away) === String(userId));
      if (!isParticipant) return res.status(403).json({ error: 'ONLY_PARTICIPANTS' });
      if (hasStatus) {
        await k('matches').where({ id: gameId }).update({ status: 'declined' });
        const updated = await k('matches').where({ id: gameId }).first();
        return res.json(updated);
      } else {
        await k('matches').where({ id: gameId }).del();
        return res.json({ deleted: true });
      }
    } catch (e) {
      console.error('Decline match error:', e);
      return res.status(500).json({ error: 'DB_ERROR', details: e && e.message });
    }
  });

  // Schedule a match (set kickoff_at). Allowed to participants or team captains.
  router.post('/:id/schedule', isAuthenticated, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.user.id;
    const { kickoff_at } = req.body || {};
    if (!kickoff_at) return res.status(400).json({ error: 'kickoff_at required' });
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      const sInfoSched = hasSports ? await k('sports').columnInfo().catch(() => ({})) : {};
      const gRaw = await k('matches as m')
        .leftJoin('leagues as l', 'l.id', 'm.league_id')
        .modify(qb => { if (hasSports) qb.leftJoin('sports as s', 's.id', 'l.sport_id'); })
        .select([
          'm.id', 'm.league_id', 'm.home_user_id', 'm.away_user_id', 'm.home_team_id', 'm.away_team_id',
          ...(Object.prototype.hasOwnProperty.call(sInfoSched, 'sport_type') ? [{ sport_type: 's.sport_type' }] : [k.raw('NULL as sport_type')]),
          ...(Object.prototype.hasOwnProperty.call(sInfoSched, 'team_size') ? [{ team_size: 's.team_size' }] : [k.raw('NULL as team_size')]),
          ...(Object.prototype.hasOwnProperty.call(sInfoSched, 'type') ? [{ type: 's.type' }] : [k.raw('NULL as type')])
        ])
        .where('m.id', gameId)
        .first();
      if (!gRaw) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const sportType = (gRaw.sport_type ? String(gRaw.sport_type) : (gRaw.type ? String(gRaw.type) : (Number(gRaw.team_size) > 1 ? 'Team' : 'Single')));
      const g = { ...gRaw, sportType };
      if (!g) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      // permission: participant or captain for team sport
      if (g.sportType === 'Team') {
        const cap = await k('team_members')
          .whereIn('team_id', [g.home_team_id, g.away_team_id].filter(Boolean))
          .andWhere({ user_id: userId, is_captain: 1 })
          .first();
        if (!cap) return res.status(403).json({ error: 'ONLY_CAPTAIN_CAN_SCHEDULE' });
      } else {
        const isParticipant = (String(g.home_user_id) === String(userId)) || (String(g.away_user_id) === String(userId));
        if (!isParticipant) return res.status(403).json({ error: 'ONLY_PLAYERS_CAN_SCHEDULE' });
      }

      const info = await k('matches').columnInfo().catch(() => ({}));
      if (!Object.prototype.hasOwnProperty.call(info, 'kickoff_at')) return res.status(400).json({ error: 'NO_KICKOFF_COLUMN' });
      const patch = { kickoff_at: new Date(kickoff_at).toISOString() };
      if (Object.prototype.hasOwnProperty.call(info, 'status')) patch.status = 'scheduled';
      // season_id safeguard
      if (Object.prototype.hasOwnProperty.call(info, 'season_id') && !g.season_id) {
        try {
          const hasSeasons = await k.schema.hasTable('seasons');
          if (hasSeasons) {
            const year = new Date().getFullYear();
            const s = await k('seasons').where({ league_id: g.league_id, name: String(year) }).first();
            if (s && s.id) patch.season_id = s.id;
          }
        } catch {}
      }
  await k('matches').where({ id: gameId }).update(patch);
  const updated = await k('matches').where({ id: gameId }).first();

      // Send schedule email to both participants if possible
      try {
        const ctx = (global._app_ctx || (req.app && req.app.locals && req.app.locals.ctx) || {});
        const sendMail = ctx.sendMail;
        const dbk = k;
        if (typeof sendMail === 'function') {
          // resolve participant emails
          const users = await dbk('users').whereIn('id', [g.home_user_id, g.away_user_id].filter(Boolean)).select('id','email','firstname','lastname','name');
          const subject = 'Match geplant';
          const when = new Date(patch.kickoff_at).toLocaleString();
          for (const u of users || []) {
            const name = (u.firstname || u.lastname) ? `${u.firstname || ''} ${u.lastname || ''}`.trim() : (u.name || u.email || 'Spieler');
            const body = `<p>Hallo ${name},</p><p>Dein Match (ID ${g.id}) wurde geplant für <b>${when}</b>.</p>`;
            await sendMail(u.email, subject, body);
          }
        }
      } catch (e) {
        console.warn('schedule mail failed:', e && (e.message || e));
      }
      // Return enriched projection like GET /:id so client keeps names without reload
      try {
        const usersInfo = await k('users').columnInfo().catch(() => ({}));
        const hasFirst = Object.prototype.hasOwnProperty.call(usersInfo, 'firstname');
        const hasLast = Object.prototype.hasOwnProperty.call(usersInfo, 'lastname');
        const hasName = Object.prototype.hasOwnProperty.call(usersInfo, 'name');
        const hasEmail = Object.prototype.hasOwnProperty.call(usersInfo, 'email');
        const fullNameExpr = (hasFirst || hasLast)
          ? "NULLIF(TRIM(COALESCE(u.firstname,'') || ' ' || COALESCE(u.lastname,'')), '')"
          : null;
        const makeDisplayForAlias = (alias) => {
          const parts = [];
          if (fullNameExpr) parts.push(fullNameExpr.replace(/u\./g, `${alias}.`));
          if (hasName) parts.push(`${alias}.name`);
          if (hasEmail) parts.push(`${alias}.email`);
          if (!parts.length) parts.push("'User'");
          return `COALESCE(${parts.join(', ')})`;
        };
        const homeDisplay = makeDisplayForAlias('uh');
        const awayDisplay = makeDisplayForAlias('ua');
        const info = await k('matches').columnInfo().catch(() => ({}));
        const hasHomeText = Object.prototype.hasOwnProperty.call(info, 'home');
        const hasAwayText = Object.prototype.hasOwnProperty.call(info, 'away');
        const matchInfo = await k('matches as m')
          .leftJoin('leagues as l', 'l.id', 'm.league_id')
          .modify(qb => { if (hasSports) qb.leftJoin('sports as s', 's.id', 'l.sport_id'); })
          .leftJoin({ uh: 'users' }, 'uh.id', 'm.home_user_id')
          .leftJoin({ ua: 'users' }, 'ua.id', 'm.away_user_id')
          .select(
            'm.id', 'm.kickoff_at', 'm.home_user_id', 'm.away_user_id',
            ...(hasHomeText ? ['m.home as home'] : [k.raw('NULL as home')]),
            ...(hasAwayText ? ['m.away as away'] : [k.raw('NULL as away')]),
            'm.home_score', 'm.away_score',
            { leagueId: 'm.league_id' }, { league: 'l.name' }, ...(hasSports ? [{ sport: 's.name' }] : [k.raw("'' as sport")]),
            k.raw(`${homeDisplay} as home_user_name`),
            k.raw(`${awayDisplay} as away_user_name`)
          )
          .where('m.id', gameId)
          .first();
        return res.json(matchInfo || updated);
      } catch (_) {
        return res.json(updated);
      }
    } catch (e) {
      console.error('Schedule match error:', e);
      return res.status(500).json({ error: 'DB_ERROR', details: e && e.message });
    }
  });

  // Can current user submit a result for this match?
  router.get('/:id/can-submit', isAuthenticated, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.user.id;
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      const sInfoCS = hasSports ? await k('sports').columnInfo().catch(() => ({})) : {};
      const gRawCS = await k('matches as m')
        .leftJoin('leagues as l', 'l.id', 'm.league_id')
        .modify(qb => { if (hasSports) qb.leftJoin('sports as s', 's.id', 'l.sport_id'); })
        .select([
          'm.id', 'm.league_id', 'm.kickoff_at',
          'm.home_user_id', 'm.away_user_id',
          'm.home_team_id', 'm.away_team_id',
          'm.home_score', 'm.away_score',
          ...(Object.prototype.hasOwnProperty.call(sInfoCS, 'sport_type') ? [{ sport_type: 's.sport_type' }] : [k.raw('NULL as sport_type')]),
          ...(Object.prototype.hasOwnProperty.call(sInfoCS, 'team_size') ? [{ team_size: 's.team_size' }] : [k.raw('NULL as team_size')]),
          ...(Object.prototype.hasOwnProperty.call(sInfoCS, 'type') ? [{ type: 's.type' }] : [k.raw('NULL as type')])
        ])
        .where('m.id', gameId)
        .first();
      if (!gRawCS) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const sportType = (gRawCS.sport_type ? String(gRawCS.sport_type) : (gRawCS.type ? String(gRawCS.type) : (Number(gRawCS.team_size) > 1 ? 'Team' : 'Single')));
      const g = { ...gRawCS, sportType };
      if (!g) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      const member = await k('user_leagues').where({ league_id: g.league_id, user_id: userId }).first();
      if (!member) return res.json({ canSubmit: false, reason: 'LEAGUE_MEMBERS_ONLY' });

      // must be pending
      if (g.home_score != null || g.away_score != null) {
        return res.json({ canSubmit: false, reason: 'ALREADY_RECORDED' });
      }

      // require that a kickoff date is set before results can be submitted
      if (!g.kickoff_at) {
        return res.json({ canSubmit: false, reason: 'KICKOFF_NOT_SET' });
      }

      // must have opponent assigned
      if (g.sportType === 'Team') {
        if (g.home_team_id == null || g.away_team_id == null) {
          return res.json({ canSubmit: false, reason: 'OPPONENT_NOT_ASSIGNED' });
        }
        const cap = await k('team_members')
          .whereIn('team_id', [g.home_team_id, g.away_team_id])
          .andWhere({ user_id: userId, is_captain: 1 })
          .first();
        if (!cap) return res.json({ canSubmit: false, reason: 'ONLY_CAPTAIN_CAN_SUBMIT' });
        return res.json({ canSubmit: true });
      } else {
        if (g.home_user_id == null || g.away_user_id == null) {
          return res.json({ canSubmit: false, reason: 'OPPONENT_NOT_ASSIGNED' });
        }
        const isPlayer = (String(userId) === String(g.home_user_id)) || (String(userId) === String(g.away_user_id));
        if (!isPlayer) return res.json({ canSubmit: false, reason: 'ONLY_PLAYERS_CAN_SUBMIT' });
        return res.json({ canSubmit: true });
      }
    } catch (e) {
      console.error('Can submit check error:', e);
      return res.status(500).json({ error: 'DB_ERROR', details: e && e.message });
    }
  });

  // Submit result for a pending match
  // Rules:
  // - Match must exist and be pending (no scores yet)
  // - For Single sport: only home_user_id or away_user_id can submit
  // - For Team sport: only captains of home_team_id or away_team_id can submit
  // - Requires league membership
  router.post('/:id/result', isAuthenticated, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.user.id;
    const { home_score, away_score } = req.body || {};
    const toInt = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      const t = Math.max(0, Math.min(999, Math.trunc(n)));
      return t;
    };
    const hs = toInt(home_score);
    const as = toInt(away_score);
    if (hs == null || as == null) {
      return res.status(400).json({ error: 'INVALID_SCORE' });
    }
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      const sInfoRes = hasSports ? await k('sports').columnInfo().catch(() => ({})) : {};
      const gRawRes = await k('matches as m')
        .leftJoin('leagues as l', 'l.id', 'm.league_id')
        .modify(qb => { if (hasSports) qb.leftJoin('sports as s', 's.id', 'l.sport_id'); })
        .select([
          'm.id', 'm.league_id', 'm.kickoff_at',
          'm.home_user_id', 'm.away_user_id',
          'm.home_team_id', 'm.away_team_id',
          'm.home_score', 'm.away_score',
          ...(Object.prototype.hasOwnProperty.call(sInfoRes, 'sport_type') ? [{ sport_type: 's.sport_type' }] : [k.raw('NULL as sport_type')]),
          ...(Object.prototype.hasOwnProperty.call(sInfoRes, 'team_size') ? [{ team_size: 's.team_size' }] : [k.raw('NULL as team_size')]),
          ...(Object.prototype.hasOwnProperty.call(sInfoRes, 'type') ? [{ type: 's.type' }] : [k.raw('NULL as type')])
        ])
        .where('m.id', gameId)
        .first();
      if (!gRawRes) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const sportType = (gRawRes.sport_type ? String(gRawRes.sport_type) : (gRawRes.type ? String(gRawRes.type) : (Number(gRawRes.team_size) > 1 ? 'Team' : 'Single')));
      const g = { ...gRawRes, sportType };
      if (!g) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      // must be league member
      const member = await k('user_leagues').where({ league_id: g.league_id, user_id: userId }).first();
      if (!member) return res.status(403).json({ error: 'LEAGUE_MEMBERS_ONLY' });

      // must be pending
      if (g.home_score != null || g.away_score != null) {
        return res.status(409).json({ error: 'ALREADY_RECORDED' });
      }

      // must have a scheduled kickoff before recording result
      if (!g.kickoff_at) {
        return res.status(400).json({ error: 'KICKOFF_REQUIRED_BEFORE_RESULT' });
      }

      // permission check + both sides assigned
      if (g.sportType === 'Team') {
        // is user captain of either team?
        const teamIds = [g.home_team_id, g.away_team_id].filter(v => v != null);
        if (teamIds.length < 2) return res.status(400).json({ error: 'OPPONENT_NOT_ASSIGNED' });
        if (!teamIds.length) return res.status(400).json({ error: 'TEAMS_NOT_ASSIGNED' });
        const cap = await k('team_members')
          .whereIn('team_id', teamIds)
          .andWhere({ user_id: userId, is_captain: 1 })
          .first();
        if (!cap) return res.status(403).json({ error: 'ONLY_CAPTAIN_CAN_SUBMIT' });
      } else {
        // single: must be one of the players
        if (g.home_user_id == null || g.away_user_id == null) return res.status(400).json({ error: 'OPPONENT_NOT_ASSIGNED' });
        const isPlayer = (String(userId) === String(g.home_user_id)) || (String(userId) === String(g.away_user_id));
        if (!isPlayer) return res.status(403).json({ error: 'ONLY_PLAYERS_CAN_SUBMIT' });
      }

      // update scores (and status if such column exists)
      const info = await k('matches').columnInfo().catch(() => ({}));
      const hasStatus = Object.prototype.hasOwnProperty.call(info, 'status');
      const patch = { home_score: hs, away_score: as };
      if (hasStatus) patch.status = 'completed';
  await k('matches').where({ id: gameId }).update(patch);

      // return enriched projection like GET /:id
      const usersInfo = await k('users').columnInfo().catch(() => ({}));
      const hasFirst = Object.prototype.hasOwnProperty.call(usersInfo, 'firstname');
      const hasLast = Object.prototype.hasOwnProperty.call(usersInfo, 'lastname');
      const hasName = Object.prototype.hasOwnProperty.call(usersInfo, 'name');
      const hasEmail = Object.prototype.hasOwnProperty.call(usersInfo, 'email');
      const fullNameExpr = (hasFirst || hasLast)
        ? "NULLIF(TRIM(COALESCE(u.firstname,'') || ' ' || COALESCE(u.lastname,'')), '')"
        : null;
      const makeDisplayForAlias = (alias) => {
        const parts = [];
        if (fullNameExpr) parts.push(fullNameExpr.replace(/u\./g, `${alias}.`));
        if (hasName) parts.push(`${alias}.name`);
        if (hasEmail) parts.push(`${alias}.email`);
        if (!parts.length) parts.push("'User'");
        return `COALESCE(${parts.join(', ')})`;
      };
      const homeDisplay = makeDisplayForAlias('uh');
      const awayDisplay = makeDisplayForAlias('ua');
      const mInfo = await k('matches').columnInfo().catch(() => ({}));
      const hasHomeText = Object.prototype.hasOwnProperty.call(mInfo, 'home');
      const hasAwayText = Object.prototype.hasOwnProperty.call(mInfo, 'away');
      const matchInfo = await k('matches as m')
        .leftJoin('leagues as l', 'l.id', 'm.league_id')
        .modify(qb => { if (hasSports) qb.leftJoin('sports as s', 's.id', 'l.sport_id'); })
        .leftJoin({ uh: 'users' }, 'uh.id', 'm.home_user_id')
        .leftJoin({ ua: 'users' }, 'ua.id', 'm.away_user_id')
        .select(
          'm.id', 'm.kickoff_at', 'm.home_user_id', 'm.away_user_id',
          ...(hasHomeText ? ['m.home as home'] : [k.raw('NULL as home')]),
          ...(hasAwayText ? ['m.away as away'] : [k.raw('NULL as away')]),
          'm.home_score', 'm.away_score',
          { leagueId: 'm.league_id' }, { league: 'l.name' }, ...(hasSports ? [{ sport: 's.name' }] : [k.raw("'' as sport")]),
          k.raw(`${homeDisplay} as home_user_name`),
          k.raw(`${awayDisplay} as away_user_name`)
        )
        .where('m.id', gameId)
        .first();
      // Send result email
      try {
        const ctx = (global._app_ctx || (req.app && req.app.locals && req.app.locals.ctx) || {});
        const sendMail = ctx.sendMail;
        if (typeof sendMail === 'function') {
          const dbk = getKnex();
          const users = await dbk('users').whereIn('id', [g.home_user_id, g.away_user_id].filter(Boolean)).select('id','email','firstname','lastname','name');
          const subject = 'Match abgeschlossen';
          const score = `${hs}:${as}`;
          for (const u of users || []) {
            const name = (u.firstname || u.lastname) ? `${u.firstname || ''} ${u.lastname || ''}`.trim() : (u.name || u.email || 'Spieler');
            const body = `<p>Hallo ${name},</p><p>Dein Match (ID ${g.id}) wurde abgeschlossen. Ergebnis: <b>${score}</b>.</p>`;
            await sendMail(u.email, subject, body);
          }
        }
      } catch (e) {
        console.warn('result mail failed:', e && (e.message || e));
      }
      return res.json(matchInfo || { id: gameId, home_score: hs, away_score: as });
    } catch (e) {
      console.error('Submit result error:', e);
      return res.status(500).json({ error: 'DB_ERROR', details: e && e.message });
    }
  });

  return router;
};
