/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const os = require("os");
const net = require("net");
const http = require("http");
const sqlite3 = require("sqlite3").verbose();
const nodemailer = require("nodemailer");

function section(title) {
  console.log("\n=== " + title + " ===");
}

function findDbPath() {
  const candidates = [
    path.join(__dirname, "..", "sportplattform.db"),
    path.join(__dirname, "..", "..", "sportplattform.db"),
    path.resolve(process.cwd(), "sportplattform.db"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function httpGet(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ ok: true, status: res.statusCode, data }));
    });
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
  });
}

function tcpProbe(host, port) {
  return new Promise((resolve) => {
    const s = net.createConnection({ host, port, timeout: 5000 }, () => {
      s.end();
      resolve({ ok: true });
    });
    s.on("error", (e) => resolve({ ok: false, error: e.message }));
    s.on("timeout", () => {
      s.destroy();
      resolve({ ok: false, error: "timeout" });
    });
  });
}

async function checkDb(dbPath) {
  return new Promise((resolve) => {
    if (!dbPath) return resolve({ ok: false, error: "DB file not found" });

    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return resolve({ ok: false, error: err.message });

      const results = { ok: true, path: dbPath, usersCount: null, confirmedCount: null, lastUsers: [] };
      db.get("SELECT COUNT(*) AS c FROM users", (e1, r1) => {
        if (!e1 && r1) results.usersCount = r1.c ?? r1.count ?? 0;

        db.get("SELECT COUNT(*) AS c FROM users WHERE is_confirmed = 1", (e2, r2) => {
          if (!e2 && r2) results.confirmedCount = r2.c ?? r2.count ?? 0;

          db.all("SELECT id, email, is_confirmed, confirmation_token FROM users ORDER BY id DESC LIMIT 5", (e3, rows) => {
            if (!e3 && rows) results.lastUsers = rows;
            db.close();
            resolve(results);
          });
        });
      });
    });
  });
}

async function checkSmtp() {
  const host = process.env.MAILTRAP_HOST || "sandbox.smtp.mailtrap.io";
  const port = Number(process.env.MAILTRAP_PORT || 2525);
  const user = process.env.MAILTRAP_USER;
  const pass = process.env.MAILTRAP_PASS;

  const tcp = await tcpProbe(host, port);

  if (!user || !pass) {
    return {
      tcp,
      verify: { ok: false, error: "MAILTRAP_USER/MAILTRAP_PASS not set; skip nodemailer.verify()" },
      transporterConfig: { host, port, userSet: !!user, passSet: !!pass },
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  const verify = await transporter
    .verify()
    .then(() => ({ ok: true }))
    .catch((e) => ({ ok: false, error: e.message }));

  return { tcp, verify, transporterConfig: { host, port, userSet: true, passSet: true } };
}

function tryJson(data) {
  try { return JSON.parse(data); } catch { return null; }
}

async function main() {
  section("Environment");
  console.log("Node:", process.version);
  console.log("Platform:", process.platform, os.release());
  console.log("CWD:", process.cwd());
  console.log("__dirname:", __dirname);
  console.log("MAILTRAP_USER set:", !!process.env.MAILTRAP_USER);
  console.log("MAILTRAP_PASS set:", !!process.env.MAILTRAP_PASS);
  console.log("MAILTRAP_HOST:", process.env.MAILTRAP_HOST || "(default sandbox.smtp.mailtrap.io)");
  console.log("MAILTRAP_PORT:", process.env.MAILTRAP_PORT || "(default 2525)");

  section("Backend HTTP");
  const health = await httpGet("http://localhost:5001/health");
  const healthJson = tryJson(health.data);
  console.log("GET /health ->", { ok: health.ok, status: health.status, json: healthJson || health.data });

  const mailer = await httpGet("http://localhost:5001/mailer/status");
  const mailerJson = tryJson(mailer.data);
  console.log("GET /mailer/status ->", { ok: mailer.ok, status: mailer.status, json: mailerJson || mailer.data });

  const mailTest = await httpGet("http://localhost:5001/mailer/test");
  const mailTestJson = tryJson(mailTest.data);
  console.log("GET /mailer/test ->", { ok: mailTest.ok, status: mailTest.status, json: mailTestJson || mailTest.data });

  const sports = await httpGet("http://localhost:5001/sports");
  console.log("GET /sports ->", { ok: sports.ok, status: sports.status, length: sports.data?.length });

  section("Database");
  const dbPath = findDbPath();
  console.log("DB Path:", dbPath || "(not found)");
  const dbInfo = await checkDb(dbPath);
  console.log(dbInfo);

  section("SMTP / Mailtrap");
  const smtp = await checkSmtp();
  console.log(smtp);

  section("Hints");
  console.log("- If /health fails: ensure backend is running on port 5001.");
  console.log("- If DB not found: check DB_PATH in backend/server.js and current working dir when starting the server.");
  console.log("- If SMTP TCP ok but verify fails: check MAILTRAP_USER/MAILTRAP_PASS and inbox credentials.");
  console.log("- If users exist but is_confirmed=0: email confirmations not completed or mail not delivered.");
  console.log("- If mailer.configured=false: export MAILTRAP_USER and MAILTRAP_PASS before starting the server.");
  console.log("- If mailer.verified=false: check username/password and selected Mailtrap inbox credentials.");
  console.log("- Use GET /mailer/test to trigger a test mail. Default recipient is test@example.com (captured by Mailtrap).");
}

main().catch((e) => {
  console.error("Diagnostics failed:", e);
  process.exit(1);
});
