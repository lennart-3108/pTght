const express = require('express');

const ALLOWED_STATUSES = ['to-do', 'in progress', 'blocked', 'test', 'prod', 'done'];
const ALLOWED_TYPES = ['story', 'epic', 'project', 'improvement/idea', 'bug'];

function normalizeNullableInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

module.exports = function tasksRoutes(ctx) {
  const router = express.Router();
  const { db } = ctx;

  async function ensureTable() {
    if (!db || !db.schema) return;
    const hasTable = await db.schema.hasTable('tasks_board');
    if (!hasTable) {
      await db.schema.createTable('tasks_board', (table) => {
        table.increments('id').primary();
        table.string('title', 255).notNullable();
        table.text('description');
        table.string('type', 40).notNullable().defaultTo('project');
        table.string('status', 40).notNullable().defaultTo('to-do');
        table.string('assignee', 120);
        table.integer('linked_story_task_id');
        table.integer('blocked_by_task_id');
        table.text('created_at').defaultTo(db.fn.now());
        table.text('updated_at').defaultTo(db.fn.now());
      });
      return;
    }

    const needsAssignee = !(await db.schema.hasColumn('tasks_board', 'assignee'));
    const needsLinkedStory = !(await db.schema.hasColumn('tasks_board', 'linked_story_task_id'));
    const needsBlockedBy = !(await db.schema.hasColumn('tasks_board', 'blocked_by_task_id'));
    if (needsAssignee || needsLinkedStory || needsBlockedBy) {
      await db.schema.alterTable('tasks_board', (table) => {
        if (needsAssignee) table.string('assignee', 120);
        if (needsLinkedStory) table.integer('linked_story_task_id');
        if (needsBlockedBy) table.integer('blocked_by_task_id');
      });
    }
  }

  async function tableExists() {
    if (!db || !db.schema) return false;
    return db.schema.hasTable('tasks_board');
  }

  router.get('/', async (req, res) => {
    try {
      await ensureTable();
      const { type } = req.query;

      let query = db('tasks_board').select('*').orderBy('id', 'desc');
      if (type && ALLOWED_TYPES.includes(String(type).toLowerCase())) {
        query = query.where('type', String(type).toLowerCase());
      }

      const rows = await query;
      res.json(rows || []);
    } catch (error) {
      console.error('GET /tasks failed:', error);
      res.status(500).json({ error: 'TASKS_FETCH_FAILED' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      await ensureTable();
      const {
        title,
        description = '',
        type = 'project',
        status = 'to-do',
        assignee = '',
        linked_story_task_id = null,
        blocked_by_task_id = null,
      } = req.body || {};

      const normalizedType = String(type).toLowerCase();
      const normalizedStatus = String(status).toLowerCase();
      const linkedStoryTaskId = normalizeNullableInt(linked_story_task_id);
      const blockedByTaskId = normalizeNullableInt(blocked_by_task_id);

      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'TITLE_REQUIRED' });
      }
      if (!ALLOWED_TYPES.includes(normalizedType)) {
        return res.status(400).json({ error: 'INVALID_TYPE' });
      }
      if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({ error: 'INVALID_STATUS' });
      }
      if (linked_story_task_id !== null && linked_story_task_id !== undefined && linked_story_task_id !== '' && !linkedStoryTaskId) {
        return res.status(400).json({ error: 'INVALID_LINKED_STORY' });
      }
      if (blocked_by_task_id !== null && blocked_by_task_id !== undefined && blocked_by_task_id !== '' && !blockedByTaskId) {
        return res.status(400).json({ error: 'INVALID_BLOCKED_BY' });
      }

      const payload = {
        title: String(title).trim(),
        description: String(description || '').trim(),
        type: normalizedType,
        status: normalizedStatus,
        assignee: String(assignee || '').trim() || null,
        linked_story_task_id: linkedStoryTaskId,
        blocked_by_task_id: blockedByTaskId,
        updated_at: new Date().toISOString(),
      };

      const inserted = await db('tasks_board').insert(payload);
      let newId = Array.isArray(inserted) ? inserted[0] : inserted;
      if (!newId || typeof newId === 'object') {
        const fallbackRow = await db('tasks_board').select('id').orderBy('id', 'desc').first();
        newId = fallbackRow?.id;
      }
      const created = await db('tasks_board').where({ id: newId }).first();
      res.status(201).json(created);
    } catch (error) {
      console.error('POST /tasks failed:', error);
      res.status(500).json({ error: 'TASK_CREATE_FAILED' });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      if (!(await tableExists())) {
        return res.status(404).json({ error: 'TASK_NOT_FOUND' });
      }

      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: 'INVALID_ID' });
      }

      const current = await db('tasks_board').where({ id }).first();
      if (!current) {
        return res.status(404).json({ error: 'TASK_NOT_FOUND' });
      }

      const updates = {};
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
        const title = String(req.body.title || '').trim();
        if (!title) return res.status(400).json({ error: 'TITLE_REQUIRED' });
        updates.title = title;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
        updates.description = String(req.body.description || '').trim();
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'type')) {
        const type = String(req.body.type || '').toLowerCase();
        if (!ALLOWED_TYPES.includes(type)) return res.status(400).json({ error: 'INVALID_TYPE' });
        updates.type = type;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'status')) {
        const status = String(req.body.status || '').toLowerCase();
        if (!ALLOWED_STATUSES.includes(status)) return res.status(400).json({ error: 'INVALID_STATUS' });
        updates.status = status;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'assignee')) {
        updates.assignee = String(req.body.assignee || '').trim() || null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'linked_story_task_id')) {
        const linkedStoryTaskId = normalizeNullableInt(req.body.linked_story_task_id);
        if (req.body.linked_story_task_id !== null && req.body.linked_story_task_id !== undefined && req.body.linked_story_task_id !== '' && !linkedStoryTaskId) {
          return res.status(400).json({ error: 'INVALID_LINKED_STORY' });
        }
        updates.linked_story_task_id = linkedStoryTaskId;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'blocked_by_task_id')) {
        const blockedByTaskId = normalizeNullableInt(req.body.blocked_by_task_id);
        if (req.body.blocked_by_task_id !== null && req.body.blocked_by_task_id !== undefined && req.body.blocked_by_task_id !== '' && !blockedByTaskId) {
          return res.status(400).json({ error: 'INVALID_BLOCKED_BY' });
        }
        updates.blocked_by_task_id = blockedByTaskId;
      }

      updates.updated_at = new Date().toISOString();
      await db('tasks_board').where({ id }).update(updates);

      const updated = await db('tasks_board').where({ id }).first();
      res.json(updated);
    } catch (error) {
      console.error('PATCH /tasks/:id failed:', error);
      res.status(500).json({ error: 'TASK_UPDATE_FAILED' });
    }
  });

  return router;
};
