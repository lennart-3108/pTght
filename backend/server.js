const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { isAuthenticated } = require("./middleware/auth");

// Ensure all DB layers point to the same SQLite file.
// Prefer env SQLITE_FILE; if not set but sportsplatform.db exists, use it.
if (!process.env.SQLITE_FILE && !process.env.DB_FILE) {
  const sportsDb = path.join(__dirname, "sportsplatform.db");
  if (fs.existsSync(sportsDb)) {
    process.env.SQLITE_FILE = sportsDb;
    console.log("[DB] SQLITE_FILE not set; using sportsplatform.db");
  }
}

const { loadConfig } = require("./src/config");
const { initDb, getDbSchema, schemaToHtml, createIncrementalAdmin } = require("./src/db");
const { createMailer, verifyAndSendAcceptance } = require("./src/mailer");
const { registerRoutes } = require("./src/routes/index");

const app = express();
const cfg = loadConfig();
const PORT = Number(process.env.PORT) || 5002;

app.use(cors(cfg.cors));
app.options("*", cors());
app.use(express.json());

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
function logError(err, meta = {}) {
  const entry = {
    time: formatNow(),
    message: (err && (err.stack || err.message)) || String(err),
    meta,
  };
  console.error("[ERROR]", entry.time, entry.message, meta || "");
  logToFile("error.log", JSON.stringify(entry));
}
function logInfo(msg, meta = {}) {
  const entry = { time: formatNow(), msg, meta };
  console.log("[INFO]", entry.time, entry.msg, meta || "");
  logToFile("info.log", JSON.stringify(entry));
}

// --- Database and Mailer setup ---
const { createDb } = require("./src/db/adapter");
const db = createDb();

// additionally: direct Knex instance (legacy)
// const knexDirect = require("./db");
// try to load knexfile-based config (may point to a different sqlite file like mydb.sqlite)
let knexDirect = null;
if (db && db.knex && db.knex.client) {
  knexDirect = db.knex;
  console.log("[DB] Using adapter knex instance as primary");
} else {
  try {
    knexDirect = require("./db");
    console.log("[DB] Adapter knex not available, using ./db fallback");
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
    console.log("[DB] knexfile instance created, filename:", kfFile);
  }
} catch (e) {
  // ignore if knex not available
}

// Community-Ligen
const { ensureCommunityLeagues } = require("./src/jobs/ensureCommunityLeagues");

// Mailer
const { transporter, state: mailerState, sendMail } = createMailer(cfg.mailer);
verifyAndSendAcceptance(transporter, mailerState);

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
    if (removed.length) console.log(`[oneTimeCleanup] removed ${removed.length} expired tokens`);
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
    if (removed.length) console.log(`[resendCooldownCleanup] removed ${removed.length} expired cooldown entries`);
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
if (jobKnex) {
  ensureCommunityLeagues(jobKnex, () => console.log("Community-Ligen synchronisiert."));
  setInterval(() => ensureCommunityLeagues(jobKnex, () => {}), 60 * 1000); // alle 60s prüfen
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
        console.log(`[GET /leagues] using adapter dbFile=${adapterRes.dbFile || "<unknown>"} rows=${adapterRes.rows.length}`);
        return res.json(adapterRes.rows);
      }
      // if adapter returned empty but others might have data, continue to collect from all sources
      if (adapterRes.error) {
        console.warn("[GET /leagues] adapter read error:", adapterRes.error && (adapterRes.error.stack || adapterRes.error.message || adapterRes.error));
      } else {
        console.log("[GET /leagues] adapter returned 0 rows, falling back to other sources");
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
        console.log(`[GET /leagues] source[${idx}] dbFile=${r.dbFile || "<unknown>"} skipped: ${r.skippedReason}`);
      } else if (r && r.error) {
        console.warn(`[GET /leagues] source[${idx}] read error:`, r.error && (r.error.stack || r.error.message || r.error));
      } else {
        console.log(`[GET /leagues] source[${idx}] dbFile=${r.dbFile || "<unknown>"} rows=${(r.rows || []).length}`);
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
    console.log(`[GET /leagues] returning merged rows=${merged.length} (sources=${results.length})`);

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
    const kAdapter = (db && db.knex && db.knex.client) ? db.knex : null;
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
    const upcoming = withTs.filter(r => r.ts > now || (r.home_score == null && r.away_score == null));
    const completed = withTs.filter(r => r.ts <= now || (r.home_score != null || r.away_score != null));
    return res.json({ upcoming, completed });
  } catch (e) {
    console.error("GET /me/games failed:", e && (e.stack || e.message || e));
    return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
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

// Mount routes BEFORE any 404 handler
app.use("/sports", sportsRoutes({ db }));
// Ensure we pass a usable knex instance into routes that expect it.
// Prefer knexDirect (legacy), then adapter's knex, then the adapter object as last resort.
const resolvedKnexForRoutes = (knexDirect && knexDirect.client)
  ? knexDirect
  : (db && db.knex && db.knex.client) ? db.knex : (db || null);
console.log('[DEBUG] resolvedKnexForRoutes summary:', {
  hasResolved: !!resolvedKnexForRoutes,
  isFunction: typeof resolvedKnexForRoutes === 'function',
  hasClient: !!(resolvedKnexForRoutes && resolvedKnexForRoutes.client),
  source: knexDirect && knexDirect.client ? 'knexDirect' : (db && db.knex && db.knex.client) ? 'adapter.knex' : (db ? 'adapter' : 'none')
});
app.use("/matches", matchesRoutes({ db: resolvedKnexForRoutes }));

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
    const rows = await k("cities").select("id", "name").orderBy("name");
    return res.json(rows || []);
  } catch (e) {
    console.error("GET /cities/list failed:", e && (e.stack || e.message || e));
    return res.status(500).json({ error: "Datenbankfehler", details: (e && e.message) || String(e) });
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
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
});

// Global uncaught handlers
process.on("uncaughtException", (err) => {
  logError(err, { origin: "uncaughtException" });
  // keep process alive for dev, but recommend restart in prod
});
process.on("unhandledRejection", (reason) => {
  logError(reason, { origin: "unhandledRejection" });
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

const server = app.listen(PORT, () => {
  logInfo(`[Server] Listening on http://localhost:${PORT}`);
  // show logs dir for convenience
  const logsDir = ensureLogsDir();
  console.log(`[Server] Logs directory: ${logsDir} (error.log, info.log, link-tests.log)`);

  // after server started: run link tests
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
});

// export for tests
module.exports = { app, server };

