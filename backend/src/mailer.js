const nodemailer = require("nodemailer");

function createMailer(cfg) {
  const state = {
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

  if (!cfg.user || !cfg.pass) {
    console.warn("Mailtrap-Credentials fehlen (MAILTRAP_USER/MAILTRAP_PASS). E-Mail-Versand wird übersprungen.");
    return { transporter: null, state };
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
  return { transporter, state };
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

    transporter.sendMail(
      {
        from: "test@example.com",
        to: "test@example.com",
        subject: "Mailer verified",
        text: `Mailtrap connection accepted at ${new Date().toISOString()}`,
        html: `<p>Mailtrap connection accepted at <b>${new Date().toISOString()}</b></p>`
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

