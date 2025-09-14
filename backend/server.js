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

app.use(cors(cfg.cors));
app.options("*", cors());
app.use(express.json());

const db = initDb(cfg.DB_PATH);

// Mailer
const { transporter, state: mailerState } = createMailer(cfg.mailer);
verifyAndSendAcceptance(transporter, mailerState);

// Shared context (kept small and explicit)
const lastStartupAdmin = { value: null };
const ctx = {
  db,
  SECRET: cfg.JWT_SECRET,
  transporter,
  mailerState,
  getDbSchema: () => getDbSchema(db),
  schemaToHtml,
  lastStartupAdmin
};

// Create a startup admin and expose banner info
createIncrementalAdmin(db, (info) => {
  lastStartupAdmin.value = info;
});

// Routes
registerRoutes(app, ctx);

// Start server
app.listen(5001, () => {
  console.log("🚀 Backend läuft auf Port 5001 mit E-Mail-Bestätigung, Admin-Check und sauberem CORS!");
});

