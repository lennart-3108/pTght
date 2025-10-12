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

  // Ensure chat exists (or create) for current user and target
  router.post('/users/:id/start-chat', isAuthenticated, async (req, res) => {
    try {
      const k = resolveKnex();
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
      const me = Number(req.user && req.user.id);
      const target = Number(req.params.id);
      if (!Number.isFinite(me) || !Number.isFinite(target)) return res.status(400).json({ error: 'Ungültige ID' });
      if (me === target) return res.status(400).json({ error: 'SELF_CHAT_NOT_ALLOWED' });
      const { u1, u2 } = normalizePair(me, target);
      // find or create
      let chat = await k('direct_chats').where({ user1_id: u1, user2_id: u2 }).first();
      if (!chat) {
        const ids = await k('direct_chats').insert({ user1_id: u1, user2_id: u2 }).returning('id').catch(async () => {
          // sqlite returning fallback
          await k('direct_chats').insert({ user1_id: u1, user2_id: u2 });
          const row = await k('direct_chats').where({ user1_id: u1, user2_id: u2 }).first();
          return [{ id: row && row.id }];
        });
        const id = Array.isArray(ids) ? (ids[0]?.id || ids[0]) : ids;
        chat = await k('direct_chats').where({ id }).first();
      }
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
      const ins = await k('direct_messages').insert({ chat_id: chat.id, sender_id: me, body }).returning(['id']);
      const newId = Array.isArray(ins) ? (ins[0]?.id || ins[0]) : ins;
      const msg = await k('direct_messages').where({ id: newId }).first();
      return res.json({ ok: true, message: msg });
    } catch (e) {
      return res.status(500).json({ error: 'MESSAGE_SEND_FAILED', details: e?.message || String(e) });
    }
  });

  return router;
};
