const express = require('express');
const { isAuthenticated } = require('../middleware/auth');

module.exports = function chatsRoutes({ db }) {
  const router = express.Router();

  function getKnex() {
    const d = db;
    if (!d) return null;
    if (d.knex && d.knex.client) return d.knex;
    if (d.client) return d;
    if (typeof d === 'function' && typeof d.raw === 'function') return d;
    return null;
  }

  async function detectMatchTable(knex) {
    if (!knex || !knex.schema || typeof knex.schema.hasTable !== 'function') return null;
    if (await knex.schema.hasTable('matches').catch(() => false)) return 'matches';
    if (await knex.schema.hasTable('games').catch(() => false)) return 'games';
    return null;
  }

  async function detectMessageTable(knex) {
    if (!knex || !knex.schema || typeof knex.schema.hasTable !== 'function') {
      return { table: null, matchIdColumn: null };
    }
    if (await knex.schema.hasTable('match_messages').catch(() => false)) {
      return { table: 'match_messages', matchIdColumn: 'match_id' };
    }
    if (await knex.schema.hasTable('game_messages').catch(() => false)) {
      return { table: 'game_messages', matchIdColumn: 'game_id' };
    }
    return { table: null, matchIdColumn: null };
  }

  async function detectReadTable(knex) {
    if (!knex || !knex.schema || typeof knex.schema.hasTable !== 'function') {
      return { table: null, matchIdColumn: null };
    }
    if (await knex.schema.hasTable('match_message_reads').catch(() => false)) {
      return { table: 'match_message_reads', matchIdColumn: 'match_id' };
    }
    if (await knex.schema.hasTable('game_message_reads').catch(() => false)) {
      return { table: 'game_message_reads', matchIdColumn: 'game_id' };
    }
    return { table: null, matchIdColumn: null };
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

  async function listMatchChats(k, userId) {
    const tableName = await detectMatchTable(k);
    if (!tableName) return [];
    const info = await k(tableName).columnInfo().catch(() => ({}));
    if (!info || !Object.keys(info).length) return [];
    const hasHomeUserId = !!info.home_user_id;
    const hasAwayUserId = !!info.away_user_id;
  const hasHomeTeamId = !!info.home_team_id;
  const hasAwayTeamId = !!info.away_team_id;
  const hasHomeText = Object.prototype.hasOwnProperty.call(info, 'home');
  const hasAwayText = Object.prototype.hasOwnProperty.call(info, 'away');
  const hasHomeScore = !!info.home_score;
  const hasAwayScore = !!info.away_score;
  const hasCreatedAt = !!info.created_at;
  const hasKickoffAt = !!info.kickoff_at;
  const hasUpdatedAt = !!info.updated_at;
  const hasCompletedAt = !!info.completed_at;

  if (!hasHomeUserId && !hasAwayUserId && !hasHomeTeamId && !hasAwayTeamId && !hasHomeText && !hasAwayText) return [];

    const hasSports = await k.schema.hasTable('sports').catch(() => false);
    const hasTeamMembers = await k.schema.hasTable('team_members').catch(() => false);
    const hasLeagues = await k.schema.hasTable('leagues').catch(() => false);
  const hasUserLeagues = await k.schema.hasTable('user_leagues').catch(() => false);

    const base = k({ m: tableName });
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
  if (hasHomeText) base.select({ homeName: 'm.home' }); else base.select(k.raw('NULL as homeName'));
  if (hasAwayText) base.select({ awayName: 'm.away' }); else base.select(k.raw('NULL as awayName'));

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

    let appliedFilter = false;
    if (hasHomeUserId || hasAwayUserId || hasHomeTeamId || hasAwayTeamId) {
      base.where(function () {
        if (hasHomeUserId) this.orWhere('m.home_user_id', userId);
        if (hasAwayUserId) this.orWhere('m.away_user_id', userId);
        if (hasTeamMembers && hasHomeTeamId) {
          this.orWhereExists(function () {
            this.select(1).from({ tm: 'team_members' }).whereColumn('tm.team_id', 'm.home_team_id').andWhere('tm.user_id', userId);
          });
        }
        if (hasTeamMembers && hasAwayTeamId) {
          this.orWhereExists(function () {
            this.select(1).from({ tm: 'team_members' }).whereColumn('tm.team_id', 'm.away_team_id').andWhere('tm.user_id', userId);
          });
        }
      });
      appliedFilter = true;
    } else if (hasUserLeagues) {
      base.join({ ul: 'user_leagues' }, 'ul.league_id', 'm.league_id');
      base.where('ul.user_id', userId);
      appliedFilter = true;
    }

    if (!appliedFilter) return [];

    const orderColumn = hasUpdatedAt ? 'm.updated_at' : (hasCompletedAt ? 'm.completed_at' : (hasCreatedAt ? 'm.created_at' : 'm.id'));
    base.orderBy(orderColumn, 'desc');

    const rows = await base;
    if (!rows || !rows.length) return [];

    const matchIds = rows.map(r => r.id);
    const { table: messageTable, matchIdColumn: messageMatchIdColumn } = await detectMessageTable(k);
    const lastMessages = new Map();
    if (messageTable && messageMatchIdColumn && matchIds.length) {
      const columnRef = `mm.${messageMatchIdColumn}`;
      const msgs = await k({ mm: messageTable })
        .whereIn(columnRef, matchIds)
        .orderBy(columnRef, 'asc')
        .orderBy('mm.created_at', 'desc')
        .select(
          k.raw(`${columnRef} as matchId`),
          'mm.id as id',
          'mm.body',
          'mm.created_at as created_at',
          'mm.sender_user_id',
          'mm.sender_team_id',
          'mm.sender_id as legacy_sender_id',
          'mm.team_id as legacy_team_id'
        )
        .catch(() => []);
      for (const row of msgs || []) {
        const key = Number(row.matchId);
        if (!lastMessages.has(key)) lastMessages.set(key, row);
      }
    }

    // Load last_read markers for this user across these matches to compute unread quickly
    const { table: readsTable, matchIdColumn: readsMatchIdColumn } = await detectReadTable(k);
    const readsByMatch = new Map();
    if (readsTable && readsMatchIdColumn && matchIds.length) {
      const rr = await k(readsTable)
        .where('user_id', userId)
        .whereIn(readsMatchIdColumn, matchIds)
        .select(
          k.raw(`${readsMatchIdColumn} as matchId`),
          'last_read_at'
        )
        .catch(() => []);
      for (const r of rr || []) {
        readsByMatch.set(Number(r.matchId), r.last_read_at ? (Date.parse(r.last_read_at) || 0) : 0);
      }
    }

    const collectUserIds = new Set([userId]);
    const collectTeamIds = new Set();
    for (const m of rows) {
      if (m.homeUserId != null) collectUserIds.add(Number(m.homeUserId));
      if (m.awayUserId != null) collectUserIds.add(Number(m.awayUserId));
      if (m.homeTeamId != null) collectTeamIds.add(Number(m.homeTeamId));
      if (m.awayTeamId != null) collectTeamIds.add(Number(m.awayTeamId));
      const last = lastMessages.get(Number(m.id));
      if (last) {
        const lastSenderUserId = (last.sender_user_id != null) ? last.sender_user_id : (last.legacy_sender_id != null ? last.legacy_sender_id : null);
        const lastSenderTeamId = (last.sender_team_id != null) ? last.sender_team_id : (last.legacy_team_id != null ? last.legacy_team_id : null);
        if (lastSenderUserId != null) collectUserIds.add(Number(lastSenderUserId));
        if (lastSenderTeamId != null) collectTeamIds.add(Number(lastSenderTeamId));
      }
    }

    const usersInfo = await k('users').columnInfo().catch(() => ({}));
    const hasUsers = await k.schema.hasTable('users').catch(() => false);
    const userMap = new Map();
    if (hasUsers) {
      const ids = Array.from(collectUserIds);
      if (ids.length) {
        const cols = ['id'];
        if (Object.prototype.hasOwnProperty.call(usersInfo, 'email')) cols.push('email');
        if (Object.prototype.hasOwnProperty.call(usersInfo, 'firstname')) cols.push('firstname');
        if (Object.prototype.hasOwnProperty.call(usersInfo, 'lastname')) cols.push('lastname');
        if (Object.prototype.hasOwnProperty.call(usersInfo, 'name')) cols.push('name');
        if (Object.prototype.hasOwnProperty.call(usersInfo, 'avatar_url')) cols.push('avatar_url');
        const rowsU = await k('users').whereIn('id', ids).select(cols).catch(() => []);
        for (const u of rowsU) {
          const parts = [];
          if (u.firstname) parts.push(u.firstname);
          if (u.lastname) parts.push(u.lastname);
          const fn = parts.join(' ').trim();
          const label = fn || u.name || u.email || `User ${u.id}`;
          userMap.set(Number(u.id), { name: label, avatar_url: u.avatar_url || null });
        }
      }
    }
    const teamMap = new Map();
    const hasTeams = await k.schema.hasTable('teams').catch(() => false);
    if (hasTeams) {
      const ids = Array.from(collectTeamIds);
      if (ids.length) {
        const rowsT = await k('teams').whereIn('id', ids).select(['id', 'name']).catch(() => []);
        for (const t of rowsT) teamMap.set(Number(t.id), { name: t.name || `Team ${t.id}` });
      }
    }

    function determineTimestamp(m) {
      const order = [m.updatedAt, m.completedAt, m.createdAt, m.kickoffAt];
      return order.find(v => v != null) || null;
    }

    return rows.map(m => {
      const matchType = (m.homeTeamId != null || m.awayTeamId != null) ? 'teams' : 'singles';
      const viewerHome = Number(m.isHomeUser) === 1 || Number(m.isHomeMember) === 1;
      const viewerAway = Number(m.isAwayUser) === 1 || Number(m.isAwayMember) === 1;
      const fallbackSide = (m.homeName || m.awayName) ? 'home' : null;
      const viewerSide = viewerHome ? 'home' : (viewerAway ? 'away' : fallbackSide);
      if (!viewerSide) return null;
      let opponentName = 'Gegner gesucht';
      let opponentAvatar = null;
      if (viewerSide === 'home') {
        if (matchType === 'teams') {
          const opp = m.awayTeamId && teamMap.get(Number(m.awayTeamId));
          opponentName = (opp && opp.name) || m.awayName || 'Noch kein Gegner';
        } else {
          const opp = m.awayUserId && userMap.get(Number(m.awayUserId));
          opponentName = (opp && opp.name) || m.awayName || 'Noch kein Gegner';
          opponentAvatar = (opp && opp.avatar_url) || null;
        }
      } else {
        if (matchType === 'teams') {
          const opp = m.homeTeamId && teamMap.get(Number(m.homeTeamId));
          opponentName = (opp && opp.name) || m.homeName || 'Noch kein Gegner';
        } else {
          const opp = m.homeUserId && userMap.get(Number(m.homeUserId));
          opponentName = (opp && opp.name) || m.homeName || 'Noch kein Gegner';
          opponentAvatar = (opp && opp.avatar_url) || null;
        }
      }
      const last = lastMessages.get(Number(m.id));
      const lastSenderUserId = last ? ((last.sender_user_id != null) ? last.sender_user_id : (last.legacy_sender_id != null ? last.legacy_sender_id : null)) : null;
      const lastSenderTeamId = last ? ((last.sender_team_id != null) ? last.sender_team_id : (last.legacy_team_id != null ? last.legacy_team_id : null)) : null;
      const lastCreatedAt = last ? (last.created_at || last.createdAt || null) : null;
      const lastMessage = last ? {
        id: last.id,
        body: last.body,
        createdAt: lastCreatedAt,
        senderUserId: lastSenderUserId,
        senderTeamId: lastSenderTeamId,
        senderUserName: (lastSenderUserId != null && userMap.has(Number(lastSenderUserId))) ? userMap.get(Number(lastSenderUserId)).name : null,
        senderTeamName: (lastSenderTeamId != null && teamMap.has(Number(lastSenderTeamId))) ? teamMap.get(Number(lastSenderTeamId)).name : null,
      } : null;
      const ts = determineTimestamp(m);
      // unread: for match chats we use match_message_reads.last_read_at per user
      let unread = 0;
      const lastRead = readsByMatch.get(Number(m.id)) || 0;
      if (last && lastCreatedAt) {
        const lastTs = Date.parse(lastCreatedAt) || 0;
        unread = lastTs > lastRead ? 1 : 0;
      }

      return {
        type: 'match',
        matchId: m.id,
        leagueId: m.leagueId,
        leagueName: m.leagueName || null,
        sportName: m.sportName || null,
        matchType,
        opponentName,
        opponentAvatar,
        lastMessage,
        lastActivityAt: ts,
        homeScore: hasHomeScore ? m.homeScore : null,
        awayScore: hasAwayScore ? m.awayScore : null,
        homeName: m.homeName || null,
        awayName: m.awayName || null,
        unread,
      };
    }).filter(Boolean);
  }

  async function listDirectChats(k, userId) {
    const hasChats = await k.schema.hasTable('direct_chats').catch(() => false);
    if (!hasChats) return [];
    const chats = await k('direct_chats')
      .where('user1_id', userId)
      .orWhere('user2_id', userId)
      .select('id', 'user1_id', 'user2_id', 'created_at', 'user1_last_read_at', 'user2_last_read_at');
    if (!chats || !chats.length) return [];
    const chatIds = chats.map(c => c.id);

    const lastByChat = new Map();
    const hasMsgs = await k.schema.hasTable('direct_messages').catch(() => false);
    if (hasMsgs && chatIds.length) {
      const rows = await k({ dm: 'direct_messages' })
        .whereIn('dm.chat_id', chatIds)
        .orderBy('dm.chat_id', 'asc')
        .orderBy('dm.created_at', 'desc')
        .select('dm.chat_id', 'dm.id', 'dm.body', 'dm.created_at', 'dm.sender_id');
      for (const r of rows || []) {
        if (!lastByChat.has(r.chat_id)) lastByChat.set(r.chat_id, r);
      }
    }

    const opponentIds = new Set();
    for (const c of chats) {
      const other = Number(c.user1_id) === Number(userId) ? Number(c.user2_id) : Number(c.user1_id);
      opponentIds.add(other);
      const last = lastByChat.get(c.id);
      if (last && last.sender_id != null) opponentIds.add(Number(last.sender_id));
    }

    const hasUsers = await k.schema.hasTable('users').catch(() => false);
    const userMap = new Map();
    if (hasUsers && opponentIds.size) {
      const usersInfo = await k('users').columnInfo().catch(() => ({}));
      const cols = ['id'];
      if (Object.prototype.hasOwnProperty.call(usersInfo, 'email')) cols.push('email');
      if (Object.prototype.hasOwnProperty.call(usersInfo, 'firstname')) cols.push('firstname');
      if (Object.prototype.hasOwnProperty.call(usersInfo, 'lastname')) cols.push('lastname');
      if (Object.prototype.hasOwnProperty.call(usersInfo, 'name')) cols.push('name');
      if (Object.prototype.hasOwnProperty.call(usersInfo, 'avatar_url')) cols.push('avatar_url');
      const rows = await k('users').whereIn('id', Array.from(opponentIds)).select(cols).catch(() => []);
      for (const u of rows || []) {
        const parts = [];
        if (u.firstname) parts.push(u.firstname);
        if (u.lastname) parts.push(u.lastname);
        const fn = parts.join(' ').trim();
        const label = fn || u.name || u.email || `User ${u.id}`;
        userMap.set(Number(u.id), { name: label, avatar_url: u.avatar_url || null });
      }
    }

    return chats.map(c => {
      const otherUserId = Number(c.user1_id) === Number(userId) ? Number(c.user2_id) : Number(c.user1_id);
      const last = lastByChat.get(c.id) || null;
      const lastReadRaw = (Number(c.user1_id) === Number(userId)) ? c.user1_last_read_at : c.user2_last_read_at;
      const lastRead = lastReadRaw ? (Date.parse(lastReadRaw) || 0) : 0;
      const lastTs = last && last.created_at ? (Date.parse(last.created_at) || 0) : 0;
      const unread = lastTs > lastRead ? 1 : 0;
      return {
        type: 'direct',
        chatId: c.id,
        opponentUserId: otherUserId,
        opponentName: (userMap.get(otherUserId)?.name) || `User ${otherUserId}`,
        opponentAvatar: (userMap.get(otherUserId)?.avatar_url) || null,
        lastMessage: last ? { id: last.id, body: last.body, createdAt: last.created_at, senderUserId: last.sender_id, senderUserName: (userMap.get(Number(last.sender_id))?.name) || null } : null,
        lastActivityAt: (last && last.created_at) || c.created_at || null,
        unread,
      };
    });
  }

  router.get('/', isAuthenticated, async (req, res) => {
    try {
      const started = Date.now();
      const startedIso = new Date(started).toISOString();
      console.log('[chats] GET /chats start', { user: req.user && req.user.id, at: startedIso });
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const userId = Number(req.user.id);

      const TIMEOUT_MS = Number(process.env.CHATS_TIMEOUT_MS || 2000);

      const work = (async () => {
        console.log('[chats] query.begin', { user: userId });
        const [matchChats, directChats] = await Promise.all([
          listMatchChats(k, userId).catch(() => []),
          listDirectChats(k, userId).catch(() => []),
        ]);
        const merged = [...matchChats, ...directChats].sort((a, b) => {
          const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt) || 0 : 0;
          const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt) || 0 : 0;
          return tb - ta;
        });
        return merged;
      })();

      const timeout = new Promise((_, reject) => {
        const t = setTimeout(() => {
          const took = Date.now() - started;
          console.warn('[chats] timeout', { user: userId, tookMs: took, timeoutMs: TIMEOUT_MS });
          const err = new Error('CHAT_LIST_TIMEOUT');
          err.code = 'CHAT_LIST_TIMEOUT';
          reject(err);
        }, TIMEOUT_MS);
      });

      const merged = await Promise.race([work, timeout]);
      const took = Date.now() - started;
      console.log('[chats] done', { user: userId, tookMs: took, items: Array.isArray(merged) ? merged.length : 0 });
      return res.json({ chats: merged });
    } catch (e) {
      // Handle timeout explicitly (client can choose to retry)
      if (e && (e.code === 'CHAT_LIST_TIMEOUT' || e.message === 'CHAT_LIST_TIMEOUT')) {
        return res.status(501).json({ error: 'CHAT_LIST_TIMEOUT' });
      }
      // For all other errors we degrade gracefully in dev/prod by returning an empty list
      // to avoid breaking the whole header/notifications UI.
      const errMsg = (e && (e.stack || e.message)) || String(e);
      const userId = req && req.user && req.user.id;
      console.error('[GET /chats] failed – returning empty list', { user: userId, err: errMsg });
      if (String(process.env.DEBUG_CHATS) === '1') {
        return res.status(200).json({ chats: [], debug: { error: errMsg } });
      }
      return res.status(200).json({ chats: [] });
    }
  });

  // Mark direct chat as read for current user
  router.post('/direct/:chatId/read', isAuthenticated, async (req, res) => {
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const { chatId } = req.params;
      const userId = Number(req.user.id);
      const chat = await k('direct_chats').where({ id: chatId }).first();
      if (!chat) return res.status(404).json({ error: 'CHAT_NOT_FOUND' });
      if (String(chat.user1_id) !== String(userId) && String(chat.user2_id) !== String(userId)) return res.status(403).json({ error: 'NOT_PARTICIPANT' });
      const now = new Date().toISOString();
      const patch = (String(chat.user1_id) === String(userId)) ? { user1_last_read_at: now } : { user2_last_read_at: now };
      await k('direct_chats').where({ id: chatId }).update(patch);
      return res.json({ ok: true, last_read_at: now });
    } catch (e) {
      console.error('[POST /chats/direct/:chatId/read] failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'READ_MARK_FAILED' });
    }
  });

  // Mark match chat as read for current user
  router.post('/match/:matchId/read', isAuthenticated, async (req, res) => {
    try {
      const k = getKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const { matchId } = req.params;
      const userId = Number(req.user.id);
      const now = new Date().toISOString();
      const { table: readsTable, matchIdColumn } = await detectReadTable(k);
      if (!readsTable || !matchIdColumn) {
        return res.json({ ok: true, last_read_at: now, note: 'READ_TRACKING_DISABLED' });
      }
      const normalizedMatchId = Number(matchId);
      const matchValue = Number.isNaN(normalizedMatchId) ? matchId : normalizedMatchId;
      const whereClause = { [matchIdColumn]: matchValue, user_id: userId };
      const existing = await k(readsTable).where(whereClause).first();
      if (existing) {
        await k(readsTable).where(whereClause).update({ last_read_at: now });
      } else {
        await k(readsTable).insert({ ...whereClause, last_read_at: now });
      }
      return res.json({ ok: true, last_read_at: now });
    } catch (e) {
      console.error('[POST /chats/match/:matchId/read] failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'READ_MARK_FAILED' });
    }
  });

  return router;
};
