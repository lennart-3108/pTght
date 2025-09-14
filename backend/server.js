const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { loadConfig } = require("./src/config");
const { initDb, getDbSchema, schemaToHtml, createIncrementalAdmin } = require("./src/db");
const { createMailer, verifyAndSendAcceptance } = require("./src/mailer");
const { registerRoutes } = require("./src/routes/index");

const app = express();
const cfg = loadConfig();
const PORT = process.env.PORT || 5002;

app.use(cors(cfg.cors));
app.options("*", cors());
app.use(express.json());

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(process.env.DB_FILE || "database.sqlite");

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

// Create a startup admin and expose banner info
createIncrementalAdmin(db, (info) => {
  lastStartupAdmin.value = info;
});

ensureCommunityLeagues(db, () => console.log("Community-Ligen synchronisiert."));

// Routes
registerRoutes(app, ctx);

const sportsRoutes = require("./src/routes/sports");

// Mount routes BEFORE any 404 handler
app.use("/sports", sportsRoutes({ db }));

// Start server
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

