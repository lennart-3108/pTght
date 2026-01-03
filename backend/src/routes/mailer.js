const express = require("express");
const { renderEmailTemplate } = require("../emailTemplate");

module.exports = function mailerRoutes(ctx) {
  const router = express.Router();
  const { transporter, mailerState, sendMail } = ctx || {};

  // Health check
  router.get("/health", (req, res) => {
    res.json({
      enabled: !!mailerState?.enabled,
      hasTransporter: !!transporter
    });
  });

  // Optional: send a test email (POST /mailer/send-test { to })
  router.post("/send-test", async (req, res) => {
    try {
      if (!(mailerState?.enabled && transporter && typeof sendMail === 'function')) {
        return res.status(503).json({ error: "Mailer disabled or not configured" });
      }
      const to = req.body?.to;
      if (!to) return res.status(400).json({ error: "Empfängeradresse 'to' fehlt" });

      const subject = "MatchLeague – Testmail";
      const html = renderEmailTemplate({
        title: "Testmail",
        body: "<p>Dies ist eine <b>Testmail</b> von MatchLeague.</p>",
        previewText: "Testmail von MatchLeague",
      });
      const id = await sendMail(to, subject, html);
      return res.json({ message: "Testmail gesendet", id: id || null });
    } catch (e) {
      return res.status(500).json({ error: "E-Mail-Versand fehlgeschlagen", detail: e?.message || String(e) });
    }
  });

  return router;
};
