const express = require("express");
const { isAuthenticated } = require("../../middleware/auth");

module.exports = function messagesRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;
  // Resolve knex: prefer adapter.knex; fallback to legacy knex instance from ../../db
  function resolveKnex() {
    if (ctx && ctx.db && ctx.db.knex && ctx.db.knex.client) return ctx.db.knex;
    try {
      const k = require("../../db");
      if (k && k.client) return k;
    } catch (_) {}
    return null;
  }

  function normalizePair(a, b) {
    const x = Number(a), y = Number(b);
    return (x <= y) ? { u1: x, u2: y } : { u1: y, u2: x };
  }

  async function ensureDirectChat(k, me, target) {
    const { u1, u2 } = normalizePair(me, target);
    let chat = await k('direct_chats').where({ user1_id: u1, user2_id: u2 }).first();
    if (!chat) {
      const ids = await k('direct_chats').insert({ user1_id: u1, user2_id: u2 }).returning('id').catch(async () => {
        await k('direct_chats').insert({ user1_id: u1, user2_id: u2 });
        const row = await k('direct_chats').where({ user1_id: u1, user2_id: u2 }).first();
        return [{ id: row && row.id }];
      });
      const id = Array.isArray(ids) ? (ids[0]?.id || ids[0]) : ids;
      chat = await k('direct_chats').where({ id }).first();
    }
    return chat;
  }

  async function ensureDirectMatchInvitationsTable(k) {
    const exists = await k.schema.hasTable('direct_match_invitations').catch(() => false);
    if (exists) return;
    await k.schema.createTable('direct_match_invitations', (t) => {
      t.increments('id').primary();
      t.integer('chat_id').notNullable();
      t.integer('requester_user_id').notNullable();
      t.integer('recipient_user_id').notNullable();
      t.integer('sport_id').notNullable();
      t.integer('city_id').notNullable();
      t.integer('location_id');
      t.text('when_type');
      t.text('kickoff_at');
      t.text('kickoff_end_at');
      t.integer('range_days');
      t.text('player_level');
      t.text('time_of_day');
      t.text('time_from');
      t.text('time_to');
      t.text('note');
      t.text('availability_json');
      t.text('status').notNullable().defaultTo('pending');
      t.integer('match_id');
      t.text('created_at').defaultTo(k.raw('CURRENT_TIMESTAMP'));
      t.text('updated_at');
      t.text('responded_at');
      t.index(['chat_id', 'created_at'], 'dmi_chat_created_idx');
      t.index(['recipient_user_id', 'status'], 'dmi_recipient_status_idx');
    });
  }

  async function insertDirectMessage(k, chatId, senderId, body) {
    const ins = await k('direct_messages').insert({ chat_id: chatId, sender_id: senderId, body }).returning(['id']).catch(async () => {
      await k('direct_messages').insert({ chat_id: chatId, sender_id: senderId, body });
      const row = await k('direct_messages').where({ chat_id: chatId, sender_id: senderId, body }).orderBy('id', 'desc').first();
      return [{ id: row && row.id }];
    });
    const newId = Array.isArray(ins) ? (ins[0]?.id || ins[0]) : ins;
    return k('direct_messages').where({ id: newId }).first();
  }

  function parseEqualSides(raw) {
    const m = String(raw || '').match(/(\d+)\s*v\s*(\d+)/i);
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0 || a !== b) return null;
    return a;
  }

  async function buildMatchFormatForSport(k, sportId) {
    const sportRow = await k('sports').where({ id: sportId }).first().catch(() => null);
    if (!sportRow) throw Object.assign(new Error('SPORT_NOT_FOUND'), { status: 404 });
    if (Object.prototype.hasOwnProperty.call(sportRow, 'active') && Number(sportRow.active) !== 1) {
      throw Object.assign(new Error('SPORT_INACTIVE'), { status: 403 });
    }

    const sportName = String(sportRow?.name || '').toLowerCase();
    const variantType = String(sportRow?.variant_type || '').toLowerCase();
    const sportType = String(sportRow?.sport_type || sportRow?.type || '').toLowerCase();
    const configuredTeamSize = Number(sportRow?.team_size || 0);

    let teamCount = 2;
    let playersPerTeam = 1;
    let maxPlayers = 2;

    const vv = parseEqualSides(variantType) || parseEqualSides(sportName);
    const isDoubles = variantType.includes('doppel') || sportName.includes('doppel') || variantType.includes('mixed') || sportName.includes('mixed') || sportName.includes('padel');
    const isTeam = sportType.includes('team') || vv != null || configuredTeamSize > 1;

    if (vv != null) {
      playersPerTeam = vv;
      maxPlayers = vv * 2;
    } else if (isDoubles) {
      playersPerTeam = 2;
      maxPlayers = 4;
    } else if (isTeam) {
      playersPerTeam = configuredTeamSize || 5;
      maxPlayers = teamCount * playersPerTeam;
    }

    return { sportRow, teamCount, playersPerTeam, maxPlayers };
  }

  async function ensureOpenLeagueForSportCity(k, sportId, cityId) {
    let league = await k('leagues').where({ name: 'Open Matches', sport_id: sportId, city_id: cityId }).first().catch(() => null);
    if (league?.id) return Number(league.id);
    try {
      const inserted = await k('leagues').insert({ name: 'Open Matches', sport_id: sportId, city_id: cityId });
      return Array.isArray(inserted) ? Number(inserted[0]) : Number(inserted);
    } catch (_) {
      league = await k('leagues').where({ name: 'Open Matches', sport_id: sportId, city_id: cityId }).first().catch(() => null);
      if (league?.id) return Number(league.id);
      throw Object.assign(new Error('OPEN_LEAGUE_CREATE_FAILED'), { status: 500 });
    }
  }

  async function insertAvailabilityFromJson(k, matchId, userId, availabilityJson) {
    let availability = [];
    try {
      availability = JSON.parse(availabilityJson || '[]');
    } catch (_) {
      availability = [];
    }
    if (!Array.isArray(availability) || availability.length === 0) return;

    const hasDays = await k.schema.hasTable('match_availability_days').catch(() => false);
    const hasWindows = await k.schema.hasTable('match_availability_windows').catch(() => false);
    if (!hasDays || !hasWindows) return;

    const grouped = {};
    availability.forEach((slot) => {
      if (!slot?.date || !slot?.timeStart || !slot?.timeEnd) return;
      if (!grouped[slot.date]) grouped[slot.date] = [];
      grouped[slot.date].push({ timeStart: slot.timeStart, timeEnd: slot.timeEnd });
    });

    for (const [date, windows] of Object.entries(grouped)) {
      const dayIns = await k('match_availability_days').insert({
        match_id: matchId,
        user_id: userId,
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

  async function createMatchFromInvitation(k, invitation) {
    const info = await k('matches').columnInfo().catch(() => ({}));
    const leagueId = await ensureOpenLeagueForSportCity(k, Number(invitation.sport_id), Number(invitation.city_id));
    const format = await buildMatchFormatForSport(k, Number(invitation.sport_id));

    const rec = {
      league_id: leagueId,
      home_user_id: Number(invitation.requester_user_id),
      away_user_id: Number(invitation.recipient_user_id),
      home_team_id: null,
      away_team_id: null,
      home_score: null,
      away_score: null,
    };

    if (Object.prototype.hasOwnProperty.call(info, 'max_players')) rec.max_players = format.maxPlayers;
    if (Object.prototype.hasOwnProperty.call(info, 'team_count')) rec.team_count = format.teamCount;
    if (Object.prototype.hasOwnProperty.call(info, 'players_per_team')) rec.players_per_team = format.playersPerTeam;
    if (Object.prototype.hasOwnProperty.call(info, 'allow_team_choice')) rec.allow_team_choice = format.maxPlayers > 2 ? 1 : 0;
    if (Object.prototype.hasOwnProperty.call(info, 'kickoff_at')) rec.kickoff_at = invitation.kickoff_at || null;
    if (Object.prototype.hasOwnProperty.call(info, 'kickoff_end_at')) rec.kickoff_end_at = invitation.kickoff_end_at || null;
    if (Object.prototype.hasOwnProperty.call(info, 'when_type')) rec.when_type = invitation.when_type || null;
    if (Object.prototype.hasOwnProperty.call(info, 'range_days')) rec.range_days = invitation.range_days || null;
    if (Object.prototype.hasOwnProperty.call(info, 'player_level')) rec.player_level = invitation.player_level || null;
    if (Object.prototype.hasOwnProperty.call(info, 'time_of_day')) rec.time_of_day = invitation.time_of_day || null;
    if (Object.prototype.hasOwnProperty.call(info, 'time_from')) rec.time_from = invitation.time_from || null;
    if (Object.prototype.hasOwnProperty.call(info, 'time_to')) rec.time_to = invitation.time_to || null;
    if (Object.prototype.hasOwnProperty.call(info, 'location_id') && invitation.location_id) rec.location_id = Number(invitation.location_id);
    if (Object.prototype.hasOwnProperty.call(info, 'status')) rec.status = 'pending';
    if (Object.prototype.hasOwnProperty.call(info, 'created_at')) rec.created_at = new Date().toISOString();

    const inserted = await k('matches').insert(rec);
    const matchId = Array.isArray(inserted) ? inserted[0] : inserted;

    const hasParticipants = await k.schema.hasTable('match_participants').catch(() => false);
    if (hasParticipants && format.maxPlayers > 2) {
      await k('match_participants').insert([
        {
          match_id: matchId,
          user_id: Number(invitation.requester_user_id),
          team_index: 1,
          status: 'joined',
          joined_at: new Date().toISOString(),
        },
        {
          match_id: matchId,
          user_id: Number(invitation.recipient_user_id),
          team_index: 2,
          status: 'joined',
          joined_at: new Date().toISOString(),
        }
      ]).catch(() => {});
    }

    await insertAvailabilityFromJson(k, matchId, Number(invitation.requester_user_id), invitation.availability_json);
    return Number(matchId);
  }

  // Ensure chat exists (or create) for current user and target
  router.post('/users/:id/start-chat', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const me = Number(req.user && req.user.id);
      const target = Number(req.params.id);
      if (!Number.isFinite(me) || !Number.isFinite(target)) return res.status(400).json({ error: 'Ungültige ID' });
      if (me === target) return res.status(400).json({ error: 'SELF_CHAT_NOT_ALLOWED' });
      const chat = await ensureDirectChat(k, me, target);
      return res.json({ ok: true, url: `/chat/user/${target}`, chatId: chat?.id || null });
    } catch (e) {
      return res.status(500).json({ error: 'CHAT_CREATE_FAILED', details: e?.message || String(e) });
    }
  });

  // List messages for the chat with target user (auth required)
  router.get('/users/:id/messages', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const me = Number(req.user && req.user.id);
      const target = Number(req.params.id);
      if (!Number.isFinite(me) || !Number.isFinite(target)) return res.status(400).json({ error: 'Ungültige ID' });
      const { u1, u2 } = normalizePair(me, target);
      const chat = await k('direct_chats').where({ user1_id: u1, user2_id: u2 }).first();
      if (!chat) return res.json({ messages: [] });
      const items = await k('direct_messages').where({ chat_id: chat.id }).orderBy('created_at', 'asc').select('id', 'sender_id', 'body', 'created_at');
      return res.json({ chatId: chat.id, messages: items || [] });
    } catch (e) {
      return res.status(500).json({ error: 'MESSAGES_FETCH_FAILED', details: e?.message || String(e) });
    }
  });

  router.get('/users/:id/match-invitations', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureDirectMatchInvitationsTable(k);
      const me = Number(req.user && req.user.id);
      const target = Number(req.params.id);
      if (!Number.isFinite(me) || !Number.isFinite(target)) return res.status(400).json({ error: 'Ungültige ID' });

      const chat = await ensureDirectChat(k, me, target);
      const rows = await k('direct_match_invitations as i')
        .leftJoin('sports as s', 's.id', 'i.sport_id')
        .leftJoin('cities as c', 'c.id', 'i.city_id')
        .where('i.chat_id', chat.id)
        .orderBy('i.created_at', 'asc')
        .select(
          'i.*',
          { sport_name: 's.name' },
          { city_name: 'c.name' }
        );

      return res.json({ invitations: rows || [] });
    } catch (e) {
      return res.status(500).json({ error: 'INVITATIONS_FETCH_FAILED', details: e?.message || String(e) });
    }
  });

  router.post('/users/:id/match-invitations', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureDirectMatchInvitationsTable(k);

      const me = Number(req.user && req.user.id);
      const target = Number(req.params.id);
      const sportId = Number(req.body?.sportId || 0);
      const cityId = Number(req.body?.cityId || 0);
      const locationId = req.body?.locationId ? Number(req.body.locationId) : null;
      const note = String(req.body?.note || '').trim();
      const availability = Array.isArray(req.body?.availability) ? req.body.availability : [];
      if (!Number.isFinite(me) || !Number.isFinite(target)) return res.status(400).json({ error: 'Ungültige ID' });
      if (me === target) return res.status(400).json({ error: 'SELF_INVITE_NOT_ALLOWED' });
      if (!sportId || !cityId) return res.status(400).json({ error: 'sportId and cityId are required' });

      const chat = await ensureDirectChat(k, me, target);

      const pendingExisting = await k('direct_match_invitations')
        .where({ chat_id: chat.id, requester_user_id: me, recipient_user_id: target, status: 'pending' })
        .first()
        .catch(() => null);
      if (pendingExisting) return res.status(409).json({ error: 'INVITATION_ALREADY_PENDING', invitation: pendingExisting });

      await buildMatchFormatForSport(k, sportId);

      const payload = {
        chat_id: chat.id,
        requester_user_id: me,
        recipient_user_id: target,
        sport_id: sportId,
        city_id: cityId,
        location_id: locationId,
        when_type: req.body?.when_type ? String(req.body.when_type).trim() : null,
        kickoff_at: req.body?.kickoff_at ? String(req.body.kickoff_at).trim() : null,
        kickoff_end_at: req.body?.kickoff_end_at ? String(req.body.kickoff_end_at).trim() : null,
        range_days: req.body?.range_days ? Number(req.body.range_days) : null,
        player_level: req.body?.player_level ? String(req.body.player_level).trim() : null,
        time_of_day: req.body?.time_of_day ? String(req.body.time_of_day).trim() : null,
        time_from: req.body?.time_from ? String(req.body.time_from).trim() : null,
        time_to: req.body?.time_to ? String(req.body.time_to).trim() : null,
        note: note || null,
        availability_json: JSON.stringify(availability || []),
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const inserted = await k('direct_match_invitations').insert(payload).returning(['id']).catch(async () => {
        await k('direct_match_invitations').insert(payload);
        const row = await k('direct_match_invitations').where({ chat_id: chat.id, requester_user_id: me, recipient_user_id: target, created_at: payload.created_at }).first();
        return [{ id: row && row.id }];
      });
      const invitationId = Array.isArray(inserted) ? (inserted[0]?.id || inserted[0]) : inserted;
      const invitation = await k('direct_match_invitations as i')
        .leftJoin('sports as s', 's.id', 'i.sport_id')
        .leftJoin('cities as c', 'c.id', 'i.city_id')
        .where('i.id', invitationId)
        .first('i.*', { sport_name: 's.name' }, { city_name: 'c.name' });

      const body = `Match-Anfrage: ${invitation?.sport_name || 'Sport'} in ${invitation?.city_name || 'Stadt'} gesendet.`;
      await insertDirectMessage(k, chat.id, me, body).catch(() => null);

      return res.status(201).json({ ok: true, invitation });
    } catch (e) {
      const status = Number(e?.status || 500);
      return res.status(status).json({ error: e?.message || 'INVITATION_CREATE_FAILED', details: e?.message || String(e) });
    }
  });

  router.post('/match-invitations/:invitationId/accept', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureDirectMatchInvitationsTable(k);

      const invitationId = Number(req.params.invitationId);
      const viewerId = Number(req.user && req.user.id);
      if (!Number.isFinite(invitationId) || !Number.isFinite(viewerId)) return res.status(400).json({ error: 'INVALID_ID' });

      const invitation = await k('direct_match_invitations').where({ id: invitationId }).first();
      if (!invitation) return res.status(404).json({ error: 'INVITATION_NOT_FOUND' });
      if (Number(invitation.recipient_user_id) !== viewerId) return res.status(403).json({ error: 'NOT_INVITATION_RECIPIENT' });
      if (invitation.status === 'accepted' && invitation.match_id) return res.json({ ok: true, invitation, matchId: invitation.match_id });
      if (invitation.status !== 'pending') return res.status(400).json({ error: 'INVITATION_NOT_PENDING' });

      const matchId = await createMatchFromInvitation(k, invitation);
      const nowIso = new Date().toISOString();
      await k('direct_match_invitations').where({ id: invitationId }).update({
        status: 'accepted',
        match_id: matchId,
        responded_at: nowIso,
        updated_at: nowIso,
      });

      await insertDirectMessage(k, Number(invitation.chat_id), viewerId, `Match-Anfrage angenommen. Match #${matchId} wurde erstellt.`).catch(() => null);
      const updated = await k('direct_match_invitations').where({ id: invitationId }).first();
      return res.json({ ok: true, invitation: updated, matchId });
    } catch (e) {
      return res.status(500).json({ error: 'INVITATION_ACCEPT_FAILED', details: e?.message || String(e) });
    }
  });

  router.post('/match-invitations/:invitationId/reject', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      await ensureDirectMatchInvitationsTable(k);

      const invitationId = Number(req.params.invitationId);
      const viewerId = Number(req.user && req.user.id);
      if (!Number.isFinite(invitationId) || !Number.isFinite(viewerId)) return res.status(400).json({ error: 'INVALID_ID' });

      const invitation = await k('direct_match_invitations').where({ id: invitationId }).first();
      if (!invitation) return res.status(404).json({ error: 'INVITATION_NOT_FOUND' });
      if (Number(invitation.recipient_user_id) !== viewerId) return res.status(403).json({ error: 'NOT_INVITATION_RECIPIENT' });
      if (invitation.status !== 'pending') return res.status(400).json({ error: 'INVITATION_NOT_PENDING' });

      const nowIso = new Date().toISOString();
      await k('direct_match_invitations').where({ id: invitationId }).update({
        status: 'rejected',
        responded_at: nowIso,
        updated_at: nowIso,
      });

      await insertDirectMessage(k, Number(invitation.chat_id), viewerId, 'Match-Anfrage abgelehnt.').catch(() => null);
      const updated = await k('direct_match_invitations').where({ id: invitationId }).first();
      return res.json({ ok: true, invitation: updated });
    } catch (e) {
      return res.status(500).json({ error: 'INVITATION_REJECT_FAILED', details: e?.message || String(e) });
    }
  });

  // Send a message to the target user (auth required)
  router.post('/users/:id/messages', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const me = Number(req.user && req.user.id);
      const target = Number(req.params.id);
      const body = String((req.body && req.body.body) || '').trim();
      if (!Number.isFinite(me) || !Number.isFinite(target)) return res.status(400).json({ error: 'Ungültige ID' });
      if (!body) return res.status(400).json({ error: 'EMPTY_MESSAGE' });
      const chat = await ensureDirectChat(k, me, target);
      const msg = await insertDirectMessage(k, chat.id, me, body);
      return res.json({ ok: true, message: msg });
    } catch (e) {
      return res.status(500).json({ error: 'MESSAGE_SEND_FAILED', details: e?.message || String(e) });
    }
  });

  return router;
};
