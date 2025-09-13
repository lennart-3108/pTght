const path = require("path");

function loadConfig() {
  const MAILTRAP_HOST = process.env.MAILTRAP_HOST || "sandbox.smtp.mailtrap.io";
  const MAILTRAP_PORT = Number(process.env.MAILTRAP_PORT || 2525);
  const MAILTRAP_SECURE = process.env.MAILTRAP_SECURE === "1" || MAILTRAP_PORT === 465;
  const MAIL_DEBUG = process.env.MAIL_DEBUG === "1";

  const JWT_SECRET = process.env.JWT_SECRET || "geheimes_schluesselwort";
  if (!process.env.JWT_SECRET) {
    console.warn("WARN: JWT_SECRET not set; using default (dev only).");
  }

  return {
    JWT_SECRET,
    DB_PATH: path.resolve(__dirname, "..", process.env.DB_PATH || "sportplattform.db"),
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true
    },
    mailer: {
      host: MAILTRAP_HOST,
      port: MAILTRAP_PORT,
      user: process.env.MAILTRAP_USER,
      pass: process.env.MAILTRAP_PASS,
      secure: MAILTRAP_SECURE,
      debug: MAIL_DEBUG
    }
  };
}

module.exports = { loadConfig };
