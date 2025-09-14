const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

module.exports = function authRoutes(ctx) {
  const router = express.Router();
  const { db, SECRET, transporter, mailerState } = ctx;

  router.post("/register", (req, res) => {
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

        const newUserId = this.lastID;
        sports.forEach(sportName => {
          db.get(`SELECT id FROM sports WHERE name = ?`, [sportName], (e, sport) => {
            if (sport) db.run(`INSERT INTO user_sports (user_id, sport_id) VALUES (?, ?)`, [newUserId, sport.id]);
          });
        });

        const confirmUrl = `http://localhost:5001/confirm/${confirmationToken}`;

        const sendSuccess = () =>
          res.status(201).json({
            message: "Registrierung erfolgreich. Bitte E-Mail bestätigen.",
            ...(process.env.NODE_ENV === "development" ? { confirmUrl } : {})
          });

        if (mailerState?.enabled && transporter) {
          console.log("Mailer aktiviert, versende E-Mail an:", email);
          transporter.sendMail(
            {
              from: process.env.MAIL_FROM || "no-reply@example.com",
              to: email,
              subject: "E-Mail bestätigen",
              html: `
                <p>Hallo ${firstname},</p>
                <p>bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:</p>
                <p><a href="${confirmUrl}">${confirmUrl}</a></p>
              `,
            },
            (mailErr) => {
              if (mailErr) {
                console.error("E-Mail-Versand fehlgeschlagen an:", email, "Fehler:", mailErr.message);
                return res.status(201).json({
                  message: "Registrierung erfolgreich, aber E-Mail-Versand fehlgeschlagen.",
                  ...(process.env.NODE_ENV === "development" ? { confirmUrl } : {})
                });
              }
              console.log("E-Mail erfolgreich versendet an:", email);
              return sendSuccess();
            }
          );
        } else {
          console.log("Mailer nicht aktiviert, E-Mail nicht versendet an:", email, "enabled:", mailerState?.enabled, "transporter:", !!transporter);
          sendSuccess();
        }
      }
    );
  });

  router.post("/login", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "E-Mail und Passwort erforderlich" });
    }

    db.get(
      `SELECT id, email, password, is_admin, is_confirmed FROM users WHERE email = ?`,
      [email],
      (err, user) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler" });
        if (!user) return res.status(401).json({ error: "Ungültige Zugangsdaten" });
        if (!user.is_confirmed) return res.status(403).json({ error: "E-Mail noch nicht bestätigt" });

        const ok = bcrypt.compareSync(password, user.password);
        if (!ok) return res.status(401).json({ error: "Ungültige Zugangsdaten" });

        const token = jwt.sign(
          { id: user.id, email: user.email, is_admin: !!user.is_admin },
          SECRET,
          { expiresIn: "7d" }
        );
        return res.json({ token, is_admin: !!user.is_admin });
      }
    );
  });

  return router;
};
