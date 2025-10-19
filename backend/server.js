const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { isAuthenticated } = require("./middleware/auth");

// Ensure all DB layers point to the same SQLite file.
// Prefer env SQLITE_FILE; if not set, use common fallback filenames if present.
if (!process.env.SQLITE_FILE && !process.env.DB_FILE) {
  const sportsDb1 = path.join(__dirname, "sportsplatform.db"); // English spelling
  const sportsDb2 = path.join(__dirname, "sportplattform.db"); // German spelling
  if (fs.existsSync(sportsDb1)) {
    process.env.SQLITE_FILE = sportsDb1;
    console.log("[DB] SQLITE_FILE not set; using sportsplatform.db");
  } else if (fs.existsSync(sportsDb2)) {
    process.env.SQLITE_FILE = sportsDb2;
    console.log("[DB] SQLITE_FILE not set; using sportplattform.db");
  }
}

const { loadConfig } = require("./src/config");
const { initDb, getDbSchema, schemaToHtml, createIncrementalAdmin } = require("./src/db");
const { createMailer, verifyAndSendAcceptance } = require("./src/mailer");
const { registerRoutes } = require("./src/routes/index");

const app = express();
const cfg = loadConfig();
// Aktiviert korrekte IP/Proto-Erkennung hinter Caddy/Reverse Proxy
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 5001;

app.use(cors(cfg.cors));
app.options("*", cors());
// Increase body limits to allow base64 image uploads (avatars)
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
// Serve uploaded files (avatars, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Healthcheck für Caddy/Monitoring
app.get("/healthz", (req, res) => res.json({ ok: true }));

