const knex = require("knex");
const path = require("path");
const fs = require("fs");

// Resolve DB filename: env > sportsplatform.db (if exists) > database.sqlite
const envFile = process.env.SQLITE_FILE || process.env.DB_FILE;
let filename = envFile || path.join(__dirname, "database.sqlite");
const sportsDb = path.join(__dirname, "sportsplatform.db");
if (!envFile && fs.existsSync(sportsDb)) {
  filename = sportsDb;
}

const db = knex({
  client: "sqlite3",
  connection: {
    filename,
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(__dirname, "migrations"),
    tableName: "knex_migrations",
  },
  pool: {
    afterCreate: (conn, done) => {
      conn.run("PRAGMA foreign_keys = ON", done);
    },
  },
});

// Debug: show which DB file the app uses
const dbFile = (db && db.client && db.client.config && db.client.config.connection && db.client.config.connection.filename) || "<memory>";
console.log("[DB] SQLite file:", dbFile);
console.log("[DB] Migrations dir:", path.join(__dirname, "migrations"));

module.exports = db;

exports.up = async function (knex) {
  await knex.schema.createTable("teams", (t) => {
    t.increments("id").primary();
    t.string("name").notNullable().unique();
    t.integer("sport_id").references("id").inTable("sports").onDelete("RESTRICT");
    t.integer("league_id").references("id").inTable("leagues").onDelete("SET NULL");
    t.integer("city_id").references("id").inTable("cities").onDelete("SET NULL");
    t.timestamps(true, true); // created_at, updated_at
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("teams");
};
