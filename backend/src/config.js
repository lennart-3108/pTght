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
  // Force all outgoing mail to a fixed recipient (useful for QA/staging)
  // Only use if explicitly set in .env (no default)
  const MAIL_FORCE_TO = process.env.MAIL_FORCE_TO || null;
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

  // Global session epoch for JWTs. All tokens are issued with the current epoch
  // in their payload; middleware must compare token.epoch with this value.
  // Bumping this value effectively invalidates all existing tokens at once.
  const SESSION_EPOCH = Number(process.env.SESSION_EPOCH || 1);

  // Build a flexible CORS origin handler that supports a comma-separated list
  const rawCors = process.env.CORS_ORIGIN || '';
  const defaultDevOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];
  const allowedOrigins = (rawCors
    ? rawCors.split(',').map(s => s.trim()).filter(Boolean)
    : defaultDevOrigins);
  const isDev = (process.env.NODE_ENV !== 'production');
  const corsOrigin = function(origin, callback) {
    // allow non-browser requests (curl, server-to-server) with no Origin header
    if (!origin) return callback(null, true);
    // In dev, allow any localhost/127.0.0.1 origin (any port)
    if (isDev && (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i).test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Don't throw an error - just reject the origin (callback(null, false))
    console.warn(`[CORS] Origin not allowed: ${origin}. Allowed origins:`, allowedOrigins);
    return callback(null, false);
  };

  return {
    JWT_SECRET,
    SESSION_EPOCH,
    // Prefer SQLITE_FILE or SQLITE_DB_PATH so scripts and server share the same DB
    DB_PATH: (function() {
      const p = process.env.SQLITE_FILE || process.env.SQLITE_DB_PATH || process.env.DB_PATH || "sportplattform.db";
      return path.resolve(__dirname, "..", p);
    })(),
    cors: {
      origin: corsOrigin,  // supports multiple origins, defaults to localhost:3000 and :3001 for dev
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    },
    mailer: {
      host: MAIL_HOST,
      port: MAIL_PORT,
      user: MAIL_USER,
      pass: MAIL_PASS,
      secure: MAIL_SECURE,
      debug: MAIL_DEBUG,
      forceTo: MAIL_FORCE_TO || null,
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
