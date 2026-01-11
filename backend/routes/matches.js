const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { renderEmailTemplate } = require('../src/emailTemplate');

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

  // Resolve whether a match lives in the new "matches" table or the legacy "games" table
  async function resolveMatchTable(k, id) {
    const hasMatches = await k.schema.hasTable('matches').catch(() => false);
    if (hasMatches) {
      const row = await k('matches').where('id', id).first().catch(() => null);
      if (row) return { table: 'matches', row };
    }
    const hasGames = await k.schema.hasTable('games').catch(() => false);
    if (hasGames) {
      const row = await k('games').where('id', id).first().catch(() => null);
      if (row) return { table: 'games', row };
    }
    return { table: null, row: null };
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

  async function ensureMatchMessagesTable(k) {
    const has = await k.schema.hasTable('match_messages').catch(() => false);
    if (has) return;
    await k.schema.createTable('match_messages', (table) => {
      table.increments('id').primary();
      table.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
      table.integer('sender_user_id').references('id').inTable('users').onDelete('SET NULL');
      table.integer('sender_team_id').references('id').inTable('teams').onDelete('SET NULL');
      table.text('body').notNullable();
      table.text('created_at').notNullable().defaultTo(k.raw('CURRENT_TIMESTAMP'));
      table.index(['match_id'], 'idx_match_messages_match');
    });
  }

  async function ensureTerminManagerTables(k) {
    const hasMatches = await k.schema.hasTable('matches').catch(() => false);
    if (!hasMatches) return;

    const hasUsers = await k.schema.hasTable('users').catch(() => false);

    const hasOptions = await k.schema.hasTable('match_time_options').catch(() => false);
    if (!hasOptions) {
      await k.schema.createTable('match_time_options', (t) => {
        t.increments('id').primary();
        t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
        t.text('starts_at').notNullable();
        if (hasUsers) t.integer('created_by_user_id').references('id').inTable('users').onDelete('SET NULL');
        else t.integer('created_by_user_id').nullable();
        t.text('created_at').notNullable().defaultTo(k.raw('CURRENT_TIMESTAMP'));
        t.index(['match_id'], 'idx_match_time_options_match');
        t.index(['match_id', 'starts_at'], 'idx_match_time_options_match_starts');
      });
    }

    const hasProposals = await k.schema.hasTable('match_schedule_proposals').catch(() => false);
    if (!hasProposals) {
      await k.schema.createTable('match_schedule_proposals', (t) => {
        t.increments('id').primary();
        t.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
        t.integer('proposer_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        t.integer('recipient_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        t.integer('option_id').notNullable().references('id').inTable('match_time_options').onDelete('CASCADE');
        t.string('status', 20).notNullable().defaultTo('sent');
        t.text('note').nullable();
        t.text('created_at').notNullable().defaultTo(k.raw('CURRENT_TIMESTAMP'));
        t.text('responded_at').nullable();
        t.index(['match_id'], 'idx_match_schedule_proposals_match');
        t.index(['match_id', 'status'], 'idx_match_schedule_proposals_match_status');
      });
    }

    // match_messages action columns (best-effort)
    const hasMM = await k.schema.hasTable('match_messages').catch(() => false);
    if (hasMM) {
      const info = await k('match_messages').columnInfo().catch(() => ({}));
      const needKind = !Object.prototype.hasOwnProperty.call(info, 'kind');
      const needAction = !Object.prototype.hasOwnProperty.call(info, 'action');
      const needData = !Object.prototype.hasOwnProperty.call(info, 'data');
      if (needKind || needAction || needData) {
        await k.schema.table('match_messages', (t) => {
          if (needKind) t.string('kind', 20).nullable();
          if (needAction) t.string('action', 50).nullable();
          if (needData) t.text('data').nullable();
        });
      }
    }
  }

  function formatStartsAt(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso || '');
      return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(iso || '');
    }
  }

  async function insertActionMessage(k, { matchId, senderUserId, senderTeamId, action, body, data }) {
    await ensureMatchMessagesTable(k);
    const info = await k('match_messages').columnInfo().catch(() => ({}));
    const rec = {
      match_id: matchId,
      body: body,
      sender_user_id: senderUserId || null,
      sender_team_id: senderTeamId || null,
      created_at: new Date().toISOString(),
    };
    if (Object.prototype.hasOwnProperty.call(info, 'kind')) rec.kind = 'action';
    if (Object.prototype.hasOwnProperty.call(info, 'action')) rec.action = action;
    if (Object.prototype.hasOwnProperty.call(info, 'data')) rec.data = data ? JSON.stringify(data) : null;
    const inserted = await k('match_messages').insert(rec);
    const newId = Array.isArray(inserted) ? inserted[0] : inserted;
    return fetchMessageById(k, newId);
  }

  function buildUserDisplayExpression(usersInfo, alias) {
    if (!usersInfo) usersInfo = {};
    const hasFirst = Object.prototype.hasOwnProperty.call(usersInfo, 'firstname');
    const hasLast = Object.prototype.hasOwnProperty.call(usersInfo, 'lastname');
    const hasName = Object.prototype.hasOwnProperty.call(usersInfo, 'name');
    const hasEmail = Object.prototype.hasOwnProperty.call(usersInfo, 'email');

    const parts = [];
    if (hasFirst || hasLast) {
      const firstExpr = hasFirst ? `COALESCE(${alias}.firstname,'')` : "''";
      const lastExpr = hasLast ? `COALESCE(${alias}.lastname,'')` : "''";
      parts.push(`NULLIF(TRIM(${firstExpr} || ' ' || ${lastExpr}), '')`);
    }
    if (hasName) parts.push(`${alias}.name`);
    if (hasEmail) parts.push(`${alias}.email`);
    if (!parts.length) return "''";
    return `COALESCE(${parts.join(', ')})`;
  }

  async function fetchUserBasics(k, ids) {
    const normalized = Array.from(new Set((ids || []).map((v) => Number(v)).filter((v) => Number.isFinite(v))));
    if (!normalized.length) return [];
    const hasUsers = await k.schema.hasTable('users').catch(() => false);
    if (!hasUsers) return [];
    const info = await k('users').columnInfo().catch(() => ({}));
    const cols = ['id'];
    if (Object.prototype.hasOwnProperty.call(info, 'email')) cols.push('email');
    if (Object.prototype.hasOwnProperty.call(info, 'firstname')) cols.push('firstname');
    if (Object.prototype.hasOwnProperty.call(info, 'lastname')) cols.push('lastname');
    if (Object.prototype.hasOwnProperty.call(info, 'name')) cols.push('name');
    return k('users').whereIn('id', normalized).select(cols);
  }

  async function fetchTeamBasics(k, ids) {
    const normalized = Array.from(new Set((ids || []).map((v) => Number(v)).filter((v) => Number.isFinite(v))));
    if (!normalized.length) return [];
    const hasTeams = await k.schema.hasTable('teams').catch(() => false);
    if (!hasTeams) return [];
    return k('teams').whereIn('id', normalized).select(['id', 'name']).catch(() => []);
  }

  async function loadMatch(k, matchId) {
    const hasMatches = await k.schema.hasTable('matches').catch(() => false);
    if (!hasMatches) return null;
    return k('matches').where({ id: matchId }).first();
  }

  async function resolveParticipant(k, match, userId) {
    const base = { allowed: false, side: null, teamId: null, matchType: (match?.home_team_id || match?.away_team_id) ? 'teams' : 'singles' };
    if (!match) return base;
    const userIdNum = Number(userId);
    if (match.home_user_id != null && Number(match.home_user_id) === userIdNum) {
      return { ...base, allowed: true, side: 'home' };
    }
    if (match.away_user_id != null && Number(match.away_user_id) === userIdNum) {
      return { ...base, allowed: true, side: 'away' };
    }
    const teamIds = [match.home_team_id, match.away_team_id].filter((v) => v != null);
    if (!teamIds.length) return base;
    const hasTeamMembers = await k.schema.hasTable('team_members').catch(() => false);
    if (!hasTeamMembers) return base;
    const membership = await k('team_members').whereIn('team_id', teamIds).andWhere('user_id', userIdNum).first();
    if (!membership) return base;
    const side = membership.team_id === match.home_team_id ? 'home' : (membership.team_id === match.away_team_id ? 'away' : null);
    return { ...base, allowed: true, side, teamId: membership.team_id };
  }

  async function fetchMessages(k, matchId) {
    const hasUsers = await k.schema.hasTable('users').catch(() => false);
    const hasTeams = await k.schema.hasTable('teams').catch(() => false);
    const mmInfo = await k('match_messages').columnInfo().catch(() => ({}));
    const hasKind = Object.prototype.hasOwnProperty.call(mmInfo, 'kind');
    const hasAction = Object.prototype.hasOwnProperty.call(mmInfo, 'action');
    const hasData = Object.prototype.hasOwnProperty.call(mmInfo, 'data');
    const usersInfo = hasUsers ? await k('users').columnInfo().catch(() => ({})) : {};
    const userExpr = hasUsers ? buildUserDisplayExpression(usersInfo, 'u') : null;
    const hasUserAvatar = hasUsers && Object.prototype.hasOwnProperty.call(usersInfo, 'avatar_url');
    const cols = [
      { id: 'mm.id' },
      { body: 'mm.body' },
      ...(hasKind ? [{ kind: 'mm.kind' }] : [k.raw('NULL as kind')]),
      ...(hasAction ? [{ action: 'mm.action' }] : [k.raw('NULL as action')]),
      ...(hasData ? [{ data: 'mm.data' }] : [k.raw('NULL as data')]),
      { created_at: 'mm.created_at' },
      { sender_user_id: 'mm.sender_user_id' },
      { sender_team_id: 'mm.sender_team_id' },
    ];
    if (hasUsers && userExpr) cols.push(k.raw(`${userExpr} as sender_user_name`));
    else cols.push(k.raw("'' as sender_user_name"));
    if (hasUsers && hasUserAvatar) cols.push({ sender_user_avatar: 'u.avatar_url' });
    else cols.push(k.raw('NULL as sender_user_avatar'));
    if (hasTeams) {
      cols.push({ sender_team_name: 't.name' });
    } else {
      cols.push(k.raw("'' as sender_team_name"));
    }
    const query = k({ mm: 'match_messages' });
    if (hasUsers) query.leftJoin({ u: 'users' }, 'u.id', 'mm.sender_user_id');
    if (hasTeams) query.leftJoin({ t: 'teams' }, 't.id', 'mm.sender_team_id');
    return query
      .where('mm.match_id', matchId)
      .orderBy('mm.created_at', 'asc')
      .select(cols);
  }

  async function fetchMessageById(k, id) {
    const hasUsers = await k.schema.hasTable('users').catch(() => false);
    const hasTeams = await k.schema.hasTable('teams').catch(() => false);
    const mmInfo = await k('match_messages').columnInfo().catch(() => ({}));
    const hasKind = Object.prototype.hasOwnProperty.call(mmInfo, 'kind');
    const hasAction = Object.prototype.hasOwnProperty.call(mmInfo, 'action');
    const hasData = Object.prototype.hasOwnProperty.call(mmInfo, 'data');
    const usersInfo = hasUsers ? await k('users').columnInfo().catch(() => ({})) : {};
    const userExpr = hasUsers ? buildUserDisplayExpression(usersInfo, 'u') : null;
    const hasUserAvatar = hasUsers && Object.prototype.hasOwnProperty.call(usersInfo, 'avatar_url');
    const cols = [
      { id: 'mm.id' },
      { body: 'mm.body' },
      ...(hasKind ? [{ kind: 'mm.kind' }] : [k.raw('NULL as kind')]),
      ...(hasAction ? [{ action: 'mm.action' }] : [k.raw('NULL as action')]),
      ...(hasData ? [{ data: 'mm.data' }] : [k.raw('NULL as data')]),
      { created_at: 'mm.created_at' },
      { sender_user_id: 'mm.sender_user_id' },
      { sender_team_id: 'mm.sender_team_id' },
    ];
    if (hasUsers && userExpr) cols.push(k.raw(`${userExpr} as sender_user_name`));
    else cols.push(k.raw("'' as sender_user_name"));
    if (hasUsers && hasUserAvatar) cols.push({ sender_user_avatar: 'u.avatar_url' });
    else cols.push(k.raw('NULL as sender_user_avatar'));
    if (hasTeams) {
      cols.push({ sender_team_name: 't.name' });
    } else {
      cols.push(k.raw("'' as sender_team_name"));
    }
    const query = k({ mm: 'match_messages' });
    if (hasUsers) query.leftJoin({ u: 'users' }, 'u.id', 'mm.sender_user_id');
    if (hasTeams) query.leftJoin({ t: 'teams' }, 't.id', 'mm.sender_team_id');
    return query
      .where('mm.id', id)
      .first(cols);
  }

  router.get('/my/chats', isAuthenticated, async (req, res) => {
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const userId = req.user.id;
      const matchInfo = await k('matches').columnInfo().catch(() => ({}));
      if (!matchInfo || !Object.keys(matchInfo).length) {
        return res.json({ chats: [] });
      }

      const hasHomeUserId = Object.prototype.hasOwnProperty.call(matchInfo, 'home_user_id');
      const hasAwayUserId = Object.prototype.hasOwnProperty.call(matchInfo, 'away_user_id');
      const hasHomeTeamId = Object.prototype.hasOwnProperty.call(matchInfo, 'home_team_id');
      const hasAwayTeamId = Object.prototype.hasOwnProperty.call(matchInfo, 'away_team_id');
      const hasHomeScore = Object.prototype.hasOwnProperty.call(matchInfo, 'home_score');
      const hasAwayScore = Object.prototype.hasOwnProperty.call(matchInfo, 'away_score');
      const hasCreatedAt = Object.prototype.hasOwnProperty.call(matchInfo, 'created_at');
      const hasKickoffAt = Object.prototype.hasOwnProperty.call(matchInfo, 'kickoff_at');
      const hasUpdatedAt = Object.prototype.hasOwnProperty.call(matchInfo, 'updated_at');
      const hasCompletedAt = Object.prototype.hasOwnProperty.call(matchInfo, 'completed_at');
      const hasStatus = Object.prototype.hasOwnProperty.call(matchInfo, 'status');

      if (!hasHomeUserId && !hasAwayUserId && !hasHomeTeamId && !hasAwayTeamId) {
        return res.json({ chats: [] });
      }

      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      const hasTeamMembers = await k.schema.hasTable('team_members').catch(() => false);
      const hasLeagues = await k.schema.hasTable('leagues').catch(() => false);

      const base = k({ m: 'matches' });
      if (hasLeagues) base.leftJoin({ l: 'leagues' }, 'l.id', 'm.league_id');
      if (hasSports && hasLeagues) base.leftJoin({ s: 'sports' }, 's.id', 'l.sport_id');

      base.select('m.id', { leagueId: 'm.league_id' });
      if (hasLeagues) base.select({ leagueName: 'l.name' }); else base.select(k.raw("'' as leagueName"));
      if (hasSports && hasLeagues) base.select({ sportName: 's.name' }); else base.select(k.raw("'' as sportName"));
      if (hasHomeUserId) base.select({ homeUserId: 'm.home_user_id' }); else base.select(k.raw('NULL as homeUserId'));
      if (hasAwayUserId) base.select({ awayUserId: 'm.away_user_id' }); else base.select(k.raw('NULL as awayUserId'));
      if (hasHomeTeamId) base.select({ homeTeamId: 'm.home_team_id' }); else base.select(k.raw('NULL as homeTeamId'));
      if (hasAwayTeamId) base.select({ awayTeamId: 'm.away_team_id' }); else base.select(k.raw('NULL as awayTeamId'));
      if (hasHomeScore) base.select({ homeScore: 'm.home_score' }); else base.select(k.raw('NULL as homeScore'));
      if (hasAwayScore) base.select({ awayScore: 'm.away_score' }); else base.select(k.raw('NULL as awayScore'));
      if (hasCreatedAt) base.select({ createdAt: 'm.created_at' }); else base.select(k.raw('NULL as createdAt'));
      if (hasKickoffAt) base.select({ kickoffAt: 'm.kickoff_at' }); else base.select(k.raw('NULL as kickoffAt'));
      if (hasUpdatedAt) base.select({ updatedAt: 'm.updated_at' }); else base.select(k.raw('NULL as updatedAt'));
      if (hasCompletedAt) base.select({ completedAt: 'm.completed_at' }); else base.select(k.raw('NULL as completedAt'));
      if (hasStatus) base.select({ status: 'm.status' }); else base.select(k.raw('NULL as status'));

      base.select(k.raw('CASE WHEN m.home_user_id = ? THEN 1 ELSE 0 END as isHomeUser', [userId]));
      base.select(k.raw('CASE WHEN m.away_user_id = ? THEN 1 ELSE 0 END as isAwayUser', [userId]));
      if (hasTeamMembers && hasHomeTeamId) {
        base.select(k.raw('CASE WHEN m.home_team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = m.home_team_id AND tm.user_id = ?) THEN 1 ELSE 0 END as isHomeMember', [userId]));
      } else {
        base.select(k.raw('0 as isHomeMember'));
      }
      if (hasTeamMembers && hasAwayTeamId) {
        base.select(k.raw('CASE WHEN m.away_team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = m.away_team_id AND tm.user_id = ?) THEN 1 ELSE 0 END as isAwayMember', [userId]));
      } else {
        base.select(k.raw('0 as isAwayMember'));
      }

      base.where(function () {
        if (hasHomeUserId) this.orWhere('m.home_user_id', userId);
        if (hasAwayUserId) this.orWhere('m.away_user_id', userId);
        if (hasTeamMembers && hasHomeTeamId) {
          this.orWhereExists(function () {
            this.select(1)
              .from({ tm: 'team_members' })
              .whereColumn('tm.team_id', 'm.home_team_id')
              .andWhere('tm.user_id', userId);
          });
        }
        if (hasTeamMembers && hasAwayTeamId) {
          this.orWhereExists(function () {
            this.select(1)
              .from({ tm: 'team_members' })
              .whereColumn('tm.team_id', 'm.away_team_id')
              .andWhere('tm.user_id', userId);
          });
        }
      });

      base.orderBy(hasUpdatedAt ? 'm.updated_at' : (hasCompletedAt ? 'm.completed_at' : (hasCreatedAt ? 'm.created_at' : 'm.id')), 'desc');

      const rows = await base;
      if (!rows || !rows.length) return res.json({ chats: [] });

      const matchIds = rows.map((r) => r.id);
      const hasMessages = await k.schema.hasTable('match_messages').catch(() => false);
      let lastMessages = new Map();
      if (hasMessages && matchIds.length) {
        const msgs = await k({ mm: 'match_messages' })
          .whereIn('mm.match_id', matchIds)
          .orderBy('mm.match_id', 'asc')
          .orderBy('mm.created_at', 'desc')
          .select('mm.match_id', 'mm.id', 'mm.body', 'mm.created_at', 'mm.sender_user_id', 'mm.sender_team_id')
          .catch(() => []);
        for (const row of msgs || []) {
          if (!lastMessages.has(row.match_id)) lastMessages.set(row.match_id, row);
        }
      }

      const collectUserIds = new Set();
      const collectTeamIds = new Set();
      for (const m of rows) {
        if (m.homeUserId != null) collectUserIds.add(Number(m.homeUserId));
        if (m.awayUserId != null) collectUserIds.add(Number(m.awayUserId));
        if (m.homeTeamId != null) collectTeamIds.add(Number(m.homeTeamId));
        if (m.awayTeamId != null) collectTeamIds.add(Number(m.awayTeamId));
        const last = lastMessages.get(m.id);
        if (last) {
          if (last.sender_user_id != null) collectUserIds.add(Number(last.sender_user_id));
          if (last.sender_team_id != null) collectTeamIds.add(Number(last.sender_team_id));
        }
      }

      const users = await fetchUserBasics(k, Array.from(collectUserIds));
      const teams = await fetchTeamBasics(k, Array.from(collectTeamIds));

      const userMap = new Map();
      for (const u of users || []) {
        const parts = [];
        if (u.firstname) parts.push(u.firstname);
        if (u.lastname) parts.push(u.lastname);
        const fn = parts.join(' ').trim();
        const label = fn || u.name || u.email || `User ${u.id}`;
        userMap.set(Number(u.id), label);
      }
      const teamMap = new Map();
      for (const t of teams || []) {
        const label = (t && t.name) ? t.name : `Team ${t.id}`;
        teamMap.set(Number(t.id), label);
      }

      function determineTimestamp(m) {
        const order = [m.updatedAt, m.completedAt, m.createdAt, m.kickoffAt];
        return order.find((v) => v != null) || null;
      }

      const chats = rows.map((m) => {
        const matchType = (m.homeTeamId != null || m.awayTeamId != null) ? 'teams' : 'singles';
        const viewerHome = Number(m.isHomeUser) === 1 || Number(m.isHomeMember) === 1;
        const viewerAway = Number(m.isAwayUser) === 1 || Number(m.isAwayMember) === 1;
        const viewerSide = viewerHome ? 'home' : (viewerAway ? 'away' : null);
        let opponentName = 'Gegner gesucht';
        let opponentId = null;
        if (viewerSide === 'home') {
          if (matchType === 'teams') {
            opponentId = m.awayTeamId != null ? Number(m.awayTeamId) : null;
            if (opponentId && teamMap.has(opponentId)) opponentName = teamMap.get(opponentId);
            else if (opponentId == null) opponentName = 'Noch kein Gegner';
          } else {
            opponentId = m.awayUserId != null ? Number(m.awayUserId) : null;
            if (opponentId && userMap.has(opponentId)) opponentName = userMap.get(opponentId);
            else if (opponentId == null) opponentName = 'Noch kein Gegner';
          }
        } else if (viewerSide === 'away') {
          if (matchType === 'teams') {
            opponentId = m.homeTeamId != null ? Number(m.homeTeamId) : null;
            if (opponentId && teamMap.has(opponentId)) opponentName = teamMap.get(opponentId);
            else if (opponentId == null) opponentName = 'Noch kein Gegner';
          } else {
            opponentId = m.homeUserId != null ? Number(m.homeUserId) : null;
            if (opponentId && userMap.has(opponentId)) opponentName = userMap.get(opponentId);
            else if (opponentId == null) opponentName = 'Noch kein Gegner';
          }
        }

        const last = lastMessages.get(m.id);
        const lastMessage = last ? {
          id: last.id,
          body: last.body,
          createdAt: last.created_at,
          senderUserId: last.sender_user_id,
          senderTeamId: last.sender_team_id,
          senderUserName: (last.sender_user_id != null && userMap.has(Number(last.sender_user_id))) ? userMap.get(Number(last.sender_user_id)) : null,
          senderTeamName: (last.sender_team_id != null && teamMap.has(Number(last.sender_team_id))) ? teamMap.get(Number(last.sender_team_id)) : null,
        } : null;

        const ts = determineTimestamp(m);

        return {
          matchId: m.id,
          leagueId: m.leagueId,
          leagueName: m.leagueName || null,
          sportName: m.sportName || null,
          matchType,
          viewerSide,
          opponentName,
          lastMessage,
          lastActivityAt: ts,
          homeScore: hasHomeScore ? m.homeScore : null,
          awayScore: hasAwayScore ? m.awayScore : null,
          status: m.status || null,
        };
      }).filter((c) => c.viewerSide != null);

      return res.json({ chats });
    } catch (e) {
      console.error('Get chat overview failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'CHAT_OVERVIEW_FAILED' });
    }
  });

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

      // Insert a system message so the new match shows up as a new chat
      try {
        // ensure match_messages exists (reuse helper if available)
        const hasMM = await k.schema.hasTable('match_messages').catch(() => false);
        if (!hasMM) {
          await k.schema.createTable('match_messages', (table) => {
            table.increments('id').primary();
            table.integer('match_id').notNullable().references('id').inTable('matches').onDelete('CASCADE');
            table.integer('sender_user_id').references('id').inTable('users').onDelete('SET NULL');
            table.integer('sender_team_id').references('id').inTable('teams').onDelete('SET NULL');
            table.text('body').notNullable();
            table.text('created_at').notNullable().defaultTo(k.raw('CURRENT_TIMESTAMP'));
            table.index(['match_id'], 'idx_match_messages_match');
          });
        }
        const sysBody = 'Match erstellt – MatchLeague';
        await k('match_messages').insert({ match_id: id, body: sysBody, sender_user_id: null, sender_team_id: null, created_at: new Date().toISOString() });
      } catch (e) {
        console.warn('[matches] failed to insert system message on create', e && (e.message || e));
      }

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
          ...(Object.prototype.hasOwnProperty.call(info, 'kickoff_end_at') ? ['m.kickoff_end_at'] : []),
          ...(Object.prototype.hasOwnProperty.call(info, 'location_id') ? ['m.location_id'] : []),
          'm.location',
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
      
      // Check if this is an Open Matches league (friendly matches don't require league membership)
      const isOpenMatch = await k('leagues').where({ id: g.league_id, name: 'Open Matches' }).first().catch(() => null);
      
      if (!isOpenMatch) {
        const member = await k('user_leagues').where({ league_id: g.league_id, user_id: userId }).first();
        if (!member) return res.status(403).json({ error: 'Nur Mitglieder der Liga können Matches beitreten' });
      }
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
    const { kickoff_at, location } = req.body || {};
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
      // optional location if column exists
      try {
        const info2 = await k('matches').columnInfo().catch(() => ({}));
        if (Object.prototype.hasOwnProperty.call(info2, 'location')) {
          if (typeof location === 'string' && location.trim()) patch.location = location.trim();
        }
      } catch {}
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
          const users = await fetchUserBasics(dbk, [g.home_user_id, g.away_user_id]);
          const subject = 'Match geplant';
          const when = new Date(patch.kickoff_at).toLocaleString();
          for (const u of users || []) {
            const name = (u.firstname || u.lastname) ? `${u.firstname || ''} ${u.lastname || ''}`.trim() : (u.name || u.email || 'Spieler');
            const html = renderEmailTemplate({
              title: 'Match geplant',
              body: `<p>Hallo ${name},</p><p>Dein Match (ID ${g.id}) wurde geplant für <b>${when}</b>.</p>`,
              previewText: 'Match geplant',
            });
            await sendMail(u.email, subject, html);
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
            'm.id', 'm.kickoff_at', 'm.location', 'm.home_user_id', 'm.away_user_id',
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

  // Suggest next free slot for this match within the same league.
  // Input: { base_at?: string (ISO or local), duration_minutes?: number (default 60) }
  // Returns: { suggested_at: ISO, reason?: string }
  router.post('/:id/suggest-slot', isAuthenticated, async (req, res) => {
    const gameId = Number(req.params.id);
    const userId = Number(req.user.id);
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const m = await k('matches').where({ id: gameId }).first();
      if (!m) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      // Permission: must be participant (single) or captain (team)
      let allowed = false;
      if (m.home_user_id != null || m.away_user_id != null) {
        allowed = String(m.home_user_id) === String(userId) || String(m.away_user_id) === String(userId);
      } else if (m.home_team_id != null || m.away_team_id != null) {
        const cap = await k('team_members')
          .whereIn('team_id', [m.home_team_id, m.away_team_id].filter(Boolean))
          .andWhere({ user_id: userId, is_captain: 1 })
          .first();
        allowed = !!cap;
      }
      if (!allowed) return res.status(403).json({ error: 'NOT_ALLOWED' });

      const baseRaw = req.body && (req.body.base_at || req.body.baseAt || req.body.kickoff_at);
      const base = baseRaw ? new Date(baseRaw) : new Date();
      const duration = Number(req.body?.duration_minutes) || 60;
      const leagueId = m.league_id;

      // Load existing scheduled matches in league
      const info = await k('matches').columnInfo().catch(() => ({}));
      const hasKickoff = Object.prototype.hasOwnProperty.call(info, 'kickoff_at');
      let scheduled = [];
      if (hasKickoff) {
        scheduled = await k('matches').where({ league_id: leagueId }).whereNotNull('kickoff_at').select('kickoff_at').catch(() => []);
      }
      const taken = new Set((scheduled || []).map(r => {
        const d = new Date(r.kickoff_at);
        if (Number.isNaN(d.getTime())) return null;
        const hh = d.getHours();
        const mm = d.getMinutes();
        return `${hh}:${mm}`;
      }).filter(Boolean));

      // Business hours grid: 08:00..22:00 quarter-hour slots; prefer requested time rounded up
      function* slotsFrom(date) {
        const d = new Date(date);
        d.setSeconds(0, 0);
        // round up to next 15-min step
        const m0 = d.getMinutes();
        const step = 15;
        const next = Math.ceil(m0 / step) * step;
        d.setMinutes(next, 0, 0);
        // try today and next 7 days
        for (let day = 0; day < 7; day++) {
          for (let h = 8; h <= 22; h++) {
            for (let m = 0; m < 60; m += step) {
              const cand = new Date(d);
              cand.setHours(h, m, 0, 0);
              // skip past slots
              if (cand.getTime() < Date.now()) continue;
              yield cand;
            }
          }
          d.setDate(d.getDate() + 1);
          d.setHours(8, 0, 0, 0);
        }
      }

      let suggested = null;
      for (const s of slotsFrom(base)) {
        const key = `${s.getHours()}:${s.getMinutes()}`;
        if (!taken.has(key)) { suggested = s; break; }
      }
      if (!suggested) {
        // fallback: next day 18:00
        const f = new Date(base);
        f.setDate(f.getDate() + 1);
        f.setHours(18, 0, 0, 0);
        suggested = f;
      }
      return res.json({ suggested_at: suggested.toISOString(), duration_minutes: duration });
    } catch (e) {
      console.error('Suggest slot failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'SUGGEST_FAILED' });
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

      // Check if this is an Open Matches league (friendly matches don't require league membership for result submission)
      const league = await k('leagues').where({ id: g.league_id }).first().catch(() => null);
      const isOpenMatch = league && league.name && league.name.includes('Open Matches');
      
      if (!isOpenMatch) {
        const member = await k('user_leagues').where({ league_id: g.league_id, user_id: userId }).first();
        if (!member) return res.json({ canSubmit: false, reason: 'LEAGUE_MEMBERS_ONLY' });
      }

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

      // Check if this is an Open Matches league (friendly matches don't require league membership for result submission)
      const leagueForResult = await k('leagues').where({ id: g.league_id }).first().catch(() => null);
      const isOpenMatchForResult = leagueForResult && leagueForResult.name && leagueForResult.name.includes('Open Matches');
      
      if (!isOpenMatchForResult) {
        // must be league member
        const member = await k('user_leagues').where({ league_id: g.league_id, user_id: userId }).first();
        if (!member) return res.status(403).json({ error: 'LEAGUE_MEMBERS_ONLY' });
      }

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
          const users = await fetchUserBasics(dbk, [g.home_user_id, g.away_user_id]);
          const subject = 'Match abgeschlossen';
          const score = `${hs}:${as}`;
          for (const u of users || []) {
            const name = (u.firstname || u.lastname) ? `${u.firstname || ''} ${u.lastname || ''}`.trim() : (u.name || u.email || 'Spieler');
            const html = renderEmailTemplate({
              title: 'Match abgeschlossen',
              body: `<p>Hallo ${name},</p><p>Dein Match (ID ${g.id}) wurde abgeschlossen. Ergebnis: <b>${score}</b>.</p>`,
              previewText: 'Match abgeschlossen',
            });
            await sendMail(u.email, subject, html);
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

  // Termin-Manager
  router.get('/:id/termin-manager', isAuthenticated, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!Number.isFinite(matchId) || matchId <= 0) return res.status(400).json({ error: 'INVALID_MATCH_ID' });

      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureTerminManagerTables(k);

      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const viewerUserId = Number(req.user.id) || null;
      const isOwner = match.home_user_id != null && Number(match.home_user_id) === Number(req.user.id);

      const hasOptions = await k.schema.hasTable('match_time_options').catch(() => false);
      const hasProposals = await k.schema.hasTable('match_schedule_proposals').catch(() => false);
      if (!hasOptions || !hasProposals) {
        return res.json({ meta: { viewerUserId, isOwner }, options: [], proposal: null });
      }

      const options = await k('match_time_options')
        .where({ match_id: matchId })
        .orderBy('starts_at', 'asc')
        .select(['id', { startsAt: 'starts_at' }]);

      const proposalRow = await k({ p: 'match_schedule_proposals' })
        .leftJoin({ o: 'match_time_options' }, 'o.id', 'p.option_id')
        .where('p.match_id', matchId)
        .andWhere('p.status', 'sent')
        .orderBy('p.created_at', 'desc')
        .first([
          { id: 'p.id' },
          { matchId: 'p.match_id' },
          { proposerUserId: 'p.proposer_user_id' },
          { recipientUserId: 'p.recipient_user_id' },
          { optionId: 'p.option_id' },
          { status: 'p.status' },
          { note: 'p.note' },
          { createdAt: 'p.created_at' },
          { startsAt: 'o.starts_at' },
        ]);

      const proposal = proposalRow ? proposalRow : null;
      return res.json({ meta: { viewerUserId, isOwner }, options: Array.isArray(options) ? options : [], proposal });
    } catch (e) {
      console.error('Termin-Manager load failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'TERMIN_MANAGER_LOAD_FAILED' });
    }
  });

  router.post('/:id/termin-manager/options', isAuthenticated, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const startsAt = typeof req.body?.startsAt === 'string' ? req.body.startsAt : null;
      if (!Number.isFinite(matchId) || matchId <= 0) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      if (!startsAt) return res.status(400).json({ error: 'INVALID_STARTS_AT' });

      const d = new Date(startsAt);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'INVALID_STARTS_AT' });

      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureTerminManagerTables(k);

      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const isOwner = match.home_user_id != null && Number(match.home_user_id) === Number(req.user.id);
      if (!isOwner) return res.status(403).json({ error: 'ONLY_OWNER_CAN_ADD_OPTIONS' });

      const inserted = await k('match_time_options').insert({
        match_id: matchId,
        starts_at: d.toISOString(),
        created_by_user_id: Number(req.user.id) || null,
        created_at: new Date().toISOString(),
      });
      const newId = Array.isArray(inserted) ? inserted[0] : inserted;
      return res.status(201).json({ option: { id: newId, startsAt: d.toISOString() } });
    } catch (e) {
      console.error('Add time option failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'ADD_OPTION_FAILED' });
    }
  });

  router.delete('/:id/termin-manager/options/:optionId', isAuthenticated, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const optionId = Number(req.params.optionId);
      if (!Number.isFinite(matchId) || matchId <= 0) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      if (!Number.isFinite(optionId) || optionId <= 0) return res.status(400).json({ error: 'INVALID_OPTION_ID' });

      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureTerminManagerTables(k);

      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const isOwner = match.home_user_id != null && Number(match.home_user_id) === Number(req.user.id);
      if (!isOwner) return res.status(403).json({ error: 'ONLY_OWNER_CAN_REMOVE_OPTIONS' });

      const row = await k('match_time_options').where({ id: optionId }).first();
      if (!row || Number(row.match_id) !== matchId) return res.status(404).json({ error: 'OPTION_NOT_FOUND' });

      await k('match_time_options').where({ id: optionId }).del();
      return res.json({ removed: true });
    } catch (e) {
      console.error('Remove time option failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'REMOVE_OPTION_FAILED' });
    }
  });

  router.post('/:id/termin-manager/proposals', isAuthenticated, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const optionId = Number(req.body?.optionId);
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
      if (!Number.isFinite(matchId) || matchId <= 0) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      if (!Number.isFinite(optionId) || optionId <= 0) return res.status(400).json({ error: 'INVALID_OPTION_ID' });

      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureTerminManagerTables(k);

      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      if (match.home_user_id == null || match.away_user_id == null) {
        return res.status(400).json({ error: 'OPPONENT_NOT_ASSIGNED' });
      }

      const proposerUserId = Number(req.user.id);
      const recipientUserId = Number(match.home_user_id) === proposerUserId ? Number(match.away_user_id) : Number(match.home_user_id);

      const opt = await k('match_time_options').where({ id: optionId }).first();
      if (!opt || Number(opt.match_id) !== matchId) return res.status(404).json({ error: 'OPTION_NOT_FOUND' });

      // close any previous active proposal
      await k('match_schedule_proposals')
        .where({ match_id: matchId, status: 'sent' })
        .update({ status: 'countered', responded_at: new Date().toISOString() })
        .catch(() => {});

      const inserted = await k('match_schedule_proposals').insert({
        match_id: matchId,
        proposer_user_id: proposerUserId,
        recipient_user_id: recipientUserId,
        option_id: optionId,
        status: 'sent',
        note: note || null,
        created_at: new Date().toISOString(),
        responded_at: null,
      });
      const newId = Array.isArray(inserted) ? inserted[0] : inserted;

      const startsAt = opt.starts_at;
      const msgBody = `📅 Terminvorschlag gesendet: ${formatStartsAt(startsAt)}${note ? `\n\n${note}` : ''}`;
      await insertActionMessage(k, {
        matchId,
        senderUserId: proposerUserId,
        senderTeamId: participant.teamId || null,
        action: 'schedule_proposed',
        body: msgBody,
        data: { proposalId: newId, optionId, startsAt },
      });

      return res.status(201).json({ ok: true, id: newId });
    } catch (e) {
      console.error('Send proposal failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'SEND_PROPOSAL_FAILED' });
    }
  });

  router.post('/:id/termin-manager/proposals/:proposalId/accept', isAuthenticated, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const proposalId = Number(req.params.proposalId);
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
      if (!Number.isFinite(matchId) || matchId <= 0) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      if (!Number.isFinite(proposalId) || proposalId <= 0) return res.status(400).json({ error: 'INVALID_PROPOSAL_ID' });

      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureTerminManagerTables(k);

      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const row = await k({ p: 'match_schedule_proposals' })
        .leftJoin({ o: 'match_time_options' }, 'o.id', 'p.option_id')
        .where('p.id', proposalId)
        .andWhere('p.match_id', matchId)
        .first(['p.*', { starts_at: 'o.starts_at' }]);
      if (!row) return res.status(404).json({ error: 'PROPOSAL_NOT_FOUND' });
      if (row.status !== 'sent') return res.status(400).json({ error: 'PROPOSAL_NOT_ACTIVE' });

      const viewerId = Number(req.user.id);
      if (Number(row.recipient_user_id) !== viewerId) return res.status(403).json({ error: 'ONLY_RECIPIENT_CAN_ACCEPT' });

      await k('match_schedule_proposals').where({ id: proposalId }).update({ status: 'accepted', responded_at: new Date().toISOString(), note: row.note || null });
      // set match kickoff
      if (row.starts_at) {
        await k('matches').where({ id: matchId }).update({ kickoff_at: row.starts_at, status: 'scheduled' }).catch(async () => {
          await k('matches').where({ id: matchId }).update({ kickoff_at: row.starts_at }).catch(() => {});
        });
      }

      const msgBody = `📅 Terminvorschlag angenommen: ${formatStartsAt(row.starts_at)}${note ? `\n\n${note}` : ''}`;
      await insertActionMessage(k, {
        matchId,
        senderUserId: viewerId,
        senderTeamId: participant.teamId || null,
        action: 'schedule_accepted',
        body: msgBody,
        data: { proposalId, optionId: row.option_id, startsAt: row.starts_at },
      });

      return res.json({ ok: true });
    } catch (e) {
      console.error('Accept proposal failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'ACCEPT_FAILED' });
    }
  });

  router.post('/:id/termin-manager/proposals/:proposalId/reject', isAuthenticated, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const proposalId = Number(req.params.proposalId);
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
      if (!Number.isFinite(matchId) || matchId <= 0) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      if (!Number.isFinite(proposalId) || proposalId <= 0) return res.status(400).json({ error: 'INVALID_PROPOSAL_ID' });

      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureTerminManagerTables(k);

      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const row = await k({ p: 'match_schedule_proposals' })
        .leftJoin({ o: 'match_time_options' }, 'o.id', 'p.option_id')
        .where('p.id', proposalId)
        .andWhere('p.match_id', matchId)
        .first(['p.*', { starts_at: 'o.starts_at' }]);
      if (!row) return res.status(404).json({ error: 'PROPOSAL_NOT_FOUND' });
      if (row.status !== 'sent') return res.status(400).json({ error: 'PROPOSAL_NOT_ACTIVE' });

      const viewerId = Number(req.user.id);
      if (Number(row.recipient_user_id) !== viewerId) return res.status(403).json({ error: 'ONLY_RECIPIENT_CAN_REJECT' });

      await k('match_schedule_proposals').where({ id: proposalId }).update({ status: 'rejected', responded_at: new Date().toISOString() });

      const msgBody = `📅 Terminvorschlag abgelehnt: ${formatStartsAt(row.starts_at)}${note ? `\n\n${note}` : ''}`;
      await insertActionMessage(k, {
        matchId,
        senderUserId: viewerId,
        senderTeamId: participant.teamId || null,
        action: 'schedule_rejected',
        body: msgBody,
        data: { proposalId, optionId: row.option_id, startsAt: row.starts_at },
      });

      return res.json({ ok: true });
    } catch (e) {
      console.error('Reject proposal failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'REJECT_FAILED' });
    }
  });

  router.post('/:id/termin-manager/proposals/:proposalId/counter', isAuthenticated, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      const proposalId = Number(req.params.proposalId);
      const optionId = Number(req.body?.optionId);
      const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
      if (!Number.isFinite(matchId) || matchId <= 0) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      if (!Number.isFinite(proposalId) || proposalId <= 0) return res.status(400).json({ error: 'INVALID_PROPOSAL_ID' });
      if (!Number.isFinite(optionId) || optionId <= 0) return res.status(400).json({ error: 'INVALID_OPTION_ID' });

      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureTerminManagerTables(k);

      const match = await loadMatch(k, matchId);
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const participant = await resolveParticipant(k, match, req.user.id);
      if (!participant.allowed) return res.status(403).json({ error: 'NOT_PARTICIPANT' });

      const row = await k('match_schedule_proposals').where({ id: proposalId, match_id: matchId }).first();
      if (!row) return res.status(404).json({ error: 'PROPOSAL_NOT_FOUND' });
      if (row.status !== 'sent') return res.status(400).json({ error: 'PROPOSAL_NOT_ACTIVE' });

      const viewerId = Number(req.user.id);
      if (Number(row.recipient_user_id) !== viewerId) return res.status(403).json({ error: 'ONLY_RECIPIENT_CAN_COUNTER' });

      const opt = await k('match_time_options').where({ id: optionId }).first();
      if (!opt || Number(opt.match_id) !== matchId) return res.status(404).json({ error: 'OPTION_NOT_FOUND' });

      // mark current proposal as countered
      await k('match_schedule_proposals').where({ id: proposalId }).update({ status: 'countered', responded_at: new Date().toISOString() });

      // create new active proposal back to original proposer
      const inserted = await k('match_schedule_proposals').insert({
        match_id: matchId,
        proposer_user_id: viewerId,
        recipient_user_id: Number(row.proposer_user_id),
        option_id: optionId,
        status: 'sent',
        note: note || null,
        created_at: new Date().toISOString(),
        responded_at: null,
      });
      const newId = Array.isArray(inserted) ? inserted[0] : inserted;

      const msgBody = `📅 Gegenvorschlag gesendet: ${formatStartsAt(opt.starts_at)}${note ? `\n\n${note}` : ''}`;
      await insertActionMessage(k, {
        matchId,
        senderUserId: viewerId,
        senderTeamId: participant.teamId || null,
        action: 'schedule_counter_proposed',
        body: msgBody,
        data: { proposalId: newId, optionId, startsAt: opt.starts_at },
      });

      return res.status(201).json({ ok: true, id: newId });
    } catch (e) {
      console.error('Counter proposal failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'COUNTER_FAILED' });
    }
  });

  // Delete a pending match ("Absagen" = hard delete)
  // Rules:
  // - Match must exist and be pending (no scores yet)
  // - For Single sport: only home_user_id or away_user_id can delete
  // - For Team sport: only captains of home_team_id or away_team_id can delete
  // - Requires league membership
  router.delete('/:id', isAuthenticated, async (req, res) => {
    const gameId = req.params.id;
    const userId = req.user.id;
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

      const hasSports = await k.schema.hasTable('sports').catch(() => false);
      const sInfoDel = hasSports ? await k('sports').columnInfo().catch(() => ({})) : {};
      const gRawDel = await k('matches as m')
        .leftJoin('leagues as l', 'l.id', 'm.league_id')
        .modify(qb => { if (hasSports) qb.leftJoin('sports as s', 's.id', 'l.sport_id'); })
        .select([
          'm.id', 'm.league_id', 'm.kickoff_at',
          'm.home_user_id', 'm.away_user_id',
          'm.home_team_id', 'm.away_team_id',
          'm.home_score', 'm.away_score',
          ...(Object.prototype.hasOwnProperty.call(sInfoDel, 'sport_type') ? [{ sport_type: 's.sport_type' }] : [k.raw('NULL as sport_type')]),
          ...(Object.prototype.hasOwnProperty.call(sInfoDel, 'team_size') ? [{ team_size: 's.team_size' }] : [k.raw('NULL as team_size')]),
          ...(Object.prototype.hasOwnProperty.call(sInfoDel, 'type') ? [{ type: 's.type' }] : [k.raw('NULL as type')])
        ])
        .where('m.id', gameId)
        .first();
      if (!gRawDel) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
      const sportType = (gRawDel.sport_type ? String(gRawDel.sport_type) : (gRawDel.type ? String(gRawDel.type) : (Number(gRawDel.team_size) > 1 ? 'Team' : 'Single')));
      const g = { ...gRawDel, sportType };

      // Check if this is an Open Matches league (friendly matches don't require league membership for deletion)
      const leagueForDeletion = await k('leagues').where({ id: g.league_id }).first().catch(() => null);
      const isOpenMatchForDeletion = leagueForDeletion && leagueForDeletion.name && leagueForDeletion.name.includes('Open Matches');
      
      if (!isOpenMatchForDeletion) {
        // must be league member
        const member = await k('user_leagues').where({ league_id: g.league_id, user_id: userId }).first();
        if (!member) return res.status(403).json({ error: 'LEAGUE_MEMBERS_ONLY' });
      }

      // must be pending (no scores yet)
      if (g.home_score != null || g.away_score != null) {
        return res.status(409).json({ error: 'ALREADY_RECORDED' });
      }

      // permission check
      if (g.sportType === 'Team') {
        const teamIds = [g.home_team_id, g.away_team_id].filter(v => v != null);
        // either not yet full (no opponent) or user is captain of one of the teams
        if (teamIds.length >= 1) {
          const cap = await k('team_members')
            .whereIn('team_id', teamIds)
            .andWhere({ user_id: userId, is_captain: 1 })
            .first();
          if (!cap) return res.status(403).json({ error: 'ONLY_CAPTAIN_CAN_CANCEL' });
        } else {
          // no teams assigned yet: allow league member to remove own created match if they are home_user
          if (g.home_user_id && String(g.home_user_id) !== String(userId)) {
            return res.status(403).json({ error: 'ONLY_OWNER_CAN_CANCEL' });
          }
        }
      } else {
        // Single
        const isPlayer = (String(userId) === String(g.home_user_id)) || (String(userId) === String(g.away_user_id));
        if (!isPlayer) return res.status(403).json({ error: 'ONLY_PLAYERS_CAN_CANCEL' });
      }

      // Delete match (cascades will remove messages/rosters if FK defined)
      await k('matches').where({ id: gameId }).del();
      return res.json({ deleted: true, id: Number(gameId) });
    } catch (e) {
      console.error('Delete match error:', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR', details: e && e.message });
    }
  });

  router.get('/:id/chat', isAuthenticated, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!Number.isFinite(matchId) || matchId <= 0) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
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
        kind: row.kind || null,
        action: row.action || null,
        data: row.data || null,
        createdAt: row.created_at,
        senderUserId: row.sender_user_id,
        senderTeamId: row.sender_team_id,
        senderUserName: row.sender_user_name || null,
        senderUserAvatar: row.sender_user_avatar || null,
        senderTeamName: row.sender_team_name || null,
      }));
      return res.json({ messages, meta: { viewerUserId: Number(req.user.id) || null, viewerTeamId: participant.teamId, viewerSide: participant.side, matchType: participant.matchType } });
    } catch (e) {
      const msg = (e && e.message || '').toLowerCase();
      if (msg.includes('db_not_available')) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      console.error('Get match chat failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  router.post('/:id/chat', isAuthenticated, async (req, res) => {
    try {
      const matchId = Number(req.params.id);
      if (!Number.isFinite(matchId) || matchId <= 0) return res.status(400).json({ error: 'INVALID_MATCH_ID' });
      const rawBody = typeof req.body?.message === 'string' ? req.body.message : (typeof req.body?.body === 'string' ? req.body.body : '');
      const trimmed = rawBody.trim();
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
        created_at: new Date().toISOString(),
      };
      const inserted = await k('match_messages').insert(insertRec);
      const newId = Array.isArray(inserted) ? inserted[0] : inserted;
      const row = await fetchMessageById(k, newId);
      const payload = row ? {
        id: row.id,
        body: row.body,
        kind: row.kind || null,
        action: row.action || null,
        data: row.data || null,
        createdAt: row.created_at,
        senderUserId: row.sender_user_id,
        senderTeamId: row.sender_team_id,
        senderUserName: row.sender_user_name || null,
        senderUserAvatar: row.sender_user_avatar || null,
        senderTeamName: row.sender_team_name || null,
      } : {
        id: newId,
        body: insertRec.body,
        kind: null,
        action: null,
        data: null,
        createdAt: insertRec.created_at,
        senderUserId: insertRec.sender_user_id,
        senderTeamId: insertRec.sender_team_id,
        senderUserName: null,
        senderUserAvatar: null,
        senderTeamName: null,
      };
      return res.status(201).json({ message: payload, meta: { viewerUserId: Number(req.user.id) || null, viewerTeamId: participant.teamId, viewerSide: participant.side } });
    } catch (e) {
      const msg = (e && e.message || '').toLowerCase();
      if (msg.includes('db_not_available')) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      console.error('Post match chat failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'DB_ERROR' });
    }
  });

  return router;
};

