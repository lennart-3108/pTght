const express = require("express");

module.exports = function healthRoutes(ctx = {}) {
  const router = express.Router();
  const { db, transporter, mailerState } = ctx;

  router.get("/", (_req, res) => {
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
  });

  return router;
};
