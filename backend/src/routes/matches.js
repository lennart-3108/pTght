const express = require('express');
const { createMiddleware } = require('./middleware');

function resolveKnex(db) {
  if (db?.client && typeof db.raw === 'function') return db;
  if (db?.knex?.client) return db.knex;
  try { return require('../../db'); } catch { return null; }
}

function formatUserName(row) {
  const first = (row?.firstname || '').trim();
  const last = (row?.lastname || '').trim();
  if (first || last) return `${first} ${last}`.trim();
  if (row?.name) return String(row.name).trim();
  if (row?.email) return String(row.email).trim();
  return row?.id ? `user:${row.id}` : '';
}

module.exports = function matchesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;
  const { requireAuth } = createMiddleware(ctx);
  let knexInstance = null;
  let ensuredMessages = false;
  let cachedUserInfo = null;

  function getKnex() {
    knexInstance = knexInstance || resolveKnex(db);
    if (!knexInstance) throw new Error('DB_NOT_AVAILABLE');
    return knexInstance;
  }

  function hasColumn(info, name) {
    return info && Object.prototype.hasOwnProperty.call(info, name);
  }

  function buildUserDisplayExpression(info, alias) {
    const parts = [];
    if (hasColumn(info, 'firstname') || hasColumn(info, 'lastname')) {
      const firstExpr = hasColumn(info, 'firstname') ? `COALESCE(${alias}.firstname,'')` : "''";
      const lastExpr = hasColumn(info, 'lastname') ? `COALESCE(${alias}.lastname,'')` : "''";
      parts.push(`NULLIF(TRIM(${firstExpr} || ' ' || ${lastExpr}), '')`);
    }
    if (hasColumn(info, 'name')) parts.push(`${alias}.name`);
    if (hasColumn(info, 'email')) parts.push(`${alias}.email`);
    if (!parts.length) return "''";
    return `COALESCE(${parts.join(', ')})`;
  }

  async function getUserColumnInfo(knex) {
    if (cachedUserInfo) return cachedUserInfo;
    try {
      cachedUserInfo = await knex('users').columnInfo();
    } catch (e) {
      cachedUserInfo = {};
    }
    return cachedUserInfo;
  }

  async function ensureMatchMessagesTable(knex) {
    if (ensuredMessages) return;
    try {
      const has = await knex.schema.hasTable('match_messages').catch(() => false);
      if (!has) {
        await knex.schema.createTable('match_messages', (table) => {
          table.increments('id').primary();
          table.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
          table.integer('sender_user_id').references('id').inTable('users').onDelete('SET NULL');
          table.integer('sender_team_id').references('id').inTable('teams').onDelete('SET NULL');
          table.text('body').notNullable();
          table.text('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
        });
      }
    } finally {
      ensuredMessages = true;
    }
  }

  async function loadMatch(knex, matchId) {
    const hasMatches = await knex.schema.hasTable('matches').catch(() => false);
    if (!hasMatches) return null;
    return knex('matches').where({ id: matchId }).first();
  }

  async function resolveParticipant(knex, match, userId) {
    const info = { allowed: false, teamId: null, side: null, matchType: (match?.home_team_id || match?.away_team_id) ? 'teams' : 'singles' };
    if (!match) return info;
    const idNum = Number(userId);
    if (match.home_user_id != null && Number(match.home_user_id) === idNum) {
      return { ...info, allowed: true, side: 'home', teamId: null };
    }
    if (match.away_user_id != null && Number(match.away_user_id) === idNum) {
      return { ...info, allowed: true, side: 'away', teamId: null };
    }
    const teamIds = [match.home_team_id, match.away_team_id].filter((v) => v != null);
    if (!teamIds.length) return info;
    const hasTeamMembers = await knex.schema.hasTable('team_members').catch(() => false);
    if (!hasTeamMembers) return info;
    const membership = await knex('team_members').whereIn('team_id', teamIds).andWhere('user_id', idNum).first();
    if (!membership) return info;
    const side = membership.team_id === match.home_team_id ? 'home' : (membership.team_id === match.away_team_id ? 'away' : null);
    return { ...info, allowed: true, side, teamId: membership.team_id };
  }

  async function fetchMessages(knex, matchId) {
    const hasUsers = await knex.schema.hasTable('users').catch(() => false);
    const hasTeams = await knex.schema.hasTable('teams').catch(() => false);
    const selectCols = [
      { id: 'm.id' },
      { body: 'm.body' },
      { created_at: 'm.created_at' },
      { sender_user_id: 'm.sender_user_id' },
      { sender_team_id: 'm.sender_team_id' }
    ];
    if (hasUsers) {
      const info = await getUserColumnInfo(knex);
      const expr = buildUserDisplayExpression(info, 'u');
      selectCols.push(knex.raw(`${expr} as sender_user_name`));
    } else {
      selectCols.push(knex.raw("'' as sender_user_name"));
    }
    if (hasTeams) {
      selectCols.push({ sender_team_name: 't.name' });
    } else {
      selectCols.push(knex.raw("'' as sender_team_name"));
    }

    const query = knex({ m: 'match_messages' });
    if (hasUsers) query.leftJoin({ u: 'users' }, 'u.id', 'm.sender_user_id');
    if (hasTeams) query.leftJoin({ t: 'teams' }, 't.id', 'm.sender_team_id');
    return query
      .where('m.match_id', matchId)
      .orderBy('m.created_at', 'asc')
      .select(selectCols);
  }

  async function fetchMessageById(knex, id) {
    const hasUsers = await knex.schema.hasTable('users').catch(() => false);
    const hasTeams = await knex.schema.hasTable('teams').catch(() => false);
    const selectCols = [
      { id: 'm.id' },
      { body: 'm.body' },
      { created_at: 'm.created_at' },
      { sender_user_id: 'm.sender_user_id' },
      { sender_team_id: 'm.sender_team_id' }
    ];
    if (hasUsers) {
      const info = await getUserColumnInfo(knex);
      const expr = buildUserDisplayExpression(info, 'u');
      selectCols.push(knex.raw(`${expr} as sender_user_name`));
    } else {
      selectCols.push(knex.raw("'' as sender_user_name"));
    }
    if (hasTeams) {
      selectCols.push({ sender_team_name: 't.name' });
    } else {
      selectCols.push(knex.raw("'' as sender_team_name"));
    }
    const query = knex({ m: 'match_messages' });
    if (hasUsers) query.leftJoin({ u: 'users' }, 'u.id', 'm.sender_user_id');
    if (hasTeams) query.leftJoin({ t: 'teams' }, 't.id', 'm.sender_team_id');
    return query
      .where('m.id', id)
      .first(selectCols);
  }

  router.get('/:id/rosters', async (req, res) => {
    try {
      const k = getKnex();
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });

      const userInfo = await getUserColumnInfo(k);
      const rosters = await k('team_match_rosters').where({ match_id: matchId }).orderBy('team_id', 'asc');
      const out = [];
      for (const r of rosters || []) {
        const selectCols = ['rp.user_id', 'rp.role', 'rp.shirt_number'];
        if (hasColumn(userInfo, 'firstname')) selectCols.push('u.firstname');
        if (hasColumn(userInfo, 'lastname')) selectCols.push('u.lastname');
        if (hasColumn(userInfo, 'email')) selectCols.push('u.email');
        if (hasColumn(userInfo, 'name')) selectCols.push('u.name');
        const players = await k('team_roster_players as rp')
          .leftJoin('users as u', 'u.id', 'rp.user_id')
          .where('rp.roster_id', r.id)
          .select(selectCols)
          .orderBy('rp.role', 'desc');
        const mapped = (players || []).map((p) => ({
          user_id: p.user_id,
          role: p.role,
          shirt_number: p.shirt_number,
          display_name: formatUserName(p)
        }));
        out.push({ id: r.id, team_id: r.team_id, match_id: r.match_id, created_by: r.created_by, created_at: r.created_at, players: mapped });
      }
      res.json(out);
    } catch (e) {
      const msg = (e && e.message || '').toLowerCase();
      if (msg.includes('no such table') || msg.includes('no such column')) return res.json([]);
      console.error('Get match rosters failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  router.get('/:id/chat', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      const k = getKnex();
      await ensureMatchMessagesTable(k);
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });
      const rows = await fetchMessages(k, matchId);
      const messages = (rows || []).map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        senderUserId: row.sender_user_id,
        senderTeamId: row.sender_team_id,
        senderUserName: row.sender_user_name || null,
        senderTeamName: row.sender_team_name || null
      }));
  res.json({ messages, meta: { viewerTeamId: participant.teamId, viewerSide: participant.side, matchType: participant.matchType, viewerUserId: Number(req.user.id) || null } });
    } catch (e) {
      const msg = (e && e.message || '').toLowerCase();
      if (msg.includes('db_not_available')) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      console.error('Get match chat failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  router.post('/:id/chat', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      const bodyRaw = typeof req.body?.message === 'string' ? req.body.message : (typeof req.body?.body === 'string' ? req.body.body : '');
      const trimmed = bodyRaw.trim();
      if (!trimmed) return res.status(400).json({ error: 'EMPTY_MESSAGE' });
      if (trimmed.length > 2000) return res.status(400).json({ error: 'MESSAGE_TOO_LONG' });
      const k = getKnex();
      await ensureMatchMessagesTable(k);
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });
      const insertRec = {
        match_id: matchId,
        body: trimmed,
        sender_user_id: Number(req.user.id) || null,
        sender_team_id: participant.teamId || null,
        created_at: new Date().toISOString()
      };
      const inserted = await k('match_messages').insert(insertRec);
      const newId = Array.isArray(inserted) ? inserted[0] : inserted;
      const row = await fetchMessageById(k, newId);
      const payload = row ? {
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        senderUserId: row.sender_user_id,
        senderTeamId: row.sender_team_id,
        senderUserName: row.sender_user_name || null,
        senderTeamName: row.sender_team_name || null
      } : {
        id: newId,
        body: insertRec.body,
        createdAt: insertRec.created_at,
        senderUserId: insertRec.sender_user_id,
        senderTeamId: insertRec.sender_team_id,
        senderUserName: null,
        senderTeamName: null
      };
  res.status(201).json({ message: payload, meta: { viewerTeamId: participant.teamId, viewerUserId: Number(req.user.id) || null } });
    } catch (e) {
      const msg = (e && e.message || '').toLowerCase();
      if (msg.includes('db_not_available')) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      console.error('Post match chat failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  return router;
};
