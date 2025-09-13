const express = require("express");

module.exports = function mailerRoutes(ctx) {
  const router = express.Router();
  const { transporter, mailerState } = ctx || {};

  // Health check
  router.get("/health", (req, res) => {
    res.json({
      enabled: !!mailerState?.enabled,
      hasTransporter: !!transporter
    });
  });

  // Optional: send a test email (POST /mailer/send-test { to })
  router.post("/send-test", (req, res) => {
    if (!(mailerState?.enabled && transporter)) {
      return res.status(503).json({ error: "Mailer disabled or not configured" });
    }
    const to = req.body?.to;
    if (!to) return res.status(400).json({ error: "Empfängeradresse 'to' fehlt" });

    transporter.sendMail(
      {
        from: process.env.MAIL_FROM || "no-reply@example.com",
        to,
        subject: "Testmail",
        text: "Dies ist eine Testmail.",
      },
      (err, info) => {
        if (err) return res.status(500).json({ error: "E-Mail-Versand fehlgeschlagen" });
        res.json({ message: "Testmail gesendet", id: info?.messageId });
      }
    );
  });

  return router;
};
