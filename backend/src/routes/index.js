const express = require("express");
const { createMiddleware } = require("./middleware");

const authRoutes = require("./auth");
const meRoutes = require("./me");
const leaguesRoutes = require("./leagues");
const sportsRoutes = require("./sports");
const citiesRoutes = require("./cities");
const adminRoutes = require("./admin");
const mailerRoutes = require("./mailer");
const healthRoutes = require("./health");
const users = require("./users");
const games = require("./games");
const teamsRoutes = require("./teams");
const matchesRoutes = require("./matches");
const messagesRoutes = require("./messages");
const profileRoutes = require("./profile");

function registerRoutes(app, ctx) {
  const { ensureTables } = createMiddleware(ctx);
  // einmalig nötige Tabellen anlegen
  ensureTables().catch(() => {});

  // API Router - mount under /api prefix
  const apiRouter = express.Router();

  // Router anhängen an apiRouter statt app
  apiRouter.use(authRoutes(ctx));
  apiRouter.use("/auth", authRoutes(ctx));
  apiRouter.use("/me", meRoutes(ctx));
  apiRouter.use("/leagues", leaguesRoutes(ctx));
  apiRouter.use("/sports", sportsRoutes(ctx));
  apiRouter.use(citiesRoutes(ctx));
  apiRouter.use(profileRoutes(ctx));
  apiRouter.use("/admin", adminRoutes(ctx));
  // Mount mailer under explicit prefix so endpoints are /api/mailer/*
  apiRouter.use("/mailer", mailerRoutes(ctx));
  apiRouter.use(healthRoutes(ctx));
  apiRouter.use(users(ctx));
  apiRouter.use(games(ctx));
  apiRouter.use('/teams', teamsRoutes(ctx));
  apiRouter.use('/matches', matchesRoutes(ctx));
  apiRouter.use(messagesRoutes(ctx));

  // Mount all API routes under /api
  app.use("/api", apiRouter);

  // --- Email status + test routes ---
  app.get("/admin/email-status", async (req, res) => {
    const t = ctx.transporter;
    const state = ctx.mailerState || {};
    res.json({
      connected: !!t && !!state.verified,
      verified: !!state.verified,
      enabled: !!state.enabled,
      host: t?.options?.host || null,
      port: t?.options?.port || null,
      secure: !!t?.options?.secure,
      lastError: state.lastError || null,
      lastVerifyAt: state.lastVerifyAt || null,
    });
  });

  app.post("/admin/test-email", async (req, res) => {
    try {
      const t = ctx.transporter;
      if (!t) return res.status(503).json({ error: "Mailer not configured" });

      const to = (req.body && req.body.to) || t.options?.auth?.user;
      await ctx.sendMail(
        to,
        "MatchLeague – Test-E-Mail",
        "<p>Dies ist eine <b>Test-E-Mail</b> vom Admin-Panel.</p>"
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message || "Send failed" });
    }
  });

  // --- Admin: delete record by id from selected table ---
  app.delete("/admin/table/:table/:id", (req, res) => {
    const table = String(req.params.table || "");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    // Validate table from schema to avoid SQL injection
    const schema = ctx.getDbSchema ? ctx.getDbSchema() : null;
    const allowed =
      schema &&
      Array.isArray(schema.tables) &&
      schema.tables.some(t => t.name === table && Array.isArray(t.columns) && t.columns.some(c => c.name === "id"));

    if (!allowed) return res.status(400).json({ error: "Invalid table" });

    ctx.db.run(`DELETE FROM ${table} WHERE id = ?`, [id], function (err) {
      if (err) return res.status(500).json({ error: "Delete failed" });
      if (this.changes === 0) return res.status(404).json({ error: "Not found" });
      return res.json({ success: true, deleted: this.changes, id });
    });
  });
}

module.exports = { registerRoutes };
