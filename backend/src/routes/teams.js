const express = require('express');
const { createMiddleware } = require('./middleware');

module.exports = function teamsRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;
  const { requireAuth } = createMiddleware(ctx);

  // POST /teams - create a team (any authenticated user)
  router.post('/', requireAuth, async (req, res) => {
    try {
      const k = require('../../db') || db;
      const { name, league_id, sport_id, city_id } = req.body || {};
      if (!name || !league_id) return res.status(400).json({ error: 'MISSING_FIELDS' });
      const insert = await k('teams').insert({ name, league_id, sport_id: sport_id || null, city_id: city_id || null, captain_user_id: req.user.id }).returning('*').catch(() => null);
      // sqlite returns array of ids; fetch created row
      let team;
      if (!insert) {
        // fallback for sqlite
        const id = await k('teams').max('id as id').first().then(r => r && r.id);
        team = await k('teams').where({ id }).first();
      } else if (Array.isArray(insert)) {
        const id = insert[0];
        team = await k('teams').where({ id }).first();
      } else team = insert;

      res.json({ team });
    } catch (e) {
      console.error('Create team failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR', details: (e && e.message) || String(e) });
    }
  });

  // GET /teams - list teams (optional filters: league_id, sport_id, city_id)
  router.get('/', async (req, res) => {
    try {
      const k = require('../../db') || db;
      const { league_id, sport_id, city_id } = req.query || {};
      // detect columns available on teams table so we don't reference missing columns
      const cols = await k('teams').columnInfo().catch(() => ({}));
      const selectCols = ['t.id', 't.name', 't.league_id', 't.sport_id', 't.city_id'];
      if (Object.prototype.hasOwnProperty.call(cols, 'captain_user_id')) selectCols.push('t.captain_user_id');
      const q = k('teams as t').select(selectCols);
      if (league_id) q.where('t.league_id', Number(league_id));
      if (sport_id) q.where('t.sport_id', Number(sport_id));
      if (city_id) q.where('t.city_id', Number(city_id));
      const rows = await q.orderBy('t.name', 'asc').catch((e) => { throw e; });
      // attach member counts (best-effort)
      const out = [];
      for (const r of (rows || [])) {
        let memberCount = 0;
        try {
          const cnt = await k('team_members').where({ team_id: r.id }).count('* as c').first();
          memberCount = (cnt && (cnt.c || cnt['count(*)'])) ? Number(cnt.c || cnt['count(*)']) : 0;
        } catch (e) {
          memberCount = 0;
        }
        out.push({ id: r.id, name: r.name, league_id: r.league_id, sport_id: r.sport_id, city_id: r.city_id, captain_user_id: r.captain_user_id, memberCount });
      }
      res.json(out);
    } catch (e) {
      const msg = (e && e.message || '').toLowerCase();
      if (msg.includes('no such table') || msg.includes('no such column')) return res.json([]);
      console.error('List teams failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST /teams/:id/roster - submit roster for a match (requires auth)
  router.post('/:id/roster', requireAuth, async (req, res) => {
    try {
      const k = require('../../db') || db;
      const teamId = Number(req.params.id);
      const { match_id, players } = req.body || {};
      if (!teamId || !match_id || !Array.isArray(players)) return res.status(400).json({ error: 'MISSING_FIELDS' });

      // validation: determine sport team_size and substitutes
      const teamRow = await k('teams').where({ id: teamId }).first();
      if (!teamRow) return res.status(404).json({ error: 'TEAM_NOT_FOUND' });
      // try to find sport via team.sport_id or via league -> teams.league_id -> leagues.sport_id
      let sportId = teamRow.sport_id || null;
      if (!sportId && teamRow.league_id) {
        const league = await k('leagues').where({ id: teamRow.league_id }).first();
        if (league && league.sport_id) sportId = league.sport_id;
      }
      const sportInfo = sportId ? await k('sports').where({ id: sportId }).first().catch(() => null) : null;
      const teamSize = sportInfo && Number(sportInfo.team_size) ? Number(sportInfo.team_size) : null;
      // try substitutes column, fallback to sensible default for team sports
      const substitutes = sportInfo && Number(sportInfo.substitutes) >= 0 ? Number(sportInfo.substitutes) : (teamSize ? 7 : 0);

      // permission: primary captain, any team member with is_captain=true (co-captain), or admin may submit/replace roster
      let allowed = false;
      if (req.user.id === teamRow.captain_user_id) allowed = true; // primary captain
      if (req.user.is_admin) allowed = true;
      if (!allowed) {
        // check team_members for an is_captain flag (co-captain)
        const tm = await k('team_members').where({ team_id: teamId, user_id: req.user.id }).first().catch(() => null);
        if (tm && tm.is_captain) allowed = true;
      }
      if (!allowed) return res.status(403).json({ error: 'FORBIDDEN' });

      // validate players array against teamSize/substitutes and allowed roles
      const allowedRoles = ['starter', 'sub', 'reserve'];
      const normalizedPlayers = (players || []).map(p => ({ user_id: Number(p.user_id), role: String((p.role || 'sub')).toLowerCase(), shirt_number: p.shirt_number || null }));
      for (const p of normalizedPlayers) {
        if (!p.user_id || !Number.isFinite(p.user_id)) return res.status(400).json({ error: 'INVALID_PLAYER', details: p });
        if (!allowedRoles.includes(p.role)) return res.status(400).json({ error: 'INVALID_ROLE', details: p.role });
      }
      if (teamSize) {
        const starters = normalizedPlayers.filter(p => p.role === 'starter').length;
        const total = normalizedPlayers.length;
        if (starters > teamSize) return res.status(400).json({ error: 'TOO_MANY_STARTERS', details: { starters, teamSize } });
        if (total > teamSize + substitutes) return res.status(400).json({ error: 'TOO_MANY_PLAYERS', details: { total, allowed: teamSize + substitutes } });
      }

      // create or replace roster for (team,match)
      await k.transaction(async (trx) => {
        // upsert roster: delete existing roster for team+match
        await trx('team_roster_players').whereIn('roster_id', trx('team_match_rosters').select('id').where({ team_id: teamId, match_id })).del();
        await trx('team_match_rosters').where({ team_id: teamId, match_id }).del();
        // insert roster and normalize returned id (knex sqlite may return [{id:...}] or the id directly)
        const inserted = await trx('team_match_rosters').insert({ team_id: teamId, match_id, created_by: req.user.id }).returning('id').catch(() => null);
        let rosterId = null;
        if (Array.isArray(inserted) && inserted.length) {
          const first = inserted[0];
          rosterId = typeof first === 'object' ? (first.id || first) : first;
        } else if (typeof inserted === 'number' || typeof inserted === 'string') {
          rosterId = inserted;
        }
        if (!rosterId) {
          // sqlite fallback: pick the max id
          rosterId = await trx('team_match_rosters').max('id as id').first().then(r => r && r.id);
        }
        // insert players
        const inserts = normalizedPlayers.map(p => ({ roster_id: rosterId, user_id: p.user_id, role: p.role || 'sub', shirt_number: p.shirt_number || null }));
        if (inserts.length) await trx('team_roster_players').insert(inserts);
      });

      res.json({ success: true });
    } catch (e) {
      console.error('Submit roster failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR', details: (e && e.message) || String(e) });
    }
  });

  // GET /teams/:id - get team details and members
  router.get('/:id', async (req, res) => {
    try {
      const k = require('../../db') || db;
      const id = Number(req.params.id);
      const team = await k('teams').where({ id }).first();
      if (!team) return res.status(404).json({ error: 'TEAM_NOT_FOUND' });
      // detect which user columns exist and only select those
      const usersInfo = await k('users').columnInfo().catch(() => ({}));
      const selectCols = ['tm.user_id', 'tm.is_captain'];
      if (Object.prototype.hasOwnProperty.call(usersInfo, 'firstname')) selectCols.push('u.firstname');
      if (Object.prototype.hasOwnProperty.call(usersInfo, 'lastname')) selectCols.push('u.lastname');
      if (Object.prototype.hasOwnProperty.call(usersInfo, 'name')) selectCols.push('u.name');
      if (Object.prototype.hasOwnProperty.call(usersInfo, 'email')) selectCols.push('u.email');
      const members = await k('team_members as tm').leftJoin('users as u', 'u.id', 'tm.user_id').where({ 'tm.team_id': id }).select(selectCols);
      const memberList = (members || []).map(m => ({
        user_id: m.user_id,
        display_name: (m.firstname || m.lastname) ? `${m.firstname||''} ${m.lastname||''}`.trim() : (m.name || m.email || `user:${m.user_id}`),
        is_captain: !!m.is_captain
      }));
      res.json({ team, members: memberList });
    } catch (e) {
      console.error('Get team failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST /teams/:id/members - add a member to team (only captain or admin)
  router.post('/:id/members', requireAuth, async (req, res) => {
    try {
      const k = require('../../db') || db;
      const id = Number(req.params.id);
      const { user_id } = req.body || {};
      if (!user_id) return res.status(400).json({ error: 'MISSING_USER_ID' });
      const team = await k('teams').where({ id }).first();
      if (!team) return res.status(404).json({ error: 'TEAM_NOT_FOUND' });
      // allow primary captain, co-captain (team_members.is_captain), or admin to add members
      let allowAdd = false;
      if (req.user.id === team.captain_user_id) allowAdd = true;
      if (req.user.is_admin) allowAdd = true;
      if (!allowAdd) {
        const me = await k('team_members').where({ team_id: id, user_id: req.user.id }).first().catch(() => null);
        if (me && me.is_captain) allowAdd = true; // co-captain
      }
      if (!allowAdd) return res.status(403).json({ error: 'FORBIDDEN' });
      await k('team_members').insert({ team_id: id, user_id, is_captain: false }).catch((e) => { throw e; });
      res.json({ success: true });
    } catch (e) {
      console.error('Add member failed', e && (e.stack || e.message || e));
      if (e && e.code && String(e.code).includes('SQLITE_CONSTRAINT')) return res.status(400).json({ error: 'ALREADY_MEMBER' });
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // GET /teams/:id/rosters - list rosters for a team with players
  router.get('/:id/rosters', async (req, res) => {
    try {
      const k = require('../../db') || db;
      const teamId = Number(req.params.id);
      if (!teamId) return res.status(400).json({ error: 'INVALID_TEAM_ID' });

      // fetch rosters for this team
      const rosters = await k('team_match_rosters').where({ team_id: teamId }).orderBy('created_at', 'desc').catch((e) => { throw e; });
      const out = [];
      for (const r of (rosters || [])) {
        const players = await k('team_roster_players as rp')
          .leftJoin('users as u', 'u.id', 'rp.user_id')
          .where('rp.roster_id', r.id)
          .select('rp.user_id', 'rp.role', 'rp.shirt_number', 'u.firstname', 'u.lastname', 'u.email')
          .orderBy('rp.role', 'desc');
        const mapped = (players || []).map(p => ({ user_id: p.user_id, role: p.role, shirt_number: p.shirt_number, display_name: (p.firstname || p.lastname) ? `${(p.firstname||'').trim()} ${(p.lastname||'').trim()}`.trim() : (p.email || `user:${p.user_id}`) }));
        out.push({ id: r.id, match_id: r.match_id, created_by: r.created_by, created_at: r.created_at, players: mapped });
      }
      res.json(out);
    } catch (e) {
      const msg = (e && e.message || '').toLowerCase();
      if (msg.includes('no such table') || msg.includes('no such column')) return res.json([]);
      console.error('Get team rosters failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // ...existing code...

  // DELETE /teams/:id/members - remove member (only captain or admin)
  router.delete('/:id/members', requireAuth, async (req, res) => {
    try {
      const k = require('../../db') || db;
      const id = Number(req.params.id);
      const { user_id } = req.body || {};
      if (!user_id) return res.status(400).json({ error: 'MISSING_USER_ID' });
      const team = await k('teams').where({ id }).first();
      if (!team) return res.status(404).json({ error: 'TEAM_NOT_FOUND' });
      // allow primary captain, co-captain, or admin to remove members
      let allowRemove = false;
      if (req.user.id === team.captain_user_id) allowRemove = true;
      if (req.user.is_admin) allowRemove = true;
      if (!allowRemove) {
        const me = await k('team_members').where({ team_id: id, user_id: req.user.id }).first().catch(() => null);
        if (me && me.is_captain) allowRemove = true; // co-captain
      }
      if (!allowRemove) return res.status(403).json({ error: 'FORBIDDEN' });
      const deleted = await k('team_members').where({ team_id: id, user_id }).del();
      res.json({ success: deleted > 0 });
    } catch (e) {
      console.error('Remove member failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // DELETE /teams/:id - delete a team (only primary captain or admin)
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const k = require('../../db') || db;
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'INVALID_TEAM_ID' });
      const team = await k('teams').where({ id }).first();
      if (!team) return res.status(404).json({ error: 'TEAM_NOT_FOUND' });
      // only primary captain (teams.captain_user_id) or admin may delete the team
      if (req.user.id !== team.captain_user_id && !req.user.is_admin) return res.status(403).json({ error: 'FORBIDDEN' });
      await k('teams').where({ id }).del();
      res.json({ success: true });
    } catch (e) {
      console.error('Delete team failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST /teams/:id/members/:user_id/promote - mark member as co-captain (only primary captain or admin)
  router.post('/:id/members/:user_id/promote', requireAuth, async (req, res) => {
    try {
      const k = require('../../db') || db;
      const teamId = Number(req.params.id);
      const userId = Number(req.params.user_id);
      if (!teamId || !userId) return res.status(400).json({ error: 'INVALID_PARAMS' });
      const team = await k('teams').where({ id: teamId }).first();
      if (!team) return res.status(404).json({ error: 'TEAM_NOT_FOUND' });
      // only primary captain or admin may promote
      if (req.user.id !== team.captain_user_id && !req.user.is_admin) return res.status(403).json({ error: 'FORBIDDEN' });
      // ensure member exists
      const mem = await k('team_members').where({ team_id: teamId, user_id: userId }).first();
      if (!mem) return res.status(404).json({ error: 'NOT_A_MEMBER' });
      await k('team_members').where({ team_id: teamId, user_id: userId }).update({ is_captain: true });
      res.json({ success: true });
    } catch (e) {
      console.error('Promote member failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST /teams/:id/members/:user_id/demote - remove co-captain flag (only primary captain or admin)
  router.post('/:id/members/:user_id/demote', requireAuth, async (req, res) => {
    try {
      const k = require('../../db') || db;
      const teamId = Number(req.params.id);
      const userId = Number(req.params.user_id);
      if (!teamId || !userId) return res.status(400).json({ error: 'INVALID_PARAMS' });
      const team = await k('teams').where({ id: teamId }).first();
      if (!team) return res.status(404).json({ error: 'TEAM_NOT_FOUND' });
      // do not allow demoting the primary captain via this endpoint
      if (userId === team.captain_user_id) return res.status(400).json({ error: 'CANNOT_DEMOTE_PRIMARY_CAPTAIN' });
      // only primary captain or admin may demote
      if (req.user.id !== team.captain_user_id && !req.user.is_admin) return res.status(403).json({ error: 'FORBIDDEN' });
      const mem = await k('team_members').where({ team_id: teamId, user_id: userId }).first();
      if (!mem) return res.status(404).json({ error: 'NOT_A_MEMBER' });
      await k('team_members').where({ team_id: teamId, user_id: userId }).update({ is_captain: false });
      res.json({ success: true });
    } catch (e) {
      console.error('Demote member failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  return router;
};
