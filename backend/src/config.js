const path = require("path");

function loadConfig() {
  const MAIL_HOST = process.env.MAIL_HOST || "smtps.udag.de";  // Neu: UDAG SMTP
  const MAIL_PORT = Number(process.env.MAIL_PORT || 465);  // Neu: UDAG Port (465 für SSL/TLS)
  const MAIL_SECURE = process.env.MAIL_SECURE !== "false";  // Neu: Standard true für SSL/TLS
  const MAIL_USER = process.env.MAIL_USER;  // Neu: UDAG-Benutzername (z.B. info@matchleague.org)
  const MAIL_PASS = process.env.MAIL_PASS;  // Neu: UDAG-Passwort
  const MAIL_DEBUG = process.env.MAIL_DEBUG === "1";

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
      debug: MAIL_DEBUG
    }
  };
}

module.exports = { loadConfig };
