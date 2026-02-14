const express = require('express');
const { optionalAuth, isAdmin } = require('../middleware/auth');

module.exports = function complianceRoutes(ctx = {}) {
  const router = express.Router();
  const { db, sendMail, mailerState } = ctx;

  async function ensureTable() {
    if (!db || !db.schema) return;
    const has = await db.schema.hasTable('compliance_reports').catch(() => false);
    if (!has) {
      await db.schema.createTable('compliance_reports', (table) => {
        table.increments('id').primary();
        table.integer('reporter_user_id').nullable();
        table.integer('reported_user_id').notNullable();
        table.string('reporter_name', 180).nullable();
        table.string('reporter_email', 255).nullable();
        table.string('category', 80).notNullable().defaultTo('other');
        table.string('subject', 255).notNullable();
        table.text('message').notNullable();
        table.string('content_url', 500).nullable();
        table.string('status', 32).notNullable().defaultTo('open');
        table.text('admin_notes').nullable();
        table.integer('assigned_task_id').nullable();
        table.text('created_at').notNullable();
        table.text('updated_at').notNullable();
      });
      return;
    }

    const hasAssignedTask = await db.schema.hasColumn('compliance_reports', 'assigned_task_id').catch(() => true);
    const hasAdminNotes = await db.schema.hasColumn('compliance_reports', 'admin_notes').catch(() => true);
    const hasReportedUser = await db.schema.hasColumn('compliance_reports', 'reported_user_id').catch(() => true);
    if (!hasAssignedTask || !hasAdminNotes || !hasReportedUser) {
      await db.schema.alterTable('compliance_reports', (table) => {
        if (!hasAssignedTask) table.integer('assigned_task_id').nullable();
        if (!hasAdminNotes) table.text('admin_notes').nullable();
        if (!hasReportedUser) table.integer('reported_user_id').nullable();
      });
    }
  }

  function parseStatus(value) {
    const normalized = String(value || '').toLowerCase();
    if (!normalized) return null;
    if (['open', 'in_review', 'resolved', 'rejected'].includes(normalized)) return normalized;
    return null;
  }

  async function notifyComplianceInbox(report) {
    const recipient =
      process.env.COMPLIANCE_REPORT_EMAIL
      || process.env.MAIL_COMPLIANCE_TO
      || process.env.COMPLIANCE_CONTACT_EMAIL;

    if (!recipient || !(mailerState && mailerState.enabled) || typeof sendMail !== 'function') {
      return false;
    }

    const subject = `[Compliance] Neue Meldung #${report.id}: ${report.subject}`;
    const html = `
      <h2>Neue Compliance-Meldung</h2>
      <p><strong>ID:</strong> ${report.id}</p>
      <p><strong>Kategorie:</strong> ${report.category}</p>
      <p><strong>Status:</strong> ${report.status}</p>
      <p><strong>Reporter:</strong> ${report.reporter_name || '-'} (${report.reporter_email || '-'})</p>
      <p><strong>Gemeldete User-ID:</strong> ${report.reported_user_id || '-'}</p>
      <p><strong>Inhalt/URL:</strong> ${report.content_url || '-'}</p>
      <p><strong>Betreff:</strong> ${report.subject}</p>
      <p><strong>Nachricht:</strong><br/>${String(report.message || '').replace(/\n/g, '<br/>')}</p>
      <hr/>
      <p>Diese Meldung ist im Compliance-Dashboard verfügbar.</p>
    `;

    await sendMail(recipient, subject, html);
    return true;
  }

  router.post('/reports', optionalAuth, async (req, res) => {
    try {
      await ensureTable();
      const {
        reporter_name = '',
        reporter_email = '',
        reported_user_id = null,
        category = 'other',
        subject = '',
        message = '',
        content_url = '',
      } = req.body || {};

      const reportedUserId = Number(reported_user_id);
      if (!Number.isFinite(reportedUserId) || reportedUserId <= 0) {
        return res.status(400).json({ error: 'REPORTED_USER_ID_REQUIRED' });
      }

      if (!String(subject).trim() || !String(message).trim()) {
        return res.status(400).json({ error: 'SUBJECT_AND_MESSAGE_REQUIRED' });
      }

      const now = new Date().toISOString();
      const payload = {
        reporter_user_id: req.user?.id || null,
        reported_user_id: reportedUserId,
        reporter_name: String(reporter_name || '').trim() || null,
        reporter_email: String(reporter_email || '').trim() || null,
        category: String(category || 'other').slice(0, 80),
        subject: String(subject).trim().slice(0, 255),
        message: String(message).trim(),
        content_url: String(content_url || '').trim() || null,
        status: 'open',
        created_at: now,
        updated_at: now,
      };

      const inserted = await db('compliance_reports').insert(payload);
      let id = Array.isArray(inserted) ? inserted[0] : inserted;
      if (!id || typeof id === 'object') {
        const row = await db('compliance_reports').select('id').orderBy('id', 'desc').first();
        id = row?.id;
      }

      const created = await db('compliance_reports').where({ id }).first();
      let emailSent = false;
      try {
        emailSent = await notifyComplianceInbox(created || { ...payload, id });
      } catch (mailErr) {
        console.warn('Compliance notification email failed:', mailErr && (mailErr.message || mailErr));
      }

      return res.status(201).json({ ok: true, report: created, emailSent });
    } catch (error) {
      console.error('POST /compliance/reports failed:', error && (error.stack || error.message || error));
      return res.status(500).json({ error: 'REPORT_CREATE_FAILED' });
    }
  });

  router.get('/reports', isAdmin, async (req, res) => {
    try {
      await ensureTable();
      const status = parseStatus(req.query.status);
      const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);

      let query = db('compliance_reports').select('*').orderBy('created_at', 'desc').limit(limit);
      if (status) query = query.where({ status });

      const rows = await query;
      return res.json(rows || []);
    } catch (error) {
      console.error('GET /compliance/reports failed:', error && (error.stack || error.message || error));
      return res.status(500).json({ error: 'REPORT_FETCH_FAILED' });
    }
  });

  router.get('/summary', isAdmin, async (_req, res) => {
    try {
      await ensureTable();
      const [openRow, reviewRow, resolvedRow, totalRow] = await Promise.all([
        db('compliance_reports').where({ status: 'open' }).count({ c: '*' }).first().catch(() => ({ c: 0 })),
        db('compliance_reports').where({ status: 'in_review' }).count({ c: '*' }).first().catch(() => ({ c: 0 })),
        db('compliance_reports').where({ status: 'resolved' }).count({ c: '*' }).first().catch(() => ({ c: 0 })),
        db('compliance_reports').count({ c: '*' }).first().catch(() => ({ c: 0 })),
      ]);

      const toNum = (row) => Number(row?.c || row?.['count(*)'] || 0);
      return res.json({
        open: toNum(openRow),
        in_review: toNum(reviewRow),
        resolved: toNum(resolvedRow),
        total: toNum(totalRow),
      });
    } catch (error) {
      console.error('GET /compliance/summary failed:', error && (error.stack || error.message || error));
      return res.status(500).json({ error: 'SUMMARY_FAILED' });
    }
  });

  router.patch('/reports/:id', isAdmin, async (req, res) => {
    try {
      await ensureTable();
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'INVALID_ID' });

      const updates = {};
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'status')) {
        const status = parseStatus(req.body.status);
        if (!status) return res.status(400).json({ error: 'INVALID_STATUS' });
        updates.status = status;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'admin_notes')) {
        updates.admin_notes = String(req.body.admin_notes || '').trim() || null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_task_id')) {
        const taskId = Number(req.body.assigned_task_id);
        updates.assigned_task_id = Number.isFinite(taskId) && taskId > 0 ? taskId : null;
      }

      updates.updated_at = new Date().toISOString();
      await db('compliance_reports').where({ id }).update(updates);
      const row = await db('compliance_reports').where({ id }).first();
      if (!row) return res.status(404).json({ error: 'REPORT_NOT_FOUND' });
      return res.json(row);
    } catch (error) {
      console.error('PATCH /compliance/reports/:id failed:', error && (error.stack || error.message || error));
      return res.status(500).json({ error: 'REPORT_UPDATE_FAILED' });
    }
  });

  return router;
};
