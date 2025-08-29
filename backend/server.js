const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const setupTables = require("./db-setup"); // Tabellen-Setup importieren

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));
app.options("*", cors());
app.use(express.json());

const SECRET = "geheimes_schluesselwort";
const DB_PATH = "./sportplattform.db";

// 📂 SQLite DB verbinden
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("DB-Verbindungsfehler:", err.message);
  else console.log("📂 SQLite-Datenbank verbunden.");
});

// Middleware: Token prüfen
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; // Enthält id, email, is_admin
    next();
  });
}

function setupAndStart() {
  console.log("Initialisiere Tabellen ...");
  setupTables(db);

  // 📧 Nodemailer-Konfiguration (Mailtrap-Beispiel)
  const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: "52ccd285047d7d",
      pass: "2980657851969f"
    },
    tls: { rejectUnauthorized: false },
  });

  // --- ROUTES ---
  app.get("/sports", (req, res) => {
    db.all("SELECT name FROM sports", (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      res.json(rows.map(r => r.name));
    });
  });

  // Sportart-Details nach ID abrufen
app.get("/sports/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM sports WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: "Datenbankfehler" });
    if (!row) return res.status(404).json({ error: "Sportart nicht gefunden" });
    res.json(row);
  });
});


  // 📌 Profil-Daten: Nur einmal und mit Debug
  app.get("/me", authenticateToken, (req, res) => {
    console.log("🔹 /me aufgerufen von User:", req.user);

    db.get(
      `SELECT id, firstname, lastname, birthday, email, is_admin, is_confirmed
       FROM users WHERE id = ?`,
      [req.user.id],
      (err, user) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler" });
        if (!user) return res.status(404).json({ error: "User nicht gefunden" });

        db.all(
          `SELECT sports.name FROM user_sports
           JOIN sports ON user_sports.sport_id = sports.id
           WHERE user_sports.user_id = ?`,
          [req.user.id],
          (err, sports) => {
            if (err) return res.status(500).json({ error: "Fehler beim Laden der Sportarten" });
            res.json({ ...user, sports: sports.map(s => s.name) });
          }
        );
      }
    );
  });

  app.get("/leagues", (req, res) => {
    const sql = `
      SELECT leagues.id, cities.name AS city, sports.name AS sport, leagues.name
      FROM leagues
      JOIN cities ON leagues.city_id = cities.id
      JOIN sports ON leagues.sport_id = sports.id
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ error: "Datenbankfehler" });
      res.json(rows);
    });
  });

  app.post("/register", (req, res) => {
    const { firstname, lastname, birthday, email, password, sports } = req.body;
    if (!firstname || !lastname || !birthday || !email || !password || !sports?.length) {
      return res.status(400).json({ error: "Alle Felder sind erforderlich" });
    }

    const confirmationToken = jwt.sign({ email }, SECRET, { expiresIn: "1d" });
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
      `INSERT INTO users (firstname, lastname, birthday, email, password, confirmation_token, is_confirmed)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [firstname, lastname, birthday, email, hashedPassword, confirmationToken],
      function (err) {
        if (err) {
          if (err.code === "SQLITE_CONSTRAINT") {
            return res.status(400).json({ error: "E-Mail bereits registriert" });
          }
          return res.status(400).json({ error: "Datenbankfehler beim Anlegen des Nutzers" });
        }

        sports.forEach(sportName => {
          db.get(`SELECT id FROM sports WHERE name = ?`, [sportName], (err, sport) => {
            if (sport) {
              db.run(`INSERT INTO user_sports (user_id, sport_id) VALUES (?, ?)`, [this.lastID, sport.id]);
            }
          });
        });

        const confirmUrl = `http://localhost:5001/confirm/${confirmationToken}`;
        transporter.sendMail({
          from: "test@example.com",
          to: email,
          subject: "Bitte bestätige deinen Account",
          html: `<p>Hallo ${firstname}, bitte bestätige deinen Account: <a href="${confirmUrl}">${confirmUrl}</a></p>`
        }, (err) => {
          if (err) return res.status(500).json({ error: "Fehler beim Mailversand." });
          res.json({ success: true, message: "Registrierung erfolgreich! Bitte E-Mail bestätigen." });
        });
      }
    );
  });

  app.get("/confirm/:token", (req, res) => {
    const { token } = req.params;
    try {
      const decoded = jwt.verify(token, SECRET);
      db.get(`SELECT * FROM users WHERE email = ?`, [decoded.email], (err, user) => {
        if (!user) return res.status(400).send("Ungültiger Bestätigungslink.");
        db.run(`UPDATE users SET is_confirmed = 1, confirmation_token = NULL WHERE id = ?`, [user.id]);
        res.send("✅ Dein Account wurde bestätigt!");
      });
    } catch {
      res.status(400).send("Link abgelaufen oder ungültig.");
    }
  });

  // 📌 LOGIN
  app.post("/login", (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (!user) return res.status(400).json({ error: "Benutzer nicht gefunden" });
      if (!user.is_confirmed) return res.status(403).json({ error: "Bitte bestätige zuerst deine E-Mail." });

      bcrypt.compare(password, user.password, (err, same) => {
        if (!same) return res.status(400).json({ error: "Falsches Passwort" });

        // Wichtig: ID mit ins JWT
        const token = jwt.sign(
          { id: user.id, email: user.email, is_admin: user.is_admin },
          SECRET,
          { expiresIn: "1h" }
        );
        res.json({ token, is_admin: user.is_admin });
      });
    });
  });

  app.listen(5001, () => {
    console.log("🚀 Backend läuft auf Port 5001 mit E-Mail-Bestätigung, Admin-Check und sauberem CORS!");
  });
}

setupAndStart();
