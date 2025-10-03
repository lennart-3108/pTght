const nodemailer = require("nodemailer");
const MailComposer = require("nodemailer/lib/mail-composer");
const { ImapFlow } = require("imapflow");
const fs = require("fs");
const path = require("path");

function createMailer(cfg) {
  // Simple file logger for mail events (appends JSON lines)
  function writeMailLog(entry) {
    try {
      const dir = path.join(__dirname, "..", "logs");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const line = JSON.stringify({ time: new Date().toISOString(), ...entry });
      fs.appendFileSync(path.join(dir, "mail.log"), line + "\n", { encoding: "utf8" });
    } catch (e) {
      // non-fatal
    }
  }

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

  const forwardTo = cfg.forwardTo || "info@dev.matchleague.org"; // forwarding target

  if (!cfg.user || !cfg.pass) {
    const msg = "Mail-Credentials fehlen. E-Mail-Versand wird übersprungen.";
    console.warn(msg);
    writeMailLog({ level: "warn", event: "mailer_disabled", msg });
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
  writeMailLog({ level: "info", event: "transport_configured", host: cfg.host, port: cfg.port, secure: !!cfg.secure });
  state.configured = true;

  const sendMail = async (to, subject, html) => {
    if (!state.enabled) {
      console.log("Mailer nicht aktiviert, E-Mail nicht versendet an:", to);
      writeMailLog({ level: "info", event: "send_skipped", reason: "disabled", to, subject });
      return;
    }
    try {
      const fromAddr = cfg.user;
      const plain = (html || "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const msgId = `${Date.now()}-${Math.random().toString(16).slice(2)}@matchleague.org`;

      const primaryMail = {
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
      };
      const rawPrimary = await new MailComposer(primaryMail).compile().build();
    writeMailLog({ level: "info", event: "send_attempt", to, subject, msgId });
    const info = await transporter.sendMail(primaryMail);
    console.log("📧 E-Mail gesendet:", info.messageId);
    writeMailLog({ level: "info", event: "send_success", to, subject, messageId: info.messageId || null });

      // Option: IMAP-Append in Gesendet/Sent, wenn konfiguriert
      // Erwartete cfg.imap: { host, port, secure, user, pass, mailbox }
      if (cfg.imap && cfg.imap.host && cfg.imap.user && cfg.imap.pass) {
        try {
          const client = new ImapFlow({
            host: cfg.imap.host,
            port: Number(cfg.imap.port || 993),
            secure: cfg.imap.secure !== false,
            auth: { user: cfg.imap.user, pass: cfg.imap.pass },
          });
          await client.connect();

          // Robust: versuche mehrere uebliche Ordnernamen (Hostinger nutzt oft Namespace "INBOX.")
          const wanted = String(cfg.imap.mailbox || 'Sent');
          const candidates = [
            wanted,
            wanted.toLowerCase() === 'sent' ? 'Gesendet' : 'Sent',
            // mit Namespace-Prefix
            `INBOX.${wanted}`,
            'INBOX.Sent',
            'INBOX.Gesendet',
            // weitere haeufige Varianten
            '[Gmail]/Sent Mail',
            'Sent Messages',
            'Sent Items',
          ].filter(Boolean);

          let opened = null;
          for (const name of candidates) {
            try {
              if (typeof name !== 'string' || !name.trim()) continue;
              await client.mailboxOpen(name, { readOnly: false });
              opened = name;
              break;
            } catch (_) {
              // ignore and try next
            }
          }

          if (!opened) {
            throw new Error(`Kein IMAP-Ordner fuer Gesendet gefunden (versucht: ${candidates.join(', ')})`);
          }

          // Rohmail anhängen (komponierte RFC822-Nachricht)
          if (rawPrimary && rawPrimary.length) {
            // Einige Server sind empfindlich bei Flags – wir lassen sie weg (default: ungelesen)
            // und schreiben nur den Roh-Content in den gewählten Ordner.
            try {
              await client.append(opened, rawPrimary);
            } catch (appendErr) {
              console.warn('IMAP-Append (ohne Flags) fehlgeschlagen, versuche Fallback auf expliziten Pfad:', appendErr?.message || appendErr);
              // Fallback: explizit mit Pfad noch einmal probieren
              await client.append(opened || 'INBOX.Sent', rawPrimary);
            }
          }
          await client.logout();
          console.log(`✉️  Kopie im IMAP-Ordner abgelegt (${opened})`);
        } catch (e) {
          console.warn('IMAP-Append fehlgeschlagen:', e && (e.message || e));
          writeMailLog({ level: "warn", event: "imap_append_failed", error: e && (e.message || String(e)) });
        }
      }

      // 2) Optionale Kopie: nur senden, wenn Ziel != Original-Empfänger und definiert
      if (forwardTo && String(forwardTo).toLowerCase() !== String(to).toLowerCase()) {
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
      }
      return info?.messageId || null;
    } catch (error) {
      console.error("E-Mail-Versand fehlgeschlagen an:", to, "Fehler:", error.message);
      writeMailLog({ level: "error", event: "send_failed", to, subject, error: error && (error.stack || error.message || String(error)) });
      throw error;
    }
  };

  return { transporter, state, sendMail };
}

function verifyAndSendAcceptance(transporter, state, sendMailCb) {
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
      writeMailLog({ level: "error", event: "verify_failed", error: err && (err.message || String(err)) });
      return;
    }
    state.verified = true;
    state.lastError = null;
    console.log(`[Mailer] Verify OK in ${Date.now() - started}ms. Sende Acceptance-Mail ...`);
    writeMailLog({ level: "info", event: "verify_ok" });

    const fromAddr = transporter?.options?.auth?.user;
    const to = fromAddr;
    if (typeof sendMailCb === 'function') {
      // Use unified send path (handles IMAP append + forwarding)
      Promise.resolve(sendMailCb(to, "Mailer verified", `<p>SMTP connection accepted at <b>${new Date().toISOString()}</b></p>`))
        .then((id) => {
          state.lastSendAt = new Date().toISOString();
          state.lastSendId = id || null;
          console.log(`📧 Acceptance-Mail gesendet (sendMail): ${id || "(ohne ID)"}`);
          writeMailLog({ level: "info", event: "acceptance_sent", messageId: id || null });
        })
        .catch((sendErr) => {
          state.lastError = sendErr?.message || String(sendErr);
          console.error("Acceptance-Mail Fehler (sendMail):", sendErr?.message || sendErr);
          writeMailLog({ level: "error", event: "acceptance_failed", error: sendErr && (sendErr.message || String(sendErr)) });
        });
    } else {
      // Fallback direct send
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
    }
  });
}

module.exports = { createMailer, verifyAndSendAcceptance };

