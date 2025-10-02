const path = require("path");

// Load .env from the backend folder during development so developers can
// put MAIL_*, JWT_SECRET, DB_PATH etc. into backend/.env. We use an explicit
// path so loading is local to the backend package.
try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch (e) {
  // If dotenv isn't available for some reason, continue without failing.
}

function loadConfig() {
  const MAIL_HOST = process.env.MAIL_HOST || "smtps.udag.de";  // Neu: UDAG SMTP
  const MAIL_PORT = Number(process.env.MAIL_PORT || 465);  // Neu: UDAG Port (465 für SSL/TLS)
  const MAIL_SECURE = process.env.MAIL_SECURE !== "false";  // Neu: Standard true für SSL/TLS
  const MAIL_USER = process.env.MAIL_USER;  // Neu: UDAG-Benutzername (z.B. info@matchleague.org)
  const MAIL_PASS = process.env.MAIL_PASS;  // Neu: UDAG-Passwort
  const MAIL_DEBUG = process.env.MAIL_DEBUG === "1";
  // Optional forwarding/copy target for sent emails (used by mailer)
  // Prefer explicit FORWARD_TO, then MAIL_FROM, then MAIL_USER; fallback to an org default
  const FORWARD_TO = process.env.FORWARD_TO || process.env.MAIL_FROM || MAIL_USER || "info@matchleague.org";
  // Optional IMAP settings for appending sent mails to "Sent"/"Gesendet" folder
  const IMAP_HOST = process.env.IMAP_HOST || process.env.MAIL_HOST; // often same provider
  const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
  const IMAP_SECURE = process.env.IMAP_SECURE !== "false"; // default true
  const IMAP_USER = process.env.IMAP_USER || MAIL_USER;
  const IMAP_PASS = process.env.IMAP_PASS || process.env.MAIL_PASS;
  const IMAP_MAILBOX = process.env.IMAP_MAILBOX || "Sent"; // could be "Gesendet"

  const JWT_SECRET = process.env.JWT_SECRET || "geheimes_schluesselwort";
  if (!process.env.JWT_SECRET) {
    console.warn("WARN: JWT_SECRET not set; using default (dev only).");
  }

  return {
    JWT_SECRET,
    DB_PATH: path.resolve(__dirname, "..", process.env.DB_PATH || "sportplattform.db"),
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",  // Für Prod: "https://matchleague.org" oder "https://matchleague.de"
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true
    },
    mailer: {
      host: MAIL_HOST,
      port: MAIL_PORT,
      user: MAIL_USER,
      pass: MAIL_PASS,
      secure: MAIL_SECURE,
      debug: MAIL_DEBUG,
      forwardTo: FORWARD_TO,
      imap: (IMAP_HOST && IMAP_USER && IMAP_PASS) ? {
        host: IMAP_HOST,
        port: IMAP_PORT,
        secure: IMAP_SECURE,
        user: IMAP_USER,
        pass: IMAP_PASS,
        mailbox: IMAP_MAILBOX,
      } : null
    }
  };
}

module.exports = { loadConfig };
