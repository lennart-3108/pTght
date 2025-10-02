const express = require("express");

module.exports = function healthRoutes(ctx = {}) {
  const router = express.Router();
  const { db, transporter, mailerState } = ctx;

  function respondHealth(res) {
    const base = {
      ok: true,
      uptime: Math.floor(process.uptime()),
      mailer: { enabled: !!mailerState?.enabled, hasTransporter: !!transporter },
    };

    if (db?.get) {
      db.get("SELECT 1 AS one", [], (err) => {
        return res.json({
          ...base,
          db: err ? { ok: false, error: err.message } : { ok: true },
        });
      });
    } else {
      res.json(base);
    }
  }

  // Root returns health (legacy)
  router.get("/", (_req, res) => respondHealth(res));
  // Add explicit aliases commonly probed by LB/monitoring
  router.get("/health", (_req, res) => respondHealth(res));
  router.get("/healthz", (_req, res) => respondHealth(res));

  return router;
};
