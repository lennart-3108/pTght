const path = require("path");
const fs = require("fs");

// Nutze explizit Umgebungsvariablen für die DB-Datei (auch für Migrationen!)
const envFile = process.env.SQLITE_FILE || process.env.DB_FILE;
let filename = envFile || path.join(__dirname, "database.sqlite");
const sportsDb = path.join(__dirname, "sportsplatform.db");
if (!envFile && fs.existsSync(sportsDb)) {
  filename = sportsDb;
}

module.exports = {
  client: "sqlite3",
  connection: { filename },
  useNullAsDefault: true,
  migrations: { directory: path.join(__dirname, "migrations") },
  seeds: { directory: path.join(__dirname, "seeds") },
};
