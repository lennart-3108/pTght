const nodemailer = require("nodemailer");

function createMailer(cfg) {
  const state = {
    enabled: true, // Set to true to enable email sending
    configured: false,
    verified: false,
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    userSet: !!cfg.user,
    passSet: !!cfg.pass,
    lastError: null,
    lastVerifyAt: null,
    lastSendAt: null,
    lastSendId: null,
  };

  const forwardTo = cfg.forwardTo || "info@matchleague.org"; // forwarding target

  if (!cfg.user || !cfg.pass) {
    console.warn("Mail-Credentials fehlen. E-Mail-Versand wird übersprungen.");
    return { transporter: null, state, sendMail: async () => {} };
  }

  // Hinweis: Konfiguriert für UDAG-Server (SMTP) in Prod; Mailtrap als Dev-Fallback
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    auth: { user: cfg.user, pass: cfg.pass },
    secure: cfg.secure,
    requireTLS: !cfg.secure,
    tls: { rejectUnauthorized: false },
    logger: cfg.debug,
    debug: cfg.debug,
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  });
  console.log(`[Mailer] Transport konfiguriert ${cfg.host}:${cfg.port} secure=${cfg.secure ? "true" : "false"}`);
  state.configured = true;

  const sendMail = async (to, subject, html) => {
    if (!state.enabled) {
      console.log("Mailer nicht aktiviert, E-Mail nicht versendet an:", to);
      return;
    }
    try {
      const fromAddr = cfg.user;
      const plain = (html || "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const msgId = `${Date.now()}-${Math.random().toString(16).slice(2)}@matchleague.org`;

      const info = await transporter.sendMail({
        from: `"MatchLeague" <${fromAddr}>`,
        to,
        subject,
        html,
        text: plain || subject || "MatchLeague Nachricht",
        replyTo: fromAddr,
        messageId: msgId,
        headers: {
          "X-Mailer": "MatchLeague",
          "Auto-Submitted": "auto-generated"
        },
        envelope: { from: fromAddr, to }
      });
      console.log("📧 E-Mail gesendet:", info.messageId);

      // 2) Kopie an info@matchleague.org mit Prefix im Betreff
      const copySubject = `sent-email_${subject || ""}`;
      const copyHtml = `<p>Forwarded copy (original to: ${Array.isArray(to) ? to.join(", ") : to})</p><hr/>${html || ""}`;
      await transporter.sendMail({
        from: `"MatchLeague" <${fromAddr}>`,
        to: forwardTo,
        subject: copySubject,
        html: copyHtml,
        text: (copyHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        replyTo: fromAddr,
        messageId: `${Date.now()}-${Math.random().toString(16).slice(2)}@matchleague.org`,
        headers: {
          "X-Mailer": "MatchLeague",
          "Auto-Submitted": "auto-generated"
        },
        envelope: { from: fromAddr, to: forwardTo }
      });
    } catch (error) {
      console.error("E-Mail-Versand fehlgeschlagen an:", to, "Fehler:", error.message);
    }
  };

  return { transporter, state, sendMail };
}

function verifyAndSendAcceptance(transporter, state) {
  if (!transporter) return;
  console.log("[Mailer] Verifiziere SMTP-Verbindung ...");
  const started = Date.now();
  const timer = setTimeout(() => {
    state.verified = false;
    state.lastError = "verify timeout (keine Antwort innerhalb 15s)";
    state.lastVerifyAt = new Date().toISOString();
    console.error("[Mailer] Verify scheint zu hängen (Timeout). Prüfe Netzwerk/Firewall/VPN.");
  }, 15000);

  transporter.verify((err) => {
    clearTimeout(timer);
    state.lastVerifyAt = new Date().toISOString();
    if (err) {
      state.verified = false;
      state.lastError = err?.message || String(err);
      console.error("Mailer Verify Fehler:", err?.message || err, err?.response || "");
      return;
    }
    state.verified = true;
    state.lastError = null;
    console.log(`[Mailer] Verify OK in ${Date.now() - started}ms. Sende Acceptance-Mail ...`);

    const fromAddr = transporter?.options?.auth?.user;
    const to = fromAddr;
    transporter.sendMail(
      {
        from: `"MatchLeague" <${fromAddr}>`,
        to,
        subject: "Mailer verified",
        text: `SMTP connection accepted at ${new Date().toISOString()}`,
        html: `<p>SMTP connection accepted at <b>${new Date().toISOString()}</b></p>`,
        envelope: { from: fromAddr, to }
      },
      (sendErr, info) => {
        if (sendErr) {
          state.lastError = sendErr?.message || String(sendErr);
          console.error("Acceptance-Mail Fehler:", sendErr?.message || sendErr, sendErr?.response || "");
        } else {
          state.lastSendAt = new Date().toISOString();
          state.lastSendId = info?.messageId || null;
          console.log(`📧 Acceptance-Mail gesendet: ${info?.messageId || "(ohne ID)"}`);
        }
      }
    );
  });
}

module.exports = { createMailer, verifyAndSendAcceptance };