// simple file logger (appends)
function ensureLogsDir() {
  const dir = path.join(__dirname, "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function logToFile(filename, msg) {
  try {
    const dir = ensureLogsDir();
    fs.appendFileSync(path.join(dir, filename), msg + "\n", { encoding: "utf8" });
  } catch (e) {
    console.error("Failed to write log file:", e && e.message);
  }
}
function formatNow() {
  return new Date().toISOString();
}
// Log-Level Steuerung
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const levelRank = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const canLog = (lvl) => (levelRank[lvl] <= (levelRank[LOG_LEVEL] || 3));

// Error logging (for uncaught exceptions, promise rejections, etc.)
function logError(err, meta = {}) {
  const entry = {
    time: formatNow(),
    message: (err && (err.stack || err.message)) || String(err),
    meta,
  };
  console.error("[ERROR]", entry.time, entry.message, meta || "");
  logToFile("error.log", JSON.stringify(entry));
}

// Informational logging (e.g. startup, config, etc.)
function logInfo(msg, meta = {}) {
  const entry = { time: formatNow(), msg, meta };
  if (canLog('info')) console.log("[INFO]", entry.time, entry.msg, meta || "");
  logToFile("info.log", JSON.stringify(entry));
}

// Debug-level logging (detailed internal state, request/response, etc.)
function logDebug(msg, meta = {}) {
  if (canLog('debug')) console.log("[DEBUG]", formatNow(), msg, meta || "");
}

// --- Database and Mailer setup ---
const { createDb } = require("./src/db/adapter");
const db = createDb();
// If we're using the sqlite adapter, ensure base tables exist on startup
try {
  if (db && (db.__driver === 'sqlite' || (db.constructor && db.constructor.name === 'Database'))) {
    const setupTables = require("./db-setup");
    setupTables(db);
    logInfo("[DB] SQLite detected – ensured base tables via db-setup.js");
  }
} catch (e) {
  console.warn("[DB] setupTables failed or unavailable:", e && (e.message || e));
}

// additionally: direct Knex instance (legacy)
// const knexDirect = require("./db");
// try to load knexfile-based config (may point to a different sqlite file like mydb.sqlite)
let knexDirect = null;
if (db && db.knex && db.knex.client) {
  knexDirect = db.knex;
  if (canLog('debug')) console.log("[DB] Using adapter knex instance as primary");
} else {
  try {
    knexDirect = require("./db");
    if (canLog('debug')) console.log("[DB] Adapter knex not available, using ./db fallback");
  } catch (e) {
    knexDirect = null;
    console.warn("[DB] No knex instance available from adapter or ./db");
  }
}
// try to load knexfile-based config (may point to a different sqlite file like mydb.sqlite)
let knexFileInstance = null;
try {
  const makeKnex = require("knex");
  const knexCfg = (() => {
    try { return require("./knexfile"); } catch (e) { return null; }
  })();
  if (knexCfg && !knexFileInstance) {
    // instantiate a separate knex only if a config exists
    knexFileInstance = makeKnex(knexCfg);
    const kfFile = (knexFileInstance && knexFileInstance.client && knexFileInstance.client.config && knexFileInstance.client.config.connection && knexFileInstance.client.config.connection.filename) || null;
    if (canLog('debug')) console.log("[DB] knexfile instance created, filename:", kfFile);
  }
} catch (e) {
  // ignore if knex not available
}

// Ensure critical tables exist on the primary Knex connection as well
(async () => {
  try {
    const k = (db && db.knex && db.knex.client) ? db.knex : knexDirect;
    if (!k || !k.schema) return;

    // matches
    if (!(await k.schema.hasTable("matches"))) {
      await k.schema.createTable("matches", (t) => {
        t.increments("id").primary();
        t.integer("league_id").notNullable();
        t.text("kickoff_at");
        // Optional: human readable place/venue
        t.text("location");
        t.text("status");
        t.integer("home_user_id");
        t.integer("away_user_id");
        t.integer("home_team_id");
        t.integer("away_team_id");
        t.integer("home_score");
        t.integer("away_score");
        t.text("created_at").defaultTo(k.raw("CURRENT_TIMESTAMP"));
      });
      logInfo("[DB] Created table matches via Knex");
    }
    // If table exists ensure new optional columns
    else {
      try {
        const info = await k("matches").columnInfo().catch(() => ({}));
        if (!Object.prototype.hasOwnProperty.call(info, "location")) {
          await k.schema.alterTable("matches", (t) => { t.text("location"); });
          logInfo("[DB] Added column matches.location");
        }
      } catch (e) {
        console.warn("[DB] ensure matches optional columns failed:", e && (e.message || e));
      }
    }

    // teams
    if (!(await k.schema.hasTable("teams"))) {
      await k.schema.createTable("teams", (t) => {
        t.increments("id").primary();
        t.string("name").notNullable();
        t.integer("league_id").notNullable();
        t.integer("sport_id");
        t.integer("city_id");
        t.integer("captain_user_id");
      });
      logInfo("[DB] Created table teams via Knex");
    }

    // team_members
    if (!(await k.schema.hasTable("team_members"))) {
      await k.schema.createTable("team_members", (t) => {
        t.integer("team_id").notNullable();
        t.integer("user_id").notNullable();
        t.boolean("is_captain").defaultTo(false);
        t.primary(["team_id", "user_id"]);
      });
      logInfo("[DB] Created table team_members via Knex");
    }

    // team_match_rosters
    if (!(await k.schema.hasTable("team_match_rosters"))) {
      await k.schema.createTable("team_match_rosters", (t) => {
        t.increments("id").primary();
        t.integer("team_id").notNullable();
        t.integer("match_id").notNullable();
        t.integer("created_by");
        t.text("created_at").defaultTo(k.raw("CURRENT_TIMESTAMP"));
      });
      logInfo("[DB] Created table team_match_rosters via Knex");
    }

    // team_roster_players
    if (!(await k.schema.hasTable("team_roster_players"))) {
      await k.schema.createTable("team_roster_players", (t) => {
        t.increments("id").primary();
        t.integer("roster_id").notNullable();
        t.integer("user_id").notNullable();
        t.string("role").defaultTo("sub");
        t.string("shirt_number");
      });
      logInfo("[DB] Created table team_roster_players via Knex");
    }

    // direct_chats (between two users)
    if (!(await k.schema.hasTable("direct_chats"))) {
      await k.schema.createTable("direct_chats", (t) => {
        t.increments("id").primary();
        t.integer("user1_id").notNullable();
        t.integer("user2_id").notNullable();
        t.text("created_at").defaultTo(k.raw("CURRENT_TIMESTAMP"));
        t.unique(["user1_id", "user2_id"]);
        // Optional columns for read tracking
        t.text("user1_last_read_at");
        t.text("user2_last_read_at");
      });
      logInfo("[DB] Created table direct_chats via Knex");
    }
    // If table exists, add missing read-tracking columns
    else {
      try {
        const info = await k("direct_chats").columnInfo().catch(() => ({}));
        if (!Object.prototype.hasOwnProperty.call(info, "user1_last_read_at")) {
          await k.schema.alterTable("direct_chats", (t) => { t.text("user1_last_read_at"); });
          logInfo("[DB] Added column direct_chats.user1_last_read_at");
        }
        if (!Object.prototype.hasOwnProperty.call(info, "user2_last_read_at")) {
          await k.schema.alterTable("direct_chats", (t) => { t.text("user2_last_read_at"); });
          logInfo("[DB] Added column direct_chats.user2_last_read_at");
        }
      } catch (e) {
        console.warn("[DB] direct_chats alter add last_read columns failed:", e && (e.message || e));
      }
    }

    // direct_messages
    if (!(await k.schema.hasTable("direct_messages"))) {
      await k.schema.createTable("direct_messages", (t) => {
        t.increments("id").primary();
        t.integer("chat_id").notNullable();
        t.integer("sender_id").notNullable();
        t.text("body").notNullable();
        t.text("created_at").defaultTo(k.raw("CURRENT_TIMESTAMP"));
        t.index(["chat_id", "created_at"], "dm_chat_created_idx");
      });
      logInfo("[DB] Created table direct_messages via Knex");
    }

    // match_message_reads – per user, per match last read timestamp
    if (!(await k.schema.hasTable("match_message_reads"))) {
      await k.schema.createTable("match_message_reads", (t) => {
        t.integer("match_id").notNullable();
        t.integer("user_id").notNullable();
        t.text("last_read_at");
        t.primary(["match_id", "user_id"]);
      });
      logInfo("[DB] Created table match_message_reads via Knex");
    }

    // Ensure user profile columns exist (open_for_matches, favorite_sports)
    try {
      const hasUsers = await k.schema.hasTable('users').catch(() => false);
      if (hasUsers) {
        const uinfo = await k('users').columnInfo().catch(() => ({}));
        if (!Object.prototype.hasOwnProperty.call(uinfo, 'open_for_matches')) {
          await k.schema.alterTable('users', (t) => t.boolean('open_for_matches').defaultTo(false));
          logInfo('[DB] Added column users.open_for_matches');
        }
        if (!Object.prototype.hasOwnProperty.call(uinfo, 'favorite_sports')) {
          await k.schema.alterTable('users', (t) => t.text('favorite_sports'));
          logInfo('[DB] Added column users.favorite_sports');
        }
      }
    } catch (e) {
      console.warn('[DB] ensure users profile columns failed:', e && (e.message || e));
    }
  } catch (e) {
    console.warn("[DB] ensureKnexTables failed:", e && (e.message || e));
  }
})();

// Community-Ligen
const { ensureCommunityLeagues } = require("./src/jobs/ensureCommunityLeagues");
const { autoPairCommunity } = require("./src/jobs/autoPairCommunity");
const { ensureSeasons } = require("./src/jobs/ensureSeasons");

// Mailer
const { transporter, state: mailerState, sendMail } = createMailer(cfg.mailer);
// verify nur optional, um SMTP-Logs beim Start zu vermeiden
if (process.env.MAILER_VERIFY === '1') {
  verifyAndSendAcceptance(transporter, mailerState, sendMail);
} else {
  logDebug("Mailer verify disabled (set MAILER_VERIFY=1 to enable).");
}

// Shared context (kept small and explicit)
const lastStartupAdmin = { value: null };
const ctx = {
  db,
  SECRET: cfg.JWT_SECRET,
  transporter,
  mailerState,
  sendMail,
  getDbSchema: () => getDbSchema(db),
  schemaToHtml,
  lastStartupAdmin
};

// ephemeral one-time auth token store (in-memory). Keys: token -> { userId, expiresAt }
// NOTE: in production you may want a persistent/cluster-safe store (Redis) instead.
ctx.oneTimeAuthTokens = new Map();

// Resend confirmation cooldown tracker (in-memory). Keys: email -> timestamp(ms)
// Configurable via RESEND_COOLDOWN_SECONDS env (defaults to 300 = 5 minutes)
ctx.resendCooldowns = new Map();
ctx.resendCooldownSeconds = Number(process.env.RESEND_COOLDOWN_SECONDS) || 300;

// expose ctx to express routes via app.locals so handlers can read/write one-time tokens
app.locals.ctx = ctx;
// also expose on global for scripts/tests that might not have access to app instance
global._app_ctx = ctx;

// Periodic cleanup for expired one-time tokens (runs every 60s)
setInterval(() => {
  try {
    const now = Date.now();
    const store = ctx.oneTimeAuthTokens;
    const removed = [];
    for (const [k, v] of store.entries()) {
      if (!v || (v.expiresAt && v.expiresAt < now)) {
        store.delete(k);
        removed.push(k);
      }
    }
    if (removed.length && canLog('debug')) console.log(`[oneTimeCleanup] removed ${removed.length} expired tokens`);
  } catch (e) {
    console.error('[oneTimeCleanup] error', e && (e.stack || e.message || e));
  }
}, 60 * 1000);

// cleanup resend cooldown entries alongside one-time tokens
setInterval(() => {
  try {
    const now = Date.now();
    const cooldowns = ctx.resendCooldowns;
    const ttl = (ctx.resendCooldownSeconds || 300) * 1000;
    const removed = [];
    for (const [email, ts] of cooldowns.entries()) {
      if (!ts || (now - ts) > ttl) {
        cooldowns.delete(email);
        removed.push(email);
      }
    }
    if (removed.length && canLog('debug')) console.log(`[resendCooldownCleanup] removed ${removed.length} expired cooldown entries`);
  } catch (e) {
    console.error('[resendCooldownCleanup] error', e && (e.stack || e.message || e));
  }
}, 60 * 1000);

// Create a startup test user (developer convenience) and expose banner info
try {
  const { createStartupTestUser } = require("./src/db");
  if (typeof createStartupTestUser === 'function') {
    createStartupTestUser(db, (info) => {
      lastStartupAdmin.value = info;
    });
  } else {
    // fallback to legacy admin creation
    createIncrementalAdmin(db, (info) => { lastStartupAdmin.value = info; });
  }
} catch (e) {
  // if the new helper is not present for any reason, keep legacy behavior
  createIncrementalAdmin(db, (info) => { lastStartupAdmin.value = info; });
}

// Verwende für den Job die direkte Knex-Instanz
// ensureCommunityLeagues(knexDirect, () => console.log("Community-Ligen synchronisiert."));
// setInterval(() => ensureCommunityLeagues(knexDirect, () => {}), 60 * 1000); // alle 60s prüfen
// Use the same primary knex instance for background jobs (prefer adapter)
const jobKnex = (db && db.knex && db.knex.client) ? db.knex : knexDirect;
// optional verbose job logger
const jobLog = (process.env.JOBS_VERBOSE === '1') ? (...a) => console.log(...a) : () => {};
if (jobKnex) {
  ensureCommunityLeagues(jobKnex, () => jobLog("Community-Ligen synchronisiert."));
  setInterval(() => ensureCommunityLeagues(jobKnex, () => jobLog("Community-Ligen synchronisiert.")), 60 * 1000); // alle 60s prüfen
  // Auto-pair community leagues every 5 minutes
  autoPairCommunity(jobKnex, (...a) => jobLog(...a));
  setInterval(() => autoPairCommunity(jobKnex, (...a) => jobLog(...a)), 5 * 60 * 1000);
  // Ensure seasons for all leagues at startup and every day
  ensureSeasons(jobKnex, (...a) => jobLog(...a));
  setInterval(() => ensureSeasons(jobKnex, (...a) => jobLog(...a)), 24 * 60 * 60 * 1000);
} else {
  console.warn("[ensureCommunityLeagues] no knex available for job");
}

// --- Immediate reliable /leagues endpoint using available knex instances ---
// Returns the union of rows from the direct knex (knexDirect), adapter knex (db.knex),
// and optional knexfile instance, deduplicated by id. Prefers adapter (the one used by Admin).
app.get("/leagues", async (req, res) => {
  try {
    // gather available knex instances (adapter preferred)
    const kAdapter = (db && db.knex && db.knex.client) ? db.knex : null;   // prefer this (admin uses adapter)
    const kDirect = (knexDirect && knexDirect.client) ? knexDirect : null;
    const kKnexfile = (knexFileInstance && knexFileInstance.client) ? knexFileInstance : null;

    if (!kAdapter && !kDirect && !kKnexfile) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

    // helper to read leagues from one knex instance safely
    async function readFrom(knexInstance) {
      try {
        const dbFile = (knexInstance && knexInstance.client && knexInstance.client.config && knexInstance.client.config.connection && knexInstance.client.config.connection.filename) || null;

        // 1) Prüfe zuerst, ob die Tabelle 'leagues' überhaupt existiert. Wenn nein: Quelle überspringen.
        const hasLeagues = await knexInstance.schema.hasTable("leagues").catch(() => false);
        if (!hasLeagues) {
          return { rows: [], dbFile, skippedReason: "no leagues table" };
        }

        const info = await knexInstance("leagues").columnInfo().catch(() => ({}));
        const hasLeagueCityCol = Object.prototype.hasOwnProperty.call(info, "city");
        const hasLeagueSportCol = Object.prototype.hasOwnProperty.call(info, "sport");

        const rows = await knexInstance("leagues as l")
          .leftJoin("cities as c", "l.city_id", "c.id")
          .leftJoin("sports as s", "l.sport_id", "s.id")
          .select(
            "l.id",
            { cityId: "l.city_id" },
            (hasLeagueCityCol ? knexInstance.raw("COALESCE(c.name, l.city, '') as city") : knexInstance.raw("COALESCE(c.name, '') as city")),
            { sportId: "l.sport_id" },
            (hasLeagueSportCol ? knexInstance.raw("COALESCE(s.name, l.sport, '') as sport") : knexInstance.raw("COALESCE(s.name, '') as sport")),
            "l.name"
          )
          .orderBy("l.id", "asc");

        return { rows: Array.isArray(rows) ? rows : [], dbFile };
      } catch (e) {
        return { rows: [], dbFile: null, error: e };
      }
    }

    // If adapter is available, try it first (admin UI uses adapter; prefer its data)
    if (kAdapter) {
      const adapterRes = await readFrom(kAdapter);
      if (!adapterRes.error && Array.isArray(adapterRes.rows) && adapterRes.rows.length > 0) {
        logDebug(`[GET /leagues] using adapter dbFile=${adapterRes.dbFile || "<unknown>"} rows=${adapterRes.rows.length}`);
        return res.json(adapterRes.rows);
      }
      if (adapterRes.error) {
        console.warn("[GET /leagues] adapter read error:", adapterRes.error && (adapterRes.error.stack || adapterRes.error.message || adapterRes.error));
      } else {
        logDebug("[GET /leagues] adapter returned 0 rows, falling back to other sources");
      }
    }

    // read from all available instances (kDirect, kAdapter (again if not returned), kKnexfile)
    const sources = [];
    if (kDirect) sources.push(readFrom(kDirect));
    // include adapter if not already used above
    if (kAdapter) sources.push(readFrom(kAdapter));
    if (kKnexfile && kKnexfile !== kDirect && kKnexfile !== kAdapter) sources.push(readFrom(kKnexfile));

    const results = await Promise.all(sources);

    // log brief info for debugging (will appear in server console)
    results.forEach((r, idx) => {
      if (r && r.skippedReason) {
        logDebug(`[GET /leagues] source[${idx}] dbFile=${r.dbFile || "<unknown>"} skipped: ${r.skippedReason}`);
      } else if (r && r.error) {
        console.warn(`[GET /leagues] source[${idx}] read error:`, r.error && (r.error.stack || r.error.message || r.error));
      } else {
        logDebug(`[GET /leagues] source[${idx}] dbFile=${r.dbFile || "<unknown>"} rows=${(r.rows || []).length}`);
      }
    });

    // merge and deduplicate by id (prefer earlier sources)
    const mergedMap = new Map();
    for (const r of results) {
      for (const row of r.rows || []) {
        const key = String(row.id);
        if (!mergedMap.has(key)) mergedMap.set(key, row);
      }
    }

    const merged = Array.from(mergedMap.values()).sort((a, b) => Number(a.id) - Number(b.id));

    // Debug info if counts differ from what admin shows
    //logDebug(`[GET /leagues] returning merged rows=${merged.length} (sources=${results.length})`);

    return res.json(merged);
  } catch (e) {
    console.error("GET /leagues (combined) failed:", e && (e.stack || e.message || e));
    return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
  }
});

// --- NEW: Admin helpers to inspect DB sources and optionally merge missing leagues ---
// Note: no auth added here; enable in your setup if needed.
app.get("/admin/db-info", async (req, res) => {
  try {
    const kAdapter = (db && db.knex && db.client) ? db.knex : null;
    const kDirect = (knexDirect && knexDirect.client) ? knexDirect : null;
    const kKnexfile = (knexFileInstance && knexFileInstance.client) ? knexFileInstance : null;
    const sources = [
      { name: "adapter", k: kAdapter },
      { name: "direct", k: kDirect },
      { name: "knexfile", k: kKnexfile },
    ].filter(s => s.k);

    const probe = async (knexInstance) => {
      try {
        const dbFile = (knexInstance && knexInstance.client && knexInstance.client.config && knexInstance.client.config.connection && knexInstance.client.config.connection.filename) || null;
        const info = await knexInstance("sqlite_master").select("name").where("type", "table").catch(() => []);
        const tables = Array.isArray(info) ? info.map(r => r.name || r.NAME).filter(Boolean) : [];
        const counts = {};
        if (tables.includes("leagues")) {
          const r = await knexInstance("leagues").count({ c: "*" }).catch(() => [{ c: 0 }]);
          counts.leagues = Number(Array.isArray(r) ? (r[0].c || 0) : (r.c || 0));
        } else counts.leagues = null;
        if (tables.includes("cities")) {
          const r = await knexInstance("cities").count({ c: "*" }).catch(() => [{ c: 0 }]);
          counts.cities = Number(Array.isArray(r) ? (r[0].c || 0) : (r.c || 0));
        } else counts.cities = null;
        if (tables.includes("sports")) {
          const r = await knexInstance("sports").count({ c: "*" }).catch(() => [{ c: 0 }]);
          counts.sports = Number(Array.isArray(r) ? (r[0].c || 0) : (r.c || 0));
        } else counts.sports = null;
        return { dbFile, tables, counts };
      } catch (e) {
        return { dbFile: null, tables: [], counts: {}, error: (e && (e.stack || e.message)) || String(e) };
      }
    };

    const details = {};
    for (const s of sources) {
      details[s.name] = await probe(s.k);
    }

    return res.json({ sources: Object.keys(details), details });
  } catch (e) {
    console.error("GET /admin/db-info failed:", e && (e.stack || e.message || e));
    return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
  }
});

// Merge missing leagues from secondary sources into adapter DB (safe onConflict)
// POST /admin/merge-leagues
app.post("/admin/merge-leagues", async (req, res) => {
  try {
    const primary = (db && db.knex && db.knex.client) ? db.knex : null;
    if (!primary) return res.status(500).json({ error: "PRIMARY_DB_NOT_AVAILABLE" });

    // collect secondary sources (exclude primary if same instance)
    const kDirect = (knexDirect && knexDirect.client) ? knexDirect : null;
    const kKnexfile = (knexFileInstance && knexFileInstance.client) ? knexFileInstance : null;
    const secondaries = [];
    if (kDirect && kDirect !== primary) secondaries.push(kDirect);
    if (kKnexfile && kKnexfile !== primary && kKnexfile !== kDirect) secondaries.push(kKnexfile);
    if (secondaries.length === 0) return res.json({ merged: 0, note: "No secondary sources available" });

    let merged = 0;
    for (const src of secondaries) {
      // only proceed if src has leagues table
      const tables = await src("sqlite_master").select("name").where("type", "table").catch(() => []);
      const tbls = Array.isArray(tables) ? tables.map(r => r.name || r.NAME) : [];
      if (!tbls.includes("leagues")) continue;

      // read rows from source leagues (select common columns)
      const rows = await src("leagues").select("id", "name", "city_id", "sport_id").catch(() => []);
      for (const r of rows || []) {
        try {
          // insert into primary; ignore if id exists
          await primary("leagues").insert({
            id: r.id,
            name: r.name,
            city_id: r.city_id,
            sport_id: r.sport_id,
          }).onConflict("id").ignore();
          merged++;
        } catch (e) {
          // if structure differs (no city_id/sport_id), try minimal insert
          try {
            await primary("leagues").insert({ id: r.id, name: r.name }).onConflict("id").ignore();
            merged++;
          } catch (e2) {
            // log and skip
            console.warn("[merge-leagues] skipped row", r.id, e2 && e2.message);
          }
        }
      }
    }

    return res.json({ merged, note: "Merged rows (onConflict ignored by id)" });
  } catch (e) {
    console.error("POST /admin/merge-leagues failed:", e && (e.stack || e.message || e));
    return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
  }
});

// --- NEW: Robust GET /me/games (before mounting /me routes) ---
app.get("/me/games", isAuthenticated, async (req, res) => {
  try {
    const k = (knexDirect && knexDirect.client) ? knexDirect : (db && db.knex ? db.knex : null);
    if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

    // Detect table: prefer 'matches', fallback to 'games'
    const table = (await k.schema.hasTable("matches")) ? "matches" : ((await k.schema.hasTable("games")) ? "games" : null);
    if (!table) return res.json({ upcoming: [], completed: [] });

    const info = await k(table).columnInfo().catch(() => ({}));
    const hasHomeUserId = !!info.home_user_id;
    const hasAwayUserId = !!info.away_user_id;
    const hasHomeText = !!info.home;
    const hasAwayText = !!info.away;

    // Wenn keine Home/Away-Spalte existiert, liefere leer zurück (verhindert SQL-Fehler)
    if (!hasHomeUserId && !hasAwayUserId && !hasHomeText && !hasAwayText) {
      return res.json({ upcoming: [], completed: [] });
    }

    // Pick timestamp column available in this table
    const tsCandidates = ["kickoff_at", "kickoff", "scheduled_at", "date", "datetime", "start_time"];
    const tsCol = tsCandidates.find(c => Object.prototype.hasOwnProperty.call(info, c)) || null;
    const tsSelect = tsCol ? k.raw(`g.${tsCol} as kickoff_at`) : k.raw("NULL as kickoff_at");

    // Build dynamic display name expression based on available user columns
    const usersInfo = await k("users").columnInfo().catch(() => ({}));
    const hasFirst = Object.prototype.hasOwnProperty.call(usersInfo, "firstname");
    const hasLast = Object.prototype.hasOwnProperty.call(usersInfo, "lastname");
    const hasName = Object.prototype.hasOwnProperty.call(usersInfo, "name");
    const hasEmail = Object.prototype.hasOwnProperty.call(usersInfo, "email");
    const fullNameExpr = (hasFirst || hasLast)
      ? "NULLIF(TRIM(COALESCE(u.firstname,'') || ' ' || COALESCE(u.lastname,'')), '')"
      : null;
    const nameCoalesce = [
      ...(fullNameExpr ? [fullNameExpr] : []),
      ...(hasName ? ["u.name"] : []),
      ...(hasEmail ? ["u.email"] : []),
    ];
    const displayName = `COALESCE(${nameCoalesce.length ? nameCoalesce.join(", ") : "'User'"})`;

    // Resolve display names for user_id cols if present
    const homeSelect = hasHomeUserId
      ? k.raw(`(SELECT ${displayName} FROM users u WHERE u.id = g.home_user_id) as home`)
      : (hasHomeText ? k.raw("g.home as home") : k.raw("NULL as home"));
    const awaySelect = hasAwayUserId
      ? k.raw(`(SELECT ${displayName} FROM users u WHERE u.id = g.away_user_id) as away`)
      : (hasAwayText ? k.raw("g.away as away") : k.raw("NULL as away"));

    let q = k({ g: table })
      .leftJoin({ l: "leagues" }, "l.id", "g.league_id")
      .leftJoin({ s: "sports" }, "s.id", "l.sport_id")
      .leftJoin({ c: "cities" }, "c.id", "l.city_id")
      .select(
        "g.id",
        tsSelect,
        { leagueId: "g.league_id" },
        { league: "l.name" },
        k.raw("COALESCE(c.name, '') as city"),
        k.raw("COALESCE(s.name, '') as sport"),
        homeSelect,
        awaySelect,
        "g.home_score",
        "g.away_score"
      );

    const userId = req.user.id;
    if (hasHomeUserId || hasAwayUserId) {
      q = q.where(function () {
        if (hasHomeUserId) this.orWhere("g.home_user_id", userId);
        if (hasAwayUserId) this.orWhere("g.away_user_id", userId);
      });
    } else if (hasHomeText || hasAwayText) {
      // Fallback: show games from leagues the user is a member of
      q = q.join({ ul: "user_leagues" }, "ul.league_id", "g.league_id").where("ul.user_id", userId);
    } else {
      // Keine Home/Away-Spalte vorhanden: leere Liste zurück
      return res.json({ upcoming: [], completed: [] });
    }

    if (tsCol) q = q.orderBy(`g.${tsCol}`, "desc");
    else q = q.orderBy("g.id", "desc");

    const rows = await q;
    const now = Date.now();
  const withTs = (rows || []).map(r => ({ ...r, ts: r.kickoff_at ? (Date.parse(r.kickoff_at) || 0) : 0 }));
  // Mutual exclusive buckets:
  // - completed: both scores present
  // - upcoming: no scores yet (regardless of time); treat missing/invalid ts as future-friendly
  const completed = withTs.filter(r => (r.home_score != null && r.away_score != null)).sort((a,b) => (b.ts - a.ts));
  const upcoming = withTs.filter(r => (r.home_score == null && r.away_score == null)).sort((a,b) => (a.ts - b.ts));
  return res.json({ upcoming, completed });
  } catch (e) {
    console.error("GET /me/games failed:", e && (e.stack || e.message || e));
    return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
  }
});

// Create an open friendly match without league
// This mirrors the implementation in src/routes/profile.js, but is mounted
// directly here to avoid any router ordering/caching issues for POST.
app.post('/open-matches', isAuthenticated, async (req, res) => {
  try {
    const k = (knexDirect && knexDirect.client) ? knexDirect : (db && db.knex ? db.knex : null);
    if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
    const hasMatches = await k.schema.hasTable('matches').catch(() => false);
    if (!hasMatches) return res.status(500).json({ error: 'NO_MATCHES_TABLE' });
    const hasLeagues = await k.schema.hasTable('leagues').catch(() => false);
    if (!hasLeagues) return res.status(500).json({ error: 'NO_LEAGUES_TABLE' });

    const sportId = Number(req.body?.sportId) || null;
    const cityId = Number(req.body?.cityId) || null;
    if (!sportId || !cityId) return res.status(400).json({ error: 'sportId and cityId are required' });

    // ensure 'Open Matches' league exists for sport/city
    let leagueId = null;
    const existing = await k('leagues').where({ name: 'Open Matches', sport_id: sportId, city_id: cityId }).first().catch(() => null);
    if (existing && existing.id) leagueId = Number(existing.id);
    else {
      try {
        const insL = await k('leagues').insert({ name: 'Open Matches', sport_id: sportId, city_id: cityId });
        leagueId = Array.isArray(insL) ? insL[0] : insL;
      } catch (e) {
        const retry = await k('leagues').where({ name: 'Open Matches', sport_id: sportId, city_id: cityId }).first().catch(() => null);
        leagueId = retry && retry.id ? Number(retry.id) : null;
      }
    }
    if (!leagueId) return res.status(500).json({ error: 'OPEN_LEAGUE_CREATE_FAILED' });

    const info = await k('matches').columnInfo().catch(() => ({}));

    const rec = {
      league_id: leagueId,
      home_user_id: req.user.id || null,
      home_team_id: null,
      away_user_id: null,
      away_team_id: null,
      home_score: null,
      away_score: null,
    };
    if (Object.prototype.hasOwnProperty.call(info, 'kickoff_at')) {
      const when = req.body?.kickoff_at ? new Date(req.body.kickoff_at) : null;
      rec.kickoff_at = when && !isNaN(when) ? when.toISOString() : null;
    }
    if (Object.prototype.hasOwnProperty.call(info, 'status')) rec.status = 'open';
    if (Object.prototype.hasOwnProperty.call(info, 'created_at')) rec.created_at = new Date().toISOString();

    const ins = await k('matches').insert(rec);
    const id = Array.isArray(ins) ? ins[0] : ins;
    const row = await k('matches').where({ id }).first();
    return res.status(201).json(row || { id });
  } catch (e) {
    console.error('[POST /open-matches] failed (server.js)', e && (e.stack || e.message || e));
    return res.status(500).json({ error: 'DB_ERROR' });
  }
});

app.get("/news", isAuthenticated, async (req, res) => {
  const started = Date.now();
  const startedIso = new Date(started).toISOString();
  try {
    console.log('[news] GET /news start', { user: req.user && req.user.id, at: startedIso });
    const k = (knexDirect && knexDirect.client) ? knexDirect : (db && db.knex ? db.knex : null);
    if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });

    const TIMEOUT_MS = Number(process.env.NEWS_TIMEOUT_MS || 2000);
    const userId = req.user.id;

    const work = (async () => {
      const matchTable = (await k.schema.hasTable("matches")) ? "matches" : ((await k.schema.hasTable("games")) ? "games" : null);
      if (!matchTable) return [];

      const info = await k(matchTable).columnInfo().catch(() => ({}));
      const hasHomeUserId = Object.prototype.hasOwnProperty.call(info, "home_user_id");
      const hasAwayUserId = Object.prototype.hasOwnProperty.call(info, "away_user_id");
      const hasHomeTeamId = Object.prototype.hasOwnProperty.call(info, "home_team_id");
      const hasAwayTeamId = Object.prototype.hasOwnProperty.call(info, "away_team_id");
      const hasHomeScore = Object.prototype.hasOwnProperty.call(info, "home_score");
      const hasAwayScore = Object.prototype.hasOwnProperty.call(info, "away_score");
      const hasCreatedAt = Object.prototype.hasOwnProperty.call(info, "created_at");
      const hasKickoffAt = Object.prototype.hasOwnProperty.call(info, "kickoff_at");
      const hasUpdatedAt = Object.prototype.hasOwnProperty.call(info, "updated_at");
      const hasCompletedAt = Object.prototype.hasOwnProperty.call(info, "completed_at");

      const hasLeagues = await k.schema.hasTable("leagues").catch(() => false);
      const hasSports = await k.schema.hasTable("sports").catch(() => false);
      const hasTeamMembers = await k.schema.hasTable("team_members").catch(() => false);
      const hasUserLeagues = await k.schema.hasTable("user_leagues").catch(() => false);

      let leagueIds = [];
      if (hasUserLeagues) {
        const entries = await k("user_leagues").where({ user_id: userId }).select("league_id");
        leagueIds = (entries || []).map((r) => r.league_id).filter((v) => v != null);
      }

      const base = k({ m: matchTable });
      if (hasLeagues) base.leftJoin({ l: "leagues" }, "l.id", "m.league_id");
      if (hasSports && hasLeagues) base.leftJoin({ s: "sports" }, "s.id", "l.sport_id");

      base.select({ matchId: "m.id" });
      base.select({ leagueId: "m.league_id" });
      base.select(hasLeagues ? { leagueName: "l.name" } : k.raw("'' as leagueName"));
      base.select(hasSports && hasLeagues ? { sportName: "s.name" } : k.raw("'' as sportName"));
      if (hasHomeScore) base.select({ homeScore: "m.home_score" }); else base.select(k.raw("NULL as homeScore"));
      if (hasAwayScore) base.select({ awayScore: "m.away_score" }); else base.select(k.raw("NULL as awayScore"));
      if (hasHomeUserId) base.select({ homeUserId: "m.home_user_id" }); else base.select(k.raw("NULL as homeUserId"));
      if (hasAwayUserId) base.select({ awayUserId: "m.away_user_id" }); else base.select(k.raw("NULL as awayUserId"));
      if (hasHomeTeamId) base.select({ homeTeamId: "m.home_team_id" }); else base.select(k.raw("NULL as homeTeamId"));
      if (hasAwayTeamId) base.select({ awayTeamId: "m.away_team_id" }); else base.select(k.raw("NULL as awayTeamId"));
      if (hasCreatedAt) base.select({ createdAt: "m.created_at" }); else base.select(k.raw("NULL as createdAt"));
      if (hasKickoffAt) base.select({ kickoffAt: "m.kickoff_at" }); else base.select(k.raw("NULL as kickoffAt"));
      if (hasUpdatedAt) base.select({ updatedAt: "m.updated_at" }); else base.select(k.raw("NULL as updatedAt"));
      if (hasCompletedAt) base.select({ completedAt: "m.completed_at" }); else base.select(k.raw("NULL as completedAt"));

      base.where(function () {
        if (leagueIds.length) this.orWhereIn("m.league_id", leagueIds);
        if (hasHomeUserId) this.orWhere("m.home_user_id", userId);
        if (hasAwayUserId) this.orWhere("m.away_user_id", userId);
        if (hasTeamMembers && hasHomeTeamId) {
          this.orWhereExists(function () {
            this.select(1)
              .from({ tm: "team_members" })
              .whereColumn("tm.team_id", "m.home_team_id")
              .andWhere("tm.user_id", userId);
          });
        }
        if (hasTeamMembers && hasAwayTeamId) {
          this.orWhereExists(function () {
            this.select(1)
              .from({ tm: "team_members" })
              .whereColumn("tm.team_id", "m.away_team_id")
              .andWhere("tm.user_id", userId);
          });
        }
      });

      const orderColumn = hasUpdatedAt ? "m.updated_at" : (hasCompletedAt ? "m.completed_at" : (hasCreatedAt ? "m.created_at" : "m.id"));
      base.orderBy(orderColumn, "desc").limit(100);

      const rows = await base;
      if (!rows || !rows.length) return [];

      const items = [];

      const formatLeague = (m) => {
        if (m.leagueName) return m.leagueName;
        if (m.leagueId != null) return `Liga #${m.leagueId}`;
        return "Liga";
      };

      function pickTimestamp(m) {
        const order = [m.updatedAt, m.completedAt, m.createdAt, m.kickoffAt];
        return order.find((v) => v != null) || null;
      }

      for (const m of rows) {
        const tsCreated = m.createdAt || m.kickoffAt || null;
        const timestamp = pickTimestamp(m);
        const leagueLabel = formatLeague(m);
        items.push({
          id: `match-${m.matchId}-created`,
          type: "match_created",
          matchId: m.matchId,
          leagueId: m.leagueId,
          leagueName: m.leagueName || null,
          sportName: m.sportName || null,
          timestamp: tsCreated || timestamp,
          title: `Neues Match in ${leagueLabel}`,
          details: "Es wurde ein neues Match erstellt.",
        });

        if (hasHomeScore && hasAwayScore && m.homeScore != null && m.awayScore != null) {
          const resultTs = m.completedAt || m.updatedAt || tsCreated || timestamp;
          items.push({
            id: `match-${m.matchId}-result`,
            type: "match_result",
            matchId: m.matchId,
            leagueId: m.leagueId,
            leagueName: m.leagueName || null,
            sportName: m.sportName || null,
            timestamp: resultTs,
            title: `Ergebnis im Match ${m.matchId}`,
            details: `Endstand ${m.homeScore}:${m.awayScore}`,
          });
        }
      }

      items.sort((a, b) => {
        const ta = a.timestamp ? Date.parse(a.timestamp) || 0 : 0;
        const tb = b.timestamp ? Date.parse(b.timestamp) || 0 : 0;
        return tb - ta;
      });

      const dedup = [];
      const seen = new Set();
      for (const item of items) {
        const key = `${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(item);
      }
      return dedup;
    })();

    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const took = Date.now() - started;
        console.warn('[news] timeout', { user: req.user && req.user.id, tookMs: took, timeoutMs: TIMEOUT_MS });
        const err = new Error('NEWS_FETCH_TIMEOUT');
        err.code = 'NEWS_FETCH_TIMEOUT';
        reject(err);
      }, TIMEOUT_MS);
    });

    const items = await Promise.race([work, timeout]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
    const took = Date.now() - started;
    console.log('[news] done', { user: req.user && req.user.id, tookMs: took, items: Array.isArray(items) ? items.length : 0 });
    return res.json({ items });
  } catch (e) {
    if (e && (e.code === 'NEWS_FETCH_TIMEOUT' || e.message === 'NEWS_FETCH_TIMEOUT')) {
      return res.status(501).json({ error: 'NEWS_FETCH_TIMEOUT' });
    }
    console.error("GET /news failed", e && (e.stack || e.message || e));
    return res.status(500).json({ error: "NEWS_FETCH_FAILED" });
  }
});

// Routes
registerRoutes(app, ctx);

const meRoutes = require("./src/routes/me");
const leagueMatchesRoutes = require("./src/routes/leagueMatches");

// Verwende die echte Knex-Instanz für die neuen Routen
// app.use("/me", meRoutes({ db: knexDirect }));
// app.use("/leagues", leagueMatchesRoutes({ db: knexDirect }));
// pass the same primary knex (adapter preferred) into routes to ensure consistent data source
app.use("/me", meRoutes({ db: knexDirect || db }));
app.use("/leagues", leagueMatchesRoutes({ db: knexDirect || db }));

const sportsRoutes = require("./src/routes/sports");
const matchesRoutes = require("./routes/matches");
const chatsRoutes = require("./routes/chats");

// Mount routes BEFORE any 404 handler
app.use("/sports", sportsRoutes({ db }));
// Ensure we pass a usable knex instance into routes that expect it.
// Prefer knexDirect (legacy), then adapter's knex, then the adapter object as last resort.
const resolvedKnexForRoutes = (knexDirect && knexDirect.client)
  ? knexDirect
  : (db && db.knex && db.knex.client) ? db.knex : (db || null);
if (process.env.DEBUG_BOOT === '1' || canLog('debug')) {
  console.log('[DEBUG] resolvedKnexForRoutes summary:', {
    hasResolved: !!resolvedKnexForRoutes,
    isFunction: typeof resolvedKnexForRoutes === 'function',
    hasClient: !!(resolvedKnexForRoutes && resolvedKnexForRoutes.client),
    source: knexDirect && knexDirect.client ? 'knexDirect' : (db && db.knex && db.knex.client) ? 'adapter.knex' : (db ? 'adapter' : 'none')
  });
}
app.use("/matches", matchesRoutes({ db: resolvedKnexForRoutes }));
app.use("/chats", chatsRoutes({ db: resolvedKnexForRoutes }));

// --- ensure root /sports exists (some setups expose only /sports/:id/... but not GET /sports) ---
app.get("/sports", async (req, res) => {
  try {
    // prefer direct knex if available
    const k = (knexDirect && knexDirect.client) ? knexDirect : (db && db.knex ? db.knex : null);
    if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
    const rows = await k("sports").select("id", "name").orderBy("name");
    return res.json(rows || []);
  } catch (e) {
    console.error("GET /sports failed:", e && (e.stack || e.message || e));
    return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
  }
});

// --- new: provide canonical list endpoints used by frontend ---
app.get("/sports/list", async (req, res) => {
  try {
    const k = (knexDirect && knexDirect.client) ? knexDirect : (db && db.knex ? db.knex : null);
    if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
    const rows = await k("sports").select("id", "name").orderBy("name");
    return res.json(rows || []);
  } catch (e) {
    console.error("GET /sports/list failed:", e && (e.stack || e.message || e));
    return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
  }
});

app.get("/cities/list", async (req, res) => {
  try {
    const k = (knexDirect && knexDirect.client) ? knexDirect : (db && db.knex ? db.knex : null);
    if (!k) return res.status(500).json({ error: "DB_NOT_AVAILABLE" });
    const hasCountries = await k.schema.hasTable('countries').catch(() => false);
    const hasStates = await k.schema.hasTable('states').catch(() => false);
    const cityCols = await k('cities').columnInfo().catch(() => ({}));
    const hasCountryId = Object.prototype.hasOwnProperty.call(cityCols, 'country_id');
    const hasStateId = Object.prototype.hasOwnProperty.call(cityCols, 'state_id');

    let q = k({ c: 'cities' }).select('c.id', 'c.name');
    if (hasCountryId && hasCountries) {
      q = q.leftJoin({ co: 'countries' }, 'co.id', 'c.country_id').select({ countryId: 'co.id', countryCode: k.raw('COALESCE(co.iso2, co.code)') , countryName: 'co.name' });
    } else {
      q = q.select(k.raw('NULL as countryId'), k.raw("NULL as countryCode"), k.raw("NULL as countryName"));
    }
    if (hasStateId && hasStates) {
      q = q.leftJoin({ st: 'states' }, 'st.id', 'c.state_id').select({ stateId: 'st.id', stateCode: 'st.code', stateName: 'st.name' });
    } else {
      q = q.select(k.raw('NULL as stateId'), k.raw('NULL as stateCode'), k.raw('NULL as stateName'));
    }
    const rows = await q.orderBy('c.name', 'asc');
    return res.json(rows || []);
  } catch (e) {
    console.error("GET /cities/list failed:", e && (e.stack || e.message || e));
    return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
  }
});

// Public list of countries
app.get('/countries', async (req, res) => {
  try {
    const k = (knexDirect && knexDirect.client) ? knexDirect : (db && db.knex ? db.knex : null);
    if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });
    const hasCountries = await k.schema.hasTable('countries').catch(() => false);
    if (!hasCountries) return res.json([]);
    const colInfo = await k('countries').columnInfo().catch(() => ({}));
    const hasIso2 = Object.prototype.hasOwnProperty.call(colInfo, 'iso2');
    const rows = await k('countries').select('id', hasIso2 ? { code: 'iso2' } : { code: 'code' }, 'name').orderBy('name');
    return res.json(rows || []);
  } catch (e) {
    console.error('GET /countries failed:', e && (e.stack || e.message || e));
    return res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// --- TEMP DEBUG: lookup user by email (only for local debugging) ---
app.get('/debug/user', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim();
    if (!email) return res.status(400).json({ error: 'email query required' });
    // use adapter/db directly (ctx.db is not in scope here but 'db' is)
  db.get(`SELECT id, email, firstname, lastname FROM users WHERE email = ?`, [email], (err, row) => {
      if (err) return res.status(500).json({ error: 'db error', details: err.message });
      if (!row) return res.status(404).json({ error: 'not found' });
      return res.json({ user: row });
    });
  } catch (e) {
    return res.status(500).json({ error: 'internal', details: String(e) });
  }
});

// TEMP: list a few users (debug only)
app.get('/debug/users', async (req, res) => {
  try {
    db.all('SELECT id, email, firstname, lastname FROM users LIMIT 20', [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'db error', details: err.message });
      return res.json({ count: (rows || []).length, users: rows || [] });
    });
  } catch (e) {
    return res.status(500).json({ error: 'internal', details: String(e) });
  }
});

// --- Error handling middleware (logs and returns minimal response) ---
app.use((err, req, res, next) => {
  // This middleware catches errors passed with next(err)
  logError(err, { url: req.originalUrl, method: req.method, body: req.body });
  if (res.headersSent) return next(err);
  // Handle body-parser size limit errors explicitly
  if (err && (err.type === 'entity.too.large' || /request entity too large/i.test(err.message || ''))) {
    return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
  }
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
});

// Global uncaught handlers
process.on("uncaughtException", (err) => {
  logError(err, { origin: "uncaughtException" });
  // Exit on fatal listen/bind errors so a supervisor (systemd/docker) can restart us
  if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
    try { console.error('[FATAL] uncaughtException:', err.code); } catch {}
    process.exit(1);
  }
});
process.on("unhandledRejection", (reason) => {
  logError(reason, { origin: "unhandledRejection" });
  if (reason && (reason.code === 'EADDRINUSE' || reason.code === 'EACCES')) {
    try { console.error('[FATAL] unhandledRejection:', reason.code); } catch {}
    process.exit(1);
  }
});

// --- Optional: SQL Debug Logging ---
if (String(process.env.SQL_DEBUG).toLowerCase() === "true" || process.env.SQL_DEBUG === "1") {
  try {
    knexDirect.on("query", (q) => {
      const sql = q.sql || "<no-sql>";
      const bindings = Array.isArray(q.bindings) ? q.bindings : [];
      console.log("[knex] query:", sql, bindings.length ? { bindings } : "");
    });
    knexDirect.on("query-error", (err, q) => {
      const sql = q && q.sql;
      const bindings = q && q.bindings;
      console.error("[knex] query-error:", err && (err.stack || err.message || err), sql ? { sql, bindings } : "");
    });
    knexDirect.on("query-response", (res, q) => {
      const count = Array.isArray(res) ? res.length : (res && res.rowCount);
      const label = typeof count === "number" ? `${count} rows` : typeof res;
      const sql = q && q.sql;
      console.log("[knex] response:", label, sql ? { sql } : "");
    });
    console.log("[SQL_DEBUG] Knex query logging is ENABLED");
  } catch (e) {
    console.warn("[SQL_DEBUG] Could not attach knex listeners:", e.message || e);
  }
}

const server = app.listen(PORT, '0.0.0.0', () => {
  logInfo(`[Server] Listening on http://0.0.0.0:${PORT}`);
  const logsDir = ensureLogsDir();
  logInfo(`[Server] Logs directory: ${logsDir} (error.log, info.log, link-tests.log)`);

  // Link-Tests nur bei ENABLE_LINK_TESTS=1
  if (process.env.ENABLE_LINK_TESTS === '1') {
    (async function runLinkTests() {
      try {
        const k = knexDirect; // use direct knex for sampling ids
        // sample ids (may be undefined)
        const firstLeague = await k("leagues").select("id").first().catch(() => null);
        const firstCity = await k("cities").select("id").first().catch(() => null);
        const firstSport = await k("sports").select("id").first().catch(() => null);
        const leagueId = firstLeague && firstLeague.id ? firstLeague.id : null;
        const cityId = firstCity && firstCity.id ? firstCity.id : null;
        const sportId = firstSport && firstSport.id ? firstSport.id : null;

        const BASE = `http://localhost:${PORT}`;
        const endpoints = [
          "/",
          "/leagues",
          leagueId ? `/leagues/${leagueId}` : null,
          leagueId ? `/leagues/${leagueId}/games` : null,
          leagueId ? `/leagues/${leagueId}/members` : null,
          leagueId ? `/leagues/${leagueId}/standings` : null,
          "/sports",
          sportId ? `/sports/${sportId}/leagues` : null,
          "/me", // requires auth; will likely 401 but is tested to surface issues
          "/me/leagues",
          "/me/games",
        ].filter(Boolean);

        logInfo("Starting automated link tests", { endpoints });

        const results = [];
        for (const ep of endpoints) {
          try {
            // use fetch with timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            // No auth token by default; some endpoints will return 401 which is a valid response
            const res = await fetch(BASE + ep, { signal: controller.signal });
            clearTimeout(timeout);
            const status = res.status;
            let bodyText = "";
            try { bodyText = await res.text(); } catch {}
            results.push({ endpoint: ep, ok: res.ok, status, snippet: bodyText?.slice(0, 500) });
            logInfo("Link test result", { endpoint: ep, ok: res.ok, status });
          } catch (err) {
            logError(err, { endpoint: ep, note: "fetch failed" });
            results.push({ endpoint: ep, ok: false, error: err && err.message });
          }
        }

        // write full results
        logToFile("link-tests.log", JSON.stringify({ time: formatNow(), results }, null, 2));
        logInfo("Automated link tests finished", { summary: results.map(r => ({ ep: r.endpoint, ok: r.ok, status: r.status || null })) });

        // If there are server errors (5xx) or fetch failures, write a summary to error.log and print to console
        // Treat only fetch failures or 5xx as failures. 401/404 are acceptable for unauthenticated tests.
        const failures = results.filter(r => (r.error) || (r.status && r.status >= 500));

        if (failures.length > 0) {
          const summary = {
            time: formatNow(),
            message: "Automated link tests detected failures",
            failures,
          };
          logToFile("link-tests.log", JSON.stringify({ alert: summary }, null, 2));
          logError(new Error("Link tests found failures"), { failures });
          console.warn("[LINK-TEST] Failures detected. See logs/link-tests.log and logs/error.log for details.");
        } else {
          console.log("[LINK-TEST] All tested endpoints responded OK (or expected non-OK like 401/404).");
        }
      } catch (e) {
        logError(e, { origin: "runLinkTests" });
      }
    })();
  } else {
    logDebug("Link tests are disabled (set ENABLE_LINK_TESTS=1 to enable).");
  }
});

// Fail fast on bind errors so a supervisor can restart us (avoids zombie state)
server.on('error', (err) => {
  logError(err, { origin: 'server.listen' });
  if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
    try { console.error('[FATAL] server listen failed:', err.code); } catch {}
    process.exit(1);
  }
});

// --- Public statistics endpoint (lightweight, cached) ---
// Returns aggregate counts for public display on landing/login page.
// Shape: { users, confirmedUsers?, leagues, matches, teams, teamMembers, memberships, sports, generatedAt }
// Defensive: only queries tables that exist; falls back from matches->games if needed.
// Simple in-memory cache to avoid spamming DB on high traffic.
(() => {
  const cache = { data: null, ts: 0 };
  const TTL_MS = 60 * 1000; // 60s cache
  app.get('/public/stats', async (req, res) => {
    try {
      const now = Date.now();
      if (cache.data && (now - cache.ts) < TTL_MS) {
        return res.json(cache.data);
      }
      const k = (knexDirect && knexDirect.client) ? knexDirect : (db && db.knex && db.knex.client ? db.knex : null);
      if (!k) return res.status(500).json({ error: 'DB_NOT_AVAILABLE' });

      const tables = {};
      const tableNames = ['users','leagues','matches','games','user_leagues','sports','teams','team_members'];
      for (const t of tableNames) {
        tables[t] = await k.schema.hasTable(t).catch(() => false);
      }

      async function countSafe(table) {
        if (!tables[table]) return null;
        const r = await k(table).count({ c: '*' }).first().catch(() => null);
        if (!r) return 0;
        const val = r.c != null ? r.c : r.C;
        return Number(val) || 0;
      }

      const users = await countSafe('users');
      let confirmedUsers = null;
      if (tables.users) {
        // detect confirmation/verified columns
        const info = await k('users').columnInfo().catch(() => ({}));
        const confirmationCols = ['confirmed','is_confirmed','email_confirmed','verified','is_verified'];
        const found = confirmationCols.find(c => Object.prototype.hasOwnProperty.call(info, c));
        if (found) {
          confirmedUsers = await k('users').where(found, 1).count({ c: '*' }).first().then(r => Number(r.c || 0)).catch(() => null);
        }
      }
      const leagues = await countSafe('leagues');
      // prefer matches table, else games
      let matches = null;
      if (tables.matches) matches = await countSafe('matches');
      else if (tables.games) matches = await countSafe('games');
      const memberships = await countSafe('user_leagues');
      const sports = await countSafe('sports');
      const teams = await countSafe('teams');
      const teamMembers = await countSafe('team_members');

      const payload = {
        users,
        ...(confirmedUsers != null ? { confirmedUsers } : {}),
        leagues,
        matches,
        teams,
        teamMembers,
        memberships,
        sports,
        generatedAt: new Date().toISOString()
      };
      cache.data = payload;
      cache.ts = now;
      return res.json(payload);
    } catch (e) {
      console.error('GET /public/stats failed', e && (e.stack || e.message || e));
      return res.status(500).json({ error: 'STATS_FAILED' });
    }
  });
})();

// export for tests
module.exports = { app, server };

