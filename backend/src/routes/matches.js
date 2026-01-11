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
  let ensuredTerminManager = false;
  let cachedUserInfo = null;
  let cachedMMInfo = null;

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

  async function getMatchMessagesColumnInfo(knex) {
    if (cachedMMInfo) return cachedMMInfo;
    try {
      cachedMMInfo = await knex('match_messages').columnInfo();
    } catch (e) {
      cachedMMInfo = {};
    }
    return cachedMMInfo;
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
          table.string('kind', 20).nullable();
          table.string('action', 50).nullable();
          table.text('data').nullable();
          table.text('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
        });
        cachedMMInfo = null;
      } else {
        const info = await getMatchMessagesColumnInfo(knex);
        // Best-effort add missing columns (keeps older DBs compatible)
        await knex.schema.table('match_messages', (t) => {
          if (!Object.prototype.hasOwnProperty.call(info, 'kind')) t.string('kind', 20).nullable();
          if (!Object.prototype.hasOwnProperty.call(info, 'action')) t.string('action', 50).nullable();
          if (!Object.prototype.hasOwnProperty.call(info, 'data')) t.text('data').nullable();
        }).catch(() => {});
        cachedMMInfo = null;
      }
    } finally {
      ensuredMessages = true;
    }
  }

  async function ensureTerminManagerTables(knex) {
    if (ensuredTerminManager) return;
    try {
      const hasMatches = await knex.schema.hasTable('matches').catch(() => false);
      if (!hasMatches) return;

      const hasOptions = await knex.schema.hasTable('match_time_options').catch(() => false);
      if (!hasOptions) {
        await knex.schema.createTable('match_time_options', (t) => {
          t.increments('id').primary();
          t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
          t.text('starts_at').notNullable();
          t.integer('created_by_user_id').references('id').inTable('users').onDelete('SET NULL');
          t.text('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
          t.index(['match_id'], 'idx_match_time_options_match');
          t.index(['match_id', 'starts_at'], 'idx_match_time_options_match_starts');
        });
      }

      const hasProposals = await knex.schema.hasTable('match_schedule_proposals').catch(() => false);
      if (!hasProposals) {
        await knex.schema.createTable('match_schedule_proposals', (t) => {
          t.increments('id').primary();
          t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
          t.integer('proposer_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
          t.integer('recipient_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
          t.integer('option_id').notNullable().references('id').inTable('match_time_options').onDelete('CASCADE');
          t.string('status', 20).notNullable().defaultTo('sent');
          t.text('note').nullable();
          t.text('created_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));
          t.text('responded_at').nullable();
          t.index(['match_id'], 'idx_match_schedule_proposals_match');
          t.index(['match_id', 'status'], 'idx_match_schedule_proposals_match_status');
        });
      }
    } finally {
      ensuredTerminManager = true;
    }
  }

  function safeParseISO(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function formatActionBody(prefix, dtIso, note) {
    const dt = dtIso ? new Date(dtIso) : null;
    const display = dt && !Number.isNaN(dt.getTime())
      ? dt.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';
    const head = display ? `${prefix}: ${display}` : prefix;
    const n = typeof note === 'string' ? note.trim() : '';
    return n ? `${head}\n\n${n}` : head;
  }

  function detectSportType(matchRow, sportRow = {}) {
    const sportType = sportRow.sport_type || sportRow.type || null;
    if (sportType) return String(sportType);
    const teamSize = Number(sportRow.team_size || matchRow?.team_size || 0);
    if (Number.isFinite(teamSize) && teamSize > 1) return 'Team';
    if (matchRow?.home_team_id != null || matchRow?.away_team_id != null) return 'Team';
    return 'Single';
  }

  async function insertActionMessage(knex, matchId, senderUserId, senderTeamId, action, dataObj, body) {
    await ensureMatchMessagesTable(knex);
    const insertRec = {
      match_id: matchId,
      body: body || '',
      sender_user_id: senderUserId || null,
      sender_team_id: senderTeamId || null,
      created_at: new Date().toISOString()
    };
    const mmInfo = await getMatchMessagesColumnInfo(knex);
    if (hasColumn(mmInfo, 'kind')) insertRec.kind = 'action';
    if (hasColumn(mmInfo, 'action')) insertRec.action = action;
    if (hasColumn(mmInfo, 'data')) insertRec.data = dataObj ? JSON.stringify(dataObj) : null;
    await knex('match_messages').insert(insertRec);
  }

  async function loadMatch(knex, matchId, viewerId) {
    const hasMatches = await knex.schema.hasTable('matches').catch(() => false);
    if (!hasMatches) return { match: null, isHost: false, isJoined: false, participant: {} };
    
    const match = await knex('matches').where({ id: matchId }).first();
    if (!match) return { match: null, isHost: false, isJoined: false, participant: {} };
    
    // If viewerId is provided, determine if user is host or joined
    if (viewerId) {
      const userId = Number(viewerId);
      const isHost = match.home_user_id != null && Number(match.home_user_id) === userId;
      const isJoined = match.away_user_id != null && Number(match.away_user_id) === userId;
      const opponentId = isHost ? match.away_user_id : (isJoined ? match.home_user_id : null);
      
      return {
        match,
        isHost,
        isJoined,
        participant: {
          allowed: isHost || isJoined,
          side: isHost ? 'home' : (isJoined ? 'away' : null),
          opponentId
        }
      };
    }
    
    // Legacy: return just the match
    return match;
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
    const mmInfo = await getMatchMessagesColumnInfo(knex);
    const selectCols = [
      { id: 'm.id' },
      { body: 'm.body' },
      { created_at: 'm.created_at' },
      { sender_user_id: 'm.sender_user_id' },
      { sender_team_id: 'm.sender_team_id' }
    ];
    // action message fields (optional)
    if (hasColumn(mmInfo, 'kind')) selectCols.push({ kind: 'm.kind' }); else selectCols.push(knex.raw("NULL as kind"));
    if (hasColumn(mmInfo, 'action')) selectCols.push({ action: 'm.action' }); else selectCols.push(knex.raw("NULL as action"));
    if (hasColumn(mmInfo, 'data')) selectCols.push({ data: 'm.data' }); else selectCols.push(knex.raw("NULL as data"));
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
    const mmInfo = await getMatchMessagesColumnInfo(knex);
    const selectCols = [
      { id: 'm.id' },
      { body: 'm.body' },
      { created_at: 'm.created_at' },
      { sender_user_id: 'm.sender_user_id' },
      { sender_team_id: 'm.sender_team_id' }
    ];
    if (hasColumn(mmInfo, 'kind')) selectCols.push({ kind: 'm.kind' }); else selectCols.push(knex.raw("NULL as kind"));
    if (hasColumn(mmInfo, 'action')) selectCols.push({ action: 'm.action' }); else selectCols.push(knex.raw("NULL as action"));
    if (hasColumn(mmInfo, 'data')) selectCols.push({ data: 'm.data' }); else selectCols.push(knex.raw("NULL as data"));
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

  async function fetchMatchDetail(knex, matchId) {
    const hasMatches = await knex.schema.hasTable('matches').catch(() => false);
    if (!hasMatches) return null;

    const matchInfo = await knex('matches').columnInfo().catch(() => ({}));
    const hasLeagues = await knex.schema.hasTable('leagues').catch(() => false);
    const hasSports = await knex.schema.hasTable('sports').catch(() => false);
    const hasUsers = await knex.schema.hasTable('users').catch(() => false);
    const leaguesInfo = hasLeagues ? await knex('leagues').columnInfo().catch(() => ({})) : {};
    const canJoinSport = hasLeagues && hasSports && hasColumn(leaguesInfo, 'sport_id');

    const usersInfo = hasUsers ? await getUserColumnInfo(knex) : {};
    const homeExpr = hasUsers ? buildUserDisplayExpression(usersInfo, 'uh') : "''";
    const awayExpr = hasUsers ? buildUserDisplayExpression(usersInfo, 'ua') : "''";

    const selectCols = [
      'm.id',
      ...(hasColumn(matchInfo, 'league_id') ? ['m.league_id', { leagueId: 'm.league_id' }] : []),
      ...(hasColumn(matchInfo, 'when_type') ? ['m.when_type'] : []),
      ...(hasColumn(matchInfo, 'range_days') ? ['m.range_days'] : []),
      ...(hasColumn(matchInfo, 'player_level') ? ['m.player_level'] : []),
      ...(hasColumn(matchInfo, 'time_of_day') ? ['m.time_of_day'] : []),
      ...(hasColumn(matchInfo, 'time_from') ? ['m.time_from'] : []),
      ...(hasColumn(matchInfo, 'time_to') ? ['m.time_to'] : []),
      ...(hasColumn(matchInfo, 'kickoff_at') ? ['m.kickoff_at'] : []),
      ...(hasColumn(matchInfo, 'kickoff_end_at') ? ['m.kickoff_end_at'] : []),
      ...(hasColumn(matchInfo, 'location_id') ? ['m.location_id'] : []),
      ...(hasColumn(matchInfo, 'location') ? ['m.location'] : []),
      ...(hasColumn(matchInfo, 'home_user_id') ? ['m.home_user_id'] : []),
      ...(hasColumn(matchInfo, 'away_user_id') ? ['m.away_user_id'] : []),
      ...(hasColumn(matchInfo, 'home_team_id') ? ['m.home_team_id'] : []),
      ...(hasColumn(matchInfo, 'away_team_id') ? ['m.away_team_id'] : []),
      ...(hasColumn(matchInfo, 'home_score') ? ['m.home_score'] : []),
      ...(hasColumn(matchInfo, 'away_score') ? ['m.away_score'] : []),
      ...(hasColumn(matchInfo, 'status') ? ['m.status'] : []),
      ...(hasColumn(matchInfo, 'created_at') ? ['m.created_at'] : []),
      ...(hasLeagues ? [{ league: 'l.name' }] : [knex.raw("'' as league")]),
      ...(canJoinSport ? [{ sport: 's.name' }] : [knex.raw("'' as sport")]),
      knex.raw(`${homeExpr} as home_user_name`),
      knex.raw(`${awayExpr} as away_user_name`),
    ];

    const q = knex('matches as m');
    if (hasLeagues) q.leftJoin('leagues as l', 'l.id', 'm.league_id');
    if (canJoinSport) q.leftJoin('sports as s', 's.id', 'l.sport_id');
    if (hasUsers) {
      q.leftJoin({ uh: 'users' }, 'uh.id', 'm.home_user_id');
      q.leftJoin({ ua: 'users' }, 'ua.id', 'm.away_user_id');
    }

    return q.where('m.id', matchId).first(selectCols);
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

  // Match detail (used by FE route /matches/:id)
  router.get('/:id', async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });

      const k = getKnex();
      const hasMatches = await k.schema.hasTable('matches').catch(() => false);
      if (!hasMatches) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      const matchInfo = await k('matches').columnInfo().catch(() => ({}));
      const hasLeagues = await k.schema.hasTable('leagues').catch(() => false);
      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      const hasUsers = await k.schema.hasTable('users').catch(() => false);
      const leaguesInfo = hasLeagues ? await k('leagues').columnInfo().catch(() => ({})) : {};
      const canJoinSport = hasLeagues && hasSports && hasColumn(leaguesInfo, 'sport_id');

      const usersInfo = hasUsers ? await getUserColumnInfo(k) : {};
      const homeExpr = hasUsers ? buildUserDisplayExpression(usersInfo, 'uh') : "''";
      const awayExpr = hasUsers ? buildUserDisplayExpression(usersInfo, 'ua') : "''";

      const selectCols = [
        'm.id',
        ...(hasColumn(matchInfo, 'league_id') ? ['m.league_id', { leagueId: 'm.league_id' }] : []),
        ...(hasColumn(matchInfo, 'when_type') ? ['m.when_type'] : []),
        ...(hasColumn(matchInfo, 'range_days') ? ['m.range_days'] : []),
        ...(hasColumn(matchInfo, 'player_level') ? ['m.player_level'] : []),
        ...(hasColumn(matchInfo, 'time_of_day') ? ['m.time_of_day'] : []),
        ...(hasColumn(matchInfo, 'time_from') ? ['m.time_from'] : []),
        ...(hasColumn(matchInfo, 'time_to') ? ['m.time_to'] : []),
        ...(hasColumn(matchInfo, 'kickoff_at') ? ['m.kickoff_at'] : []),
        ...(hasColumn(matchInfo, 'kickoff_end_at') ? ['m.kickoff_end_at'] : []),
        ...(hasColumn(matchInfo, 'location_id') ? ['m.location_id'] : []),
        ...(hasColumn(matchInfo, 'location') ? ['m.location'] : []),
        ...(hasColumn(matchInfo, 'home_user_id') ? ['m.home_user_id'] : []),
        ...(hasColumn(matchInfo, 'away_user_id') ? ['m.away_user_id'] : []),
        ...(hasColumn(matchInfo, 'home_team_id') ? ['m.home_team_id'] : []),
        ...(hasColumn(matchInfo, 'away_team_id') ? ['m.away_team_id'] : []),
        ...(hasColumn(matchInfo, 'home_score') ? ['m.home_score'] : []),
        ...(hasColumn(matchInfo, 'away_score') ? ['m.away_score'] : []),
        ...(hasColumn(matchInfo, 'status') ? ['m.status'] : []),
        ...(hasColumn(matchInfo, 'created_at') ? ['m.created_at'] : []),
        ...(hasLeagues ? [{ league: 'l.name' }] : [k.raw("'' as league")]),
        ...(canJoinSport ? [{ sport: 's.name' }] : [k.raw("'' as sport")]),
        k.raw(`${homeExpr} as home_user_name`),
        k.raw(`${awayExpr} as away_user_name`),
      ];

      const q = k('matches as m');
      if (hasLeagues) q.leftJoin('leagues as l', 'l.id', 'm.league_id');
      if (canJoinSport) q.leftJoin('sports as s', 's.id', 'l.sport_id');
      if (hasUsers) {
        q.leftJoin({ uh: 'users' }, 'uh.id', 'm.home_user_id');
        q.leftJoin({ ua: 'users' }, 'ua.id', 'm.away_user_id');
      }

      const match = await q.where('m.id', matchId).first(selectCols);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      return res.json(match);
    } catch (e) {
      const msg = (e && e.message || '').toLowerCase();
      if (msg.includes('db_not_available')) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      console.error('Get match detail failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // Check whether the current user may submit a result
  router.get('/:id/can-submit', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });

      const k = getKnex();
      const hasMatches = await k.schema.hasTable('matches').catch(() => false);
      if (!hasMatches) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      const matchInfo = await k('matches').columnInfo().catch(() => ({}));
      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      const hasUserLeagues = await k.schema.hasTable('user_leagues').catch(() => false);
      const baseQuery = k({ m: 'matches' })
        .leftJoin({ l: 'leagues' }, 'l.id', 'm.league_id')
        .select(
          'm.id', 'm.league_id', 'm.kickoff_at',
          'm.home_user_id', 'm.away_user_id',
          'm.home_team_id', 'm.away_team_id',
          ...(hasColumn(matchInfo, 'home_score') ? ['m.home_score'] : []),
          ...(hasColumn(matchInfo, 'away_score') ? ['m.away_score'] : []),
          ...(hasSports ? [{ sport_type: 's.sport_type' }, { team_size: 's.team_size' }, { type: 's.type' }] : []),
          { league_name: 'l.name' }
        );
      if (hasSports) baseQuery.leftJoin({ s: 'sports' }, 's.id', 'l.sport_id');
      const match = await baseQuery.where('m.id', matchId).first();
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      const isOpenMatch = !!(match.league_name && String(match.league_name).includes('Open Matches'));
      if (!isOpenMatch && hasUserLeagues) {
        const member = await k('user_leagues').where({ league_id: match.league_id, user_id: req.user.id }).first();
        if (!member) return res.json({ canSubmit: false, reason: 'LEAGUE_MEMBERS_ONLY' });
      }

      const hasScores = hasColumn(matchInfo, 'home_score') && (match.home_score != null || match.away_score != null);
      if (hasScores) return res.json({ canSubmit: false, reason: 'ALREADY_RECORDED' });

      if (hasColumn(matchInfo, 'kickoff_at') && !match.kickoff_at) {
        return res.json({ canSubmit: false, reason: 'KICKOFF_NOT_SET' });
      }

      // Check if kickoff time has been reached
      if (hasColumn(matchInfo, 'kickoff_at') && match.kickoff_at) {
        const kickoffTime = new Date(match.kickoff_at);
        const now = new Date();
        if (!isNaN(kickoffTime.getTime()) && kickoffTime.getTime() > now.getTime()) {
          return res.json({ canSubmit: false, reason: 'KICKOFF_NOT_REACHED' });
        }
      }

      const sportType = detectSportType(match, match);
      if (sportType === 'Team' || String(sportType).toLowerCase().includes('team')) {
        if (match.home_team_id == null || match.away_team_id == null) {
          return res.json({ canSubmit: false, reason: 'OPPONENT_NOT_ASSIGNED' });
        }
        const hasTeamMembers = await k.schema.hasTable('team_members').catch(() => false);
        if (!hasTeamMembers) return res.json({ canSubmit: false, reason: 'ONLY_CAPTAIN_CAN_SUBMIT' });
        const cap = await k('team_members')
          .whereIn('team_id', [match.home_team_id, match.away_team_id])
          .andWhere({ user_id: req.user.id, is_captain: 1 })
          .first();
        if (!cap) return res.json({ canSubmit: false, reason: 'ONLY_CAPTAIN_CAN_SUBMIT' });
      } else {
        if (match.home_user_id == null || match.away_user_id == null) {
          return res.json({ canSubmit: false, reason: 'OPPONENT_NOT_ASSIGNED' });
        }
        const isPlayer = (String(match.home_user_id) === String(req.user.id)) || (String(match.away_user_id) === String(req.user.id));
        if (!isPlayer) return res.json({ canSubmit: false, reason: 'ONLY_PLAYERS_CAN_SUBMIT' });
      }

      return res.json({ canSubmit: true });
    } catch (e) {
      console.error('Can submit check error:', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR', details: e && e.message });
    }
  });

  // Submit result for a pending match
  router.post('/:id/result', requireAuth, async (req, res) => {
    const toScore = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(999, Math.trunc(n)));
    };

    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });

      const home_score = toScore(req.body?.home_score);
      const away_score = toScore(req.body?.away_score);
      if (home_score == null || away_score == null) return res.status(400).json({ error: 'INVALID_SCORE' });

      const k = getKnex();
      const hasMatches = await k.schema.hasTable('matches').catch(() => false);
      if (!hasMatches) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      const matchInfo = await k('matches').columnInfo().catch(() => ({}));
      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      const hasUserLeagues = await k.schema.hasTable('user_leagues').catch(() => false);
      const baseQuery = k({ m: 'matches' })
        .leftJoin({ l: 'leagues' }, 'l.id', 'm.league_id')
        .select(
          'm.id', 'm.league_id', 'm.kickoff_at', 'm.kickoff_end_at',
          'm.home_user_id', 'm.away_user_id',
          'm.home_team_id', 'm.away_team_id',
          ...(hasColumn(matchInfo, 'home_score') ? ['m.home_score'] : []),
          ...(hasColumn(matchInfo, 'away_score') ? ['m.away_score'] : []),
          ...(hasSports ? [{ sport_type: 's.sport_type' }, { team_size: 's.team_size' }, { type: 's.type' }] : []),
          { league_name: 'l.name' }
        );
      if (hasSports) baseQuery.leftJoin({ s: 'sports' }, 's.id', 'l.sport_id');
      const match = await baseQuery.where('m.id', matchId).first();
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      const isOpenMatch = !!(match.league_name && String(match.league_name).includes('Open Matches'));
      if (!isOpenMatch && hasUserLeagues) {
        const member = await k('user_leagues').where({ league_id: match.league_id, user_id: req.user.id }).first();
        if (!member) return res.status(403).json({ error: 'LEAGUE_MEMBERS_ONLY' });
      }

      const hasScores = hasColumn(matchInfo, 'home_score') && (match.home_score != null || match.away_score != null);
      if (hasScores) return res.status(409).json({ error: 'ALREADY_RECORDED' });

      if (hasColumn(matchInfo, 'kickoff_at') && !match.kickoff_at) {
        return res.status(400).json({ error: 'KICKOFF_REQUIRED_BEFORE_RESULT' });
      }

      const sportType = detectSportType(match, match);
      if (sportType === 'Team' || String(sportType).toLowerCase().includes('team')) {
        if (match.home_team_id == null || match.away_team_id == null) {
          return res.status(400).json({ error: 'OPPONENT_NOT_ASSIGNED' });
        }
        const hasTeamMembers = await k.schema.hasTable('team_members').catch(() => false);
        if (!hasTeamMembers) return res.status(403).json({ error: 'ONLY_CAPTAIN_CAN_SUBMIT' });
        const cap = await k('team_members')
          .whereIn('team_id', [match.home_team_id, match.away_team_id])
          .andWhere({ user_id: req.user.id, is_captain: 1 })
          .first();
        if (!cap) return res.status(403).json({ error: 'ONLY_CAPTAIN_CAN_SUBMIT' });
      } else {
        if (match.home_user_id == null || match.away_user_id == null) {
          return res.status(400).json({ error: 'OPPONENT_NOT_ASSIGNED' });
        }
        const isPlayer = (String(match.home_user_id) === String(req.user.id)) || (String(match.away_user_id) === String(req.user.id));
        if (!isPlayer) return res.status(403).json({ error: 'ONLY_PLAYERS_CAN_SUBMIT' });
      }

      const patch = {};
      if (hasColumn(matchInfo, 'home_score')) patch.home_score = home_score;
      if (hasColumn(matchInfo, 'away_score')) patch.away_score = away_score;
      if (hasColumn(matchInfo, 'status')) patch.status = 'completed';
      if (hasColumn(matchInfo, 'updated_at')) patch.updated_at = new Date().toISOString();
      await k('matches').where({ id: matchId }).update(patch);

      const detail = await fetchMatchDetail(k, matchId);
      return res.json(detail || { id: matchId, home_score, away_score });
    } catch (e) {
      console.error('Submit result error:', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR', details: e && e.message });
    }
  });

  // Cancel (delete) a pending match
  router.delete('/:id', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });

      const k = getKnex();
      const hasMatches = await k.schema.hasTable('matches').catch(() => false);
      if (!hasMatches) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      const matchInfo = await k('matches').columnInfo().catch(() => ({}));
      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      const hasUserLeagues = await k.schema.hasTable('user_leagues').catch(() => false);
      const baseQuery = k({ m: 'matches' })
        .leftJoin({ l: 'leagues' }, 'l.id', 'm.league_id')
        .select(
          'm.id', 'm.league_id', 'm.kickoff_at',
          'm.home_user_id', 'm.away_user_id',
          'm.home_team_id', 'm.away_team_id',
          ...(hasColumn(matchInfo, 'home_score') ? ['m.home_score'] : []),
          ...(hasColumn(matchInfo, 'away_score') ? ['m.away_score'] : []),
          ...(hasSports ? [{ sport_type: 's.sport_type' }, { team_size: 's.team_size' }, { type: 's.type' }] : []),
          { league_name: 'l.name' }
        );
      if (hasSports) baseQuery.leftJoin({ s: 'sports' }, 's.id', 'l.sport_id');
      const match = await baseQuery.where('m.id', matchId).first();
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      const isOpenMatch = !!(match.league_name && String(match.league_name).includes('Open Matches'));
      if (!isOpenMatch && hasUserLeagues) {
        const member = await k('user_leagues').where({ league_id: match.league_id, user_id: req.user.id }).first();
        if (!member) return res.status(403).json({ error: 'LEAGUE_MEMBERS_ONLY' });
      }

      const hasScores = hasColumn(matchInfo, 'home_score') && (match.home_score != null || match.away_score != null);
      if (hasScores) return res.status(409).json({ error: 'ALREADY_RECORDED' });

      const sportType = detectSportType(match, match);
      if (sportType === 'Team' || String(sportType).toLowerCase().includes('team')) {
        const teamIds = [match.home_team_id, match.away_team_id].filter((v) => v != null);
        if (teamIds.length >= 1) {
          const hasTeamMembers = await k.schema.hasTable('team_members').catch(() => false);
          if (!hasTeamMembers) return res.status(403).json({ error: 'ONLY_CAPTAIN_CAN_CANCEL' });
          const cap = await k('team_members')
            .whereIn('team_id', teamIds)
            .andWhere({ user_id: req.user.id, is_captain: 1 })
            .first();
          if (!cap) return res.status(403).json({ error: 'ONLY_CAPTAIN_CAN_CANCEL' });
        } else if (match.home_user_id && String(match.home_user_id) !== String(req.user.id)) {
          return res.status(403).json({ error: 'ONLY_OWNER_CAN_CANCEL' });
        }
      } else {
        const isPlayer = (String(match.home_user_id) === String(req.user.id)) || (String(match.away_user_id) === String(req.user.id));
        if (!isPlayer) return res.status(403).json({ error: 'ONLY_PLAYERS_CAN_CANCEL' });
      }

      await k('matches').where({ id: matchId }).del();
      return res.json({ deleted: true, id: matchId });
    } catch (e) {
      console.error('Delete match error:', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR', details: e && e.message });
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
        kind: row.kind || null,
        action: row.action || null,
        data: row.data || null,
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
        kind: row.kind || null,
        action: row.action || null,
        data: row.data || null,
        senderUserName: row.sender_user_name || null,
        senderTeamName: row.sender_team_name || null
      } : {
        id: newId,
        body: insertRec.body,
        createdAt: insertRec.created_at,
        senderUserId: insertRec.sender_user_id,
        senderTeamId: insertRec.sender_team_id,
        kind: null,
        action: null,
        data: null,
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

  // -------------------- Termin-Manager --------------------

  router.get('/:id/termin-manager', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      const k = getKnex();
      await ensureTerminManagerTables(k);
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const viewerId = Number(req.user.id) || null;
      const otherUserId = participant.side === 'home' ? match.away_user_id : match.home_user_id;
      
      // Get opponent user info
      let opponentName = null;
      if (otherUserId) {
        const opponentUser = await k('users').where({ id: otherUserId }).first();
        if (opponentUser) {
          opponentName = opponentUser.username || opponentUser.email || `User #${otherUserId}`;
        }
      }

      const options = await k('match_time_options')
        .where({ match_id: matchId })
        .orderBy('starts_at', 'asc');

      const latest = await k('match_schedule_proposals')
        .where({ match_id: matchId })
        .whereIn('status', ['sent'])
        .orderBy('created_at', 'desc')
        .first();

      let proposal = null;
      if (latest) {
        // Support both option_id (old) and proposed_datetime (new) proposals
        let startsAt = null;
        if (latest.option_id) {
          const opt = options.find((o) => Number(o.id) === Number(latest.option_id)) || null;
          startsAt = opt ? opt.starts_at : null;
        } else if (latest.proposed_datetime) {
          startsAt = latest.proposed_datetime;
        }
        
        proposal = {
          id: latest.id,
          status: latest.status,
          proposerUserId: latest.proposer_user_id,
          recipientUserId: latest.recipient_user_id,
          optionId: latest.option_id,
          startsAt: startsAt,
          proposed_datetime: latest.proposed_datetime || null, // Include for frontend compatibility
          note: latest.note || null,
          createdAt: latest.created_at,
          respondedAt: latest.responded_at || null
        };
      }

      res.json({
        meta: {
          viewerUserId: viewerId,
          viewerSide: participant.side,
          isOwner: participant.side === 'home',
          homeUserId: match.home_user_id,
          opponentUserId: otherUserId,
          opponentName: opponentName
        },
        options: (options || []).map((o) => ({ id: o.id, startsAt: o.starts_at, createdByUserId: o.created_by_user_id })),
        proposal
      });
    } catch (e) {
      console.error('Get termin-manager failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  router.post('/:id/termin-manager/options', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      const startsAtRaw = typeof req.body?.startsAt === 'string' ? req.body.startsAt : (typeof req.body?.starts_at === 'string' ? req.body.starts_at : '');
      const startsAt = safeParseISO(startsAtRaw);
      if (!startsAt) return res.status(400).json({ error: 'INVALID_STARTS_AT' });

      const k = getKnex();
      await ensureTerminManagerTables(k);
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });
      // Both parties can add time options

      const inserted = await k('match_time_options').insert({
        match_id: matchId,
        starts_at: startsAt,
        created_by_user_id: Number(req.user.id) || null,
        created_at: new Date().toISOString()
      });
      const newId = Array.isArray(inserted) ? inserted[0] : inserted;
      res.status(201).json({ id: newId, startsAt });
    } catch (e) {
      console.error('Add time option failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  router.delete('/:id/termin-manager/options/:optionId', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const optionId = Number(req.params.optionId);
      if (!matchId || !optionId) return res.status(400).json({ error: 'INVALID_ID' });
      const k = getKnex();
      await ensureTerminManagerTables(k);
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });
      // Both parties can remove time options
      await k('match_time_options').where({ id: optionId, match_id: matchId }).del();
      res.json({ ok: true });
    } catch (e) {
      console.error('Remove time option failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  router.post('/:id/termin-manager/proposals', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      const optionId = Number(req.body?.optionId || req.body?.option_id);
      if (!optionId) return res.status(400).json({ error: 'INVALID_OPTION_ID' });
      const note = typeof req.body?.note === 'string' ? req.body.note : (typeof req.body?.message === 'string' ? req.body.message : null);

      const k = getKnex();
      await ensureTerminManagerTables(k);
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const viewerId = Number(req.user.id) || null;
      const otherUserId = participant.side === 'home' ? match.away_user_id : match.home_user_id;
      if (!otherUserId) return res.status(400).json({ error: 'NO_OPPONENT_YET' });

      const opt = await k('match_time_options').where({ id: optionId, match_id: matchId }).first();
      if (!opt) return res.status(404).json({ error: 'OPTION_NOT_FOUND' });

      // Only one active proposal at a time: close previous sent proposal
      await k('match_schedule_proposals')
        .where({ match_id: matchId, status: 'sent' })
        .update({ status: 'countered', responded_at: new Date().toISOString() })
        .catch(() => {});

      const inserted = await k('match_schedule_proposals').insert({
        match_id: matchId,
        proposer_user_id: viewerId,
        recipient_user_id: Number(otherUserId),
        option_id: optionId,
        status: 'sent',
        note: (typeof note === 'string' && note.trim()) ? note.trim().slice(0, 2000) : null,
        created_at: new Date().toISOString()
      });
      const proposalId = Array.isArray(inserted) ? inserted[0] : inserted;

      await insertActionMessage(
        k,
        matchId,
        viewerId,
        participant.teamId || null,
        'schedule_proposed',
        { proposalId, optionId, startsAt: opt.starts_at },
        formatActionBody('📅 Terminvorschlag gesendet', opt.starts_at, note)
      );

      res.status(201).json({ id: proposalId, status: 'sent', optionId, startsAt: opt.starts_at });
    } catch (e) {
      console.error('Create proposal failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  router.post('/:id/termin-manager/proposals/:proposalId/accept', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const proposalId = Number(req.params.proposalId);
      if (!matchId || !proposalId) return res.status(400).json({ error: 'INVALID_ID' });
      const note = typeof req.body?.note === 'string' ? req.body.note : (typeof req.body?.message === 'string' ? req.body.message : null);

      const k = getKnex();
      await ensureTerminManagerTables(k);
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });
      const viewerId = Number(req.user.id) || null;

      const proposal = await k('match_schedule_proposals').where({ id: proposalId, match_id: matchId }).first();
      if (!proposal) return res.status(404).json({ error: 'PROPOSAL_NOT_FOUND' });
      if (proposal.status !== 'sent') return res.status(400).json({ error: 'PROPOSAL_NOT_ACTIVE' });
      if (Number(proposal.recipient_user_id) !== Number(viewerId)) return res.status(403).json({ error: 'NOT_RECIPIENT' });

      // Support both old (option_id) and new (proposed_datetime) proposals
      let agreedStartTime = null;
      if (proposal.option_id) {
        const opt = await k('match_time_options').where({ id: proposal.option_id, match_id: matchId }).first();
        if (!opt) return res.status(404).json({ error: 'OPTION_NOT_FOUND' });
        agreedStartTime = opt.starts_at;
      } else if (proposal.proposed_datetime) {
        agreedStartTime = proposal.proposed_datetime;
      } else {
        return res.status(400).json({ error: 'INVALID_PROPOSAL' });
      }

      await k('match_schedule_proposals').where({ id: proposalId }).update({
        status: 'accepted',
        responded_at: new Date().toISOString()
      });

      // Persist agreed kickoff_at on match and update status
      const matchInfo = await k('matches').columnInfo().catch(() => ({}));
      const updateData = {};
      if (Object.prototype.hasOwnProperty.call(matchInfo, 'kickoff_at')) {
        updateData.kickoff_at = agreedStartTime;
      }
      if (Object.prototype.hasOwnProperty.call(matchInfo, 'status')) {
        updateData.status = 'scheduled';
      }
      if (Object.keys(updateData).length > 0) {
        await k('matches').where({ id: matchId }).update(updateData);
      }

      // Send emails to both players
      const homeUser = await k('users').where({ id: match.home_user_id }).first();
      const awayUser = await k('users').where({ id: match.away_user_id }).first();
      
      if (ctx.sendMail && ctx.mailerState?.enabled) {
        const dateStr = new Date(agreedStartTime).toLocaleString('de-DE', { 
          weekday: 'long', 
          day: '2-digit', 
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const { renderEmailTemplate } = require('../emailTemplate');
        
        // Email to proposer (who sent the proposal)
        if (homeUser?.email && Number(proposal.proposer_user_id) === Number(match.home_user_id)) {
          const html = renderEmailTemplate({
            title: 'Terminvorschlag angenommen',
            body: `<p>Gute Nachrichten! Dein Terminvorschlag wurde angenommen.</p>
                   <p><strong>Match-Termin:</strong> ${dateStr}</p>
                   <p>Viel Erfolg bei eurem Match!</p>`,
            previewText: 'Dein Terminvorschlag wurde angenommen'
          });
          await ctx.sendMail(homeUser.email, 'Terminvorschlag angenommen - MatchLeague', html).catch(e => {
            console.error('Failed to send email to home user:', e);
          });
        } else if (awayUser?.email && Number(proposal.proposer_user_id) === Number(match.away_user_id)) {
          const html = renderEmailTemplate({
            title: 'Terminvorschlag angenommen',
            body: `<p>Gute Nachrichten! Dein Terminvorschlag wurde angenommen.</p>
                   <p><strong>Match-Termin:</strong> ${dateStr}</p>
                   <p>Viel Erfolg bei eurem Match!</p>`,
            previewText: 'Dein Terminvorschlag wurde angenommen'
          });
          await ctx.sendMail(awayUser.email, 'Terminvorschlag angenommen - MatchLeague', html).catch(e => {
            console.error('Failed to send email to away user:', e);
          });
        }
        
        // Email to acceptor (who accepted the proposal)
        if (homeUser?.email && Number(viewerId) === Number(match.home_user_id)) {
          const html = renderEmailTemplate({
            title: 'Match-Termin bestätigt',
            body: `<p>Du hast den Terminvorschlag angenommen.</p>
                   <p><strong>Match-Termin:</strong> ${dateStr}</p>
                   <p>Wir wünschen dir viel Erfolg!</p>`,
            previewText: 'Match-Termin bestätigt'
          });
          await ctx.sendMail(homeUser.email, 'Match-Termin bestätigt - MatchLeague', html).catch(e => {
            console.error('Failed to send email to home user:', e);
          });
        } else if (awayUser?.email && Number(viewerId) === Number(match.away_user_id)) {
          const html = renderEmailTemplate({
            title: 'Match-Termin bestätigt',
            body: `<p>Du hast den Terminvorschlag angenommen.</p>
                   <p><strong>Match-Termin:</strong> ${dateStr}</p>
                   <p>Wir wünschen dir viel Erfolg!</p>`,
            previewText: 'Match-Termin bestätigt'
          });
          await ctx.sendMail(awayUser.email, 'Match-Termin bestätigt - MatchLeague', html).catch(e => {
            console.error('Failed to send email to away user:', e);
          });
        }
      }

      await insertActionMessage(
        k,
        matchId,
        viewerId,
        participant.teamId || null,
        'schedule_accepted',
        { proposalId, optionId: proposal.option_id, startsAt: agreedStartTime },
        formatActionBody('✅ Terminvorschlag angenommen', agreedStartTime, note)
      );

      res.json({ ok: true, status: 'accepted', startsAt: agreedStartTime });
    } catch (e) {
      console.error('Accept proposal failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  router.post('/:id/termin-manager/proposals/:proposalId/reject', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const proposalId = Number(req.params.proposalId);
      if (!matchId || !proposalId) return res.status(400).json({ error: 'INVALID_ID' });
      const note = typeof req.body?.note === 'string' ? req.body.note : (typeof req.body?.message === 'string' ? req.body.message : null);

      const k = getKnex();
      await ensureTerminManagerTables(k);
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });
      const viewerId = Number(req.user.id) || null;

      const proposal = await k('match_schedule_proposals').where({ id: proposalId, match_id: matchId }).first();
      if (!proposal) return res.status(404).json({ error: 'PROPOSAL_NOT_FOUND' });
      if (proposal.status !== 'sent') return res.status(400).json({ error: 'PROPOSAL_NOT_ACTIVE' });
      if (Number(proposal.recipient_user_id) !== Number(viewerId)) return res.status(403).json({ error: 'NOT_RECIPIENT' });

      const opt = await k('match_time_options').where({ id: proposal.option_id, match_id: matchId }).first();

      await k('match_schedule_proposals').where({ id: proposalId }).update({
        status: 'rejected',
        responded_at: new Date().toISOString()
      });

      await insertActionMessage(
        k,
        matchId,
        viewerId,
        participant.teamId || null,
        'schedule_rejected',
        { proposalId, optionId: proposal.option_id, startsAt: opt ? opt.starts_at : null },
        formatActionBody('❌ Terminvorschlag abgelehnt', opt ? opt.starts_at : null, note)
      );

      res.json({ ok: true, status: 'rejected' });
    } catch (e) {
      console.error('Reject proposal failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  router.post('/:id/termin-manager/proposals/:proposalId/counter', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const proposalId = Number(req.params.proposalId);
      if (!matchId || !proposalId) return res.status(400).json({ error: 'INVALID_ID' });
      const newOptionId = Number(req.body?.optionId || req.body?.option_id);
      if (!newOptionId) return res.status(400).json({ error: 'INVALID_OPTION_ID' });
      const note = typeof req.body?.note === 'string' ? req.body.note : (typeof req.body?.message === 'string' ? req.body.message : null);

      const k = getKnex();
      await ensureTerminManagerTables(k);
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });
      const viewerId = Number(req.user.id) || null;

      const proposal = await k('match_schedule_proposals').where({ id: proposalId, match_id: matchId }).first();
      if (!proposal) return res.status(404).json({ error: 'PROPOSAL_NOT_FOUND' });
      if (proposal.status !== 'sent') return res.status(400).json({ error: 'PROPOSAL_NOT_ACTIVE' });
      if (Number(proposal.recipient_user_id) !== Number(viewerId)) return res.status(403).json({ error: 'NOT_RECIPIENT' });

      const opt = await k('match_time_options').where({ id: newOptionId, match_id: matchId }).first();
      if (!opt) return res.status(404).json({ error: 'OPTION_NOT_FOUND' });

      // Mark old as countered and create new proposal
      await k('match_schedule_proposals').where({ id: proposalId }).update({
        status: 'countered',
        responded_at: new Date().toISOString()
      });

      const otherUserId = Number(proposal.proposer_user_id);
      const inserted = await k('match_schedule_proposals').insert({
        match_id: matchId,
        proposer_user_id: viewerId,
        recipient_user_id: otherUserId,
        option_id: newOptionId,
        status: 'sent',
        note: (typeof note === 'string' && note.trim()) ? note.trim().slice(0, 2000) : null,
        created_at: new Date().toISOString()
      });
      const newId = Array.isArray(inserted) ? inserted[0] : inserted;

      await insertActionMessage(
        k,
        matchId,
        viewerId,
        participant.teamId || null,
        'schedule_counter_proposed',
        { proposalId: newId, counterTo: proposalId, optionId: newOptionId, startsAt: opt.starts_at },
        formatActionBody('📅 Gegenvorschlag gesendet', opt.starts_at, note)
      );

      res.status(201).json({ id: newId, status: 'sent', optionId: newOptionId, startsAt: opt.starts_at });
    } catch (e) {
      console.error('Counter proposal failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // -------------------- Availability System --------------------

  // GET availability for match (both players)
  router.get('/:id/availability', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      
      const k = getKnex();
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const viewerId = Number(req.user.id);
      const otherUserId = participant.side === 'home' ? match.away_user_id : match.home_user_id;

      // Get availability days for both users
      const days = await k('match_availability_days')
        .where({ match_id: matchId })
        .select('*');

      // Get windows for all days
      const dayIds = days.map(d => d.id);
      const windows = dayIds.length > 0 
        ? await k('match_availability_windows')
            .whereIn('day_id', dayIds)
            .select('*')
        : [];

      // Group by user
      const myDays = days.filter(d => Number(d.user_id) === viewerId);
      const theirDays = days.filter(d => Number(d.user_id) === otherUserId);

      const formatDay = (day) => ({
        id: day.id,
        date: day.date,
        windows: windows.filter(w => w.day_id === day.id).map(w => ({
          id: w.id,
          timeStart: w.time_start,
          timeEnd: w.time_end,
          preset: w.preset
        }))
      });

      res.json({
        myAvailability: myDays.map(formatDay),
        theirAvailability: theirDays.map(formatDay),
        meta: {
          viewerUserId: viewerId,
          opponentUserId: otherUserId
        }
      });
    } catch (e) {
      console.error('Get availability failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST add availability day
  router.post('/:id/availability/days', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      
      const { date } = req.body;
      if (!date) return res.status(400).json({ error: 'DATE_REQUIRED' });

      const k = getKnex();
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      // Check if day already exists for this user
      const existing = await k('match_availability_days')
        .where({ match_id: matchId, user_id: Number(req.user.id), date })
        .first();

      if (existing) {
        return res.status(409).json({ error: 'DAY_ALREADY_EXISTS', dayId: existing.id });
      }

      const inserted = await k('match_availability_days').insert({
        match_id: matchId,
        user_id: Number(req.user.id),
        date,
        created_at: new Date().toISOString()
      });
      const dayId = Array.isArray(inserted) ? inserted[0] : inserted;

      // Send notification to other player on first availability entry
      try {
        const otherUserId = participant.side === 'home' ? match.away_user_id : match.home_user_id;
        if (otherUserId) {
          // Check if this is the first availability day for this user
          const existingDays = await k('match_availability_days')
            .where({ match_id: matchId, user_id: Number(req.user.id) })
            .select('id');
          
          if (existingDays.length === 1) { // First day created
            const currentUser = await k('users').where({ id: Number(req.user.id) }).first();
            const userName = currentUser?.firstname || currentUser?.name || `User ${req.user.id}`;
            const leagueInfo = match.league_id ? await k('leagues').where({ id: match.league_id }).first() : null;
            const leagueName = leagueInfo?.name || '';
            
            await k('notifications').insert({
              user_id: otherUserId,
              type: 'availability_shared',
              match_id: matchId,
              from_user_id: Number(req.user.id),
              title: 'Verfügbarkeiten eingetragen',
              message: `${userName} hat Verfügbarkeiten für euer Match eingetragen. Jetzt kannst du einen passenden Termin vorschlagen!`,
              created_at: new Date().toISOString(),
              is_read: 0
            }).catch(() => {}); // Ignore notification errors
          }
        }
      } catch (notifErr) {
        // Ignore notification errors - don't fail the main request
      }

      res.status(201).json({ id: dayId, date });
    } catch (e) {
      console.error('Add availability day failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // DELETE availability day
  router.delete('/:id/availability/days/:dayId', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const dayId = Number(req.params.dayId);
      if (!matchId || !dayId) return res.status(400).json({ error: 'INVALID_ID' });

      const k = getKnex();
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      // Delete only own days
      await k('match_availability_days')
        .where({ id: dayId, match_id: matchId, user_id: Number(req.user.id) })
        .del();

      res.json({ ok: true });
    } catch (e) {
      console.error('Delete availability day failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST add time window to a day
  router.post('/:id/availability/days/:dayId/windows', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const dayId = Number(req.params.dayId);
      if (!matchId || !dayId) return res.status(400).json({ error: 'INVALID_ID' });

      const { timeStart, timeEnd, preset } = req.body;
      if (!timeStart || !timeEnd) return res.status(400).json({ error: 'TIME_START_END_REQUIRED' });

      const k = getKnex();
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      // Verify day belongs to current user
      const day = await k('match_availability_days')
        .where({ id: dayId, match_id: matchId, user_id: Number(req.user.id) })
        .first();

      if (!day) return res.status(404).json({ error: 'DAY_NOT_FOUND' });

      const inserted = await k('match_availability_windows').insert({
        day_id: dayId,
        time_start: timeStart,
        time_end: timeEnd,
        preset: preset || null,
        created_at: new Date().toISOString()
      });
      const windowId = Array.isArray(inserted) ? inserted[0] : inserted;

      res.status(201).json({ id: windowId, timeStart, timeEnd, preset });
    } catch (e) {
      console.error('Add time window failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // DELETE time window
  router.delete('/:id/availability/windows/:windowId', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const windowId = Number(req.params.windowId);
      if (!matchId || !windowId) return res.status(400).json({ error: 'INVALID_ID' });

      const k = getKnex();
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      // Get window and verify ownership through day
      const window = await k('match_availability_windows').where({ id: windowId }).first();
      if (!window) return res.status(404).json({ error: 'WINDOW_NOT_FOUND' });

      const day = await k('match_availability_days')
        .where({ id: window.day_id, user_id: Number(req.user.id) })
        .first();

      if (!day) return res.status(403).json({ error: 'NOT_YOUR_WINDOW' });

      await k('match_availability_windows').where({ id: windowId }).del();

      res.json({ ok: true });
    } catch (e) {
      console.error('Delete time window failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // GET overlapping availability (times when both players are free)
  router.get('/:id/availability/overlaps', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });

      const k = getKnex();
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const viewerId = Number(req.user.id);
      const otherUserId = participant.side === 'home' ? match.away_user_id : match.home_user_id;

      // Get all days from both users
      const myDays = await k('match_availability_days')
        .where({ match_id: matchId, user_id: viewerId })
        .select('*');

      const theirDays = await k('match_availability_days')
        .where({ match_id: matchId, user_id: otherUserId })
        .select('*');

      // Find common dates
      const myDates = myDays.map(d => d.date);
      const theirDates = theirDays.map(d => d.date);
      const commonDates = myDates.filter(d => theirDates.includes(d));

      const overlaps = [];

      for (const date of commonDates) {
        const myDay = myDays.find(d => d.date === date);
        const theirDay = theirDays.find(d => d.date === date);

        // Get windows for both
        const myWindows = await k('match_availability_windows')
          .where({ day_id: myDay.id })
          .select('*');

        const theirWindows = await k('match_availability_windows')
          .where({ day_id: theirDay.id })
          .select('*');

        // Find overlapping time windows
        for (const myWin of myWindows) {
          for (const theirWin of theirWindows) {
            const myStart = myWin.time_start;
            const myEnd = myWin.time_end;
            const theirStart = theirWin.time_start;
            const theirEnd = theirWin.time_end;

            // Check if windows overlap
            const overlapStart = myStart > theirStart ? myStart : theirStart;
            const overlapEnd = myEnd < theirEnd ? myEnd : theirEnd;

            if (overlapStart < overlapEnd) {
              overlaps.push({
                date,
                timeStart: overlapStart,
                timeEnd: overlapEnd
              });
            }
          }
        }
      }

      res.json({ overlaps });
    } catch (e) {
      console.error('Get availability overlaps failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST propose concrete datetime (replaces old proposal system)
  router.post('/:id/availability/propose', requireAuth, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!matchId) return res.status(400).json({ error: 'INVALID_MATCH_ID' });

      const { datetime, note } = req.body;
      if (!datetime) return res.status(400).json({ error: 'DATETIME_REQUIRED' });

      const proposedDatetime = safeParseISO(datetime);
      if (!proposedDatetime) return res.status(400).json({ error: 'INVALID_DATETIME' });

      const k = getKnex();
      await ensureTerminManagerTables(k);
      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const viewerId = Number(req.user.id);
      const otherUserId = participant.side === 'home' ? match.away_user_id : match.home_user_id;

      // Close any previous active proposals
      await k('match_schedule_proposals')
        .where({ match_id: matchId, status: 'sent' })
        .update({ status: 'countered', responded_at: new Date().toISOString() })
        .catch(() => {});

      // Create new proposal
      const inserted = await k('match_schedule_proposals').insert({
        match_id: matchId,
        proposer_user_id: viewerId,
        recipient_user_id: otherUserId,
        option_id: null, // Not using options anymore
        proposed_datetime: proposedDatetime,
        status: 'sent',
        note: (typeof note === 'string' && note.trim()) ? note.trim().slice(0, 2000) : null,
        created_at: new Date().toISOString()
      });
      const proposalId = Array.isArray(inserted) ? inserted[0] : inserted;

      await insertActionMessage(
        k,
        matchId,
        viewerId,
        participant.teamId || null,
        'schedule_proposed',
        { proposalId, datetime: proposedDatetime },
        formatActionBody('📅 Terminvorschlag gesendet', proposedDatetime, note)
      );

      // Create notification for recipient
      try {
        const currentUser = await k('users').where({ id: viewerId }).first();
        const userName = currentUser?.firstname || currentUser?.name || `User ${viewerId}`;
        const leagueInfo = match.league_id ? await k('leagues').where({ id: match.league_id }).first() : null;
        const leagueName = leagueInfo?.name || '';
        const formattedDate = new Date(proposedDatetime).toLocaleString('de-DE', { 
          weekday: 'short', 
          day: '2-digit', 
          month: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        await k('notifications').insert({
          user_id: otherUserId,
          type: 'schedule_proposal',
          match_id: matchId,
          from_user_id: viewerId,
          proposal_id: proposalId,
          title: 'Terminvorschlag erhalten',
          message: `${userName} hat dir einen Terminvorschlag gesendet: ${formattedDate}`,
          created_at: new Date().toISOString(),
          is_read: 0
        }).catch(() => {}); // Ignore notification errors
      } catch (notifErr) {
        // Ignore notification errors - don't fail the main request
      }

      res.status(201).json({ id: proposalId, status: 'sent', datetime: proposedDatetime });
    } catch (e) {
      console.error('Propose datetime failed', e && (e.stack || e.message || e));
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // =============================
  // TIME SLOT SYSTEM
  // =============================

  // GET /:id/time-slots - Zeitrahmen und Slots laden
  router.get('/:id/time-slots', requireAuth, async (req, res) => {
    try {
      const matchId = parseInt(req.params.id, 10);
      const viewerId = req.user?.id;
      if (!matchId || !viewerId) return res.status(400).json({ error: 'INVALID_REQUEST' });

      const k = getKnex();
      const { isHost, isJoined, match, participant } = await loadMatch(k, matchId, viewerId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      if (!isHost && !isJoined) return res.status(403).json({ error: 'FORBIDDEN' });

      const matchInfo = await k('matches').columnInfo().catch(() => ({}));
      let matchDuration = 60;
      if (match && hasColumn(matchInfo, 'duration_minutes')) {
        const dur = Number(match.duration_minutes);
        if (Number.isFinite(dur) && dur > 0) matchDuration = dur;
      }
      if (match && hasColumn(matchInfo, 'slot_duration_minutes')) {
        const dur = Number(match.slot_duration_minutes);
        if (Number.isFinite(dur) && dur > 0) matchDuration = dur;
      }
      if (match && hasColumn(matchInfo, 'duration')) {
        const dur = Number(match.duration);
        if (Number.isFinite(dur) && dur > 0) matchDuration = dur;
      }

      const hostUserId = match?.home_user_id ?? match?.owner_id ?? match?.host_user_id ?? null;
      let hostName = null;
      const hasUsers = await k.schema.hasTable('users').catch(() => false);
      if (hasUsers && hostUserId) {
        const hostUser = await k('users').where({ id: hostUserId }).first();
        if (hostUser) hostName = hostUser.username || hostUser.email || `User #${hostUserId}`;
      }

      const opponentId = isHost ? participant.opponentId : match.owner_id;

      // Zeitrahmen laden
      const frames = await k('match_time_frames')
        .where('match_id', matchId)
        .orderBy('date', 'asc')
        .orderBy('time_start', 'asc');

      // Slots laden
      const slots = await k('match_time_slots')
        .where('match_id', matchId)
        .orderBy('slot_start', 'asc');

      res.json({
        frames: frames || [],
        slots: slots || [],
        meta: {
          isHost,
          isJoined,
          viewerId,
          opponentId,
          hostUserId,
          hostName,
          slotDurationMinutes: matchDuration,
          canCreateFrames: isHost,
          canCreateSlots: isJoined, // backwards compat for UI
          canProposeSlots: isJoined
        }
      });
    } catch (e) {
      console.error('[time-slots] Load failed', e);
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST /:id/time-frames - Host creates availability frames
  router.post('/:id/time-frames', requireAuth, async (req, res) => {
    try {
      const matchId = parseInt(req.params.id, 10);
      const viewerId = req.user?.id;
      const { date, timeStart, timeEnd } = req.body;

      if (!matchId || !viewerId || !date || !timeStart || !timeEnd) {
        return res.status(400).json({ error: 'INVALID_REQUEST' });
      }

      const k = getKnex();
      const { isHost, match } = await loadMatch(k, matchId, viewerId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      if (!isHost) return res.status(403).json({ error: 'FORBIDDEN' });

      // Prüfe ob Zeitrahmen bereits existiert
      const existing = await k('match_time_frames')
        .where({ match_id: matchId, date, time_start: timeStart, time_end: timeEnd })
        .first();
      
      if (existing) {
        return res.json({ id: existing.id });
      }

      const [id] = await k('match_time_frames').insert({
        match_id: matchId,
        date,
        time_start: timeStart,
        time_end: timeEnd,
        created_by_user_id: viewerId
      });

      res.status(201).json({ id });
    } catch (e) {
      console.error('[time-frames] Create failed', e);
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // DELETE /:id/time-frames/:frameId - Host löscht Zeitrahmen
  router.delete('/:id/time-frames/:frameId', requireAuth, async (req, res) => {
    try {
      const matchId = parseInt(req.params.id, 10);
      const frameId = parseInt(req.params.frameId, 10);
      const viewerId = req.user?.id;

      const k = getKnex();
      const { isHost } = await loadMatch(k, matchId, viewerId);
      if (!isHost) return res.status(403).json({ error: 'FORBIDDEN' });

      await k('match_time_frames').where({ id: frameId, match_id: matchId }).delete();
      res.json({ ok: true });
    } catch (e) {
      console.error('[time-frames] Delete failed', e);
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST /:id/time-slots - Beigetretener wählt Slot
  router.post('/:id/time-slots', requireAuth, async (req, res) => {
    try {
      const matchId = parseInt(req.params.id, 10);
      const viewerId = req.user?.id;
      const { frameId, slotStart, slotEnd, durationMinutes } = req.body;

      if (!matchId || !viewerId || !frameId || !slotStart || !slotEnd || !durationMinutes) {
        return res.status(400).json({ error: 'INVALID_REQUEST' });
      }

      const k = getKnex();
      const { isJoined, match } = await loadMatch(k, matchId, viewerId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      if (!isJoined) return res.status(403).json({ error: 'ONLY_JOINED_CAN_CREATE_SLOTS' });

      const frame = await k('match_time_frames').where({ id: frameId, match_id: matchId }).first();
      if (!frame) return res.status(404).json({ error: 'FRAME_NOT_FOUND' });

      const duration = Number(durationMinutes);
      if (!Number.isFinite(duration) || duration <= 0) return res.status(400).json({ error: 'INVALID_DURATION' });

      const startDt = new Date(slotStart);
      if (Number.isNaN(startDt.getTime())) return res.status(400).json({ error: 'INVALID_SLOT_START' });
      const frameStart = new Date(`${frame.date}T${frame.time_start}`);
      const frameEnd = new Date(`${frame.date}T${frame.time_end}`);
      const computedEnd = new Date(startDt.getTime() + duration * 60000);
      if (Number.isNaN(frameStart.getTime()) || Number.isNaN(frameEnd.getTime())) return res.status(400).json({ error: 'INVALID_FRAME_WINDOW' });
      if (startDt < frameStart || computedEnd > frameEnd || computedEnd <= startDt) {
        return res.status(400).json({ error: 'OUTSIDE_FRAME' });
      }

      const slotStartIso = startDt.toISOString();
      const slotEndIso = computedEnd.toISOString();

      // Prüfe ob Slot bereits existiert
      const existing = await k('match_time_slots')
        .where({
          match_id: matchId,
          frame_id: frameId,
          slot_start: slotStartIso,
          slot_end: slotEndIso,
          selected_by_user_id: viewerId
        })
        .first();
      
      if (existing) {
        return res.json({ id: existing.id });
      }

      const [id] = await k('match_time_slots').insert({
        match_id: matchId,
        frame_id: frameId,
        slot_start: slotStartIso,
        slot_end: slotEndIso,
        duration_minutes: duration,
        selected_by_user_id: viewerId,
        status: 'proposed'
      });

      const participantDetail = await resolveParticipant(k, match, viewerId);
      await insertActionMessage(
        k,
        matchId,
        Number(viewerId) || null,
        participantDetail.teamId || null,
        'schedule_proposed',
        { slotId: id, frameId, startsAt: slotStartIso, endsAt: slotEndIso },
        formatActionBody('📅 Spielanfrage gesendet', slotStartIso, null)
      );

      res.status(201).json({ id, slotStart: slotStartIso, slotEnd: slotEndIso, durationMinutes: duration });
    } catch (e) {
      console.error('[time-slots] Create failed', e);
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // DELETE /:id/time-slots/:slotId - Beigetretener löscht Slot
  router.delete('/:id/time-slots/:slotId', requireAuth, async (req, res) => {
    try {
      const matchId = parseInt(req.params.id, 10);
      const slotId = parseInt(req.params.slotId, 10);
      const viewerId = req.user?.id;

      const k = getKnex();
      const { isJoined } = await loadMatch(k, matchId, viewerId);
      if (!isJoined) return res.status(403).json({ error: 'FORBIDDEN' });

      await k('match_time_slots')
        .where({ id: slotId, match_id: matchId, selected_by_user_id: viewerId })
        .delete();
      
      res.json({ ok: true });
    } catch (e) {
      console.error('[time-slots] Delete failed', e);
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  // POST /:id/time-slots/:slotId/accept - Host akzeptiert Slot
  router.post('/:id/time-slots/:slotId/accept', requireAuth, async (req, res) => {
    try {
      const matchId = parseInt(req.params.id, 10);
      const slotId = parseInt(req.params.slotId, 10);
      const viewerId = req.user?.id;

      const k = getKnex();
      const { isHost } = await loadMatch(k, matchId, viewerId);
      if (!isHost) return res.status(403).json({ error: 'ONLY_HOST_CAN_ACCEPT' });

      const slot = await k('match_time_slots')
        .where({ id: slotId, match_id: matchId })
        .first();
      
      if (!slot) return res.status(404).json({ error: 'SLOT_NOT_FOUND' });
      if (slot.status === 'accepted') {
        return res.json({ ok: true, alreadyAccepted: true });
      }

      // Update slot status
      await k('match_time_slots')
        .where({ id: slotId })
        .update({
          status: 'accepted',
          accepted_by_user_id: viewerId,
          responded_at: new Date().toISOString()
        });

      // Update match with scheduled slot
      await k('matches')
        .where({ id: matchId })
        .update({
          scheduled_slot_id: slotId,
          scheduled_at: slot.slot_start
        });

      res.json({ ok: true });
    } catch (e) {
      console.error('[time-slots] Accept failed', e);
      res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  return router;
};
