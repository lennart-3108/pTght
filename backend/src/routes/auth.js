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

  // derive backend base from request if possible so generated links use the right host/port
  const fallbackPort = process.env.PORT || 5001;
  const inferredHost = req && req.get && req.get('host') ? req.get('host') : `localhost:${fallbackPort}`;
  const inferredProto = req && req.protocol ? req.protocol : (process.env.BACKEND_PROTO || 'http');
  const backendBase = process.env.BACKEND_PUBLIC_URL || `${inferredProto}://${inferredHost}`;
  const confirmUrl = `${backendBase}/confirm/${confirmationToken}`;

        const sendSuccess = () =>
          res.status(201).json({
            message: "Registrierung erfolgreich. Bitte E-Mail bestätigen.",
            ...(process.env.NODE_ENV === "development" ? { confirmUrl } : {})
          });

        if (mailerState?.enabled && transporter) {
          console.log("Mailer aktiviert, versende E-Mail an:", email);
          ctx.sendMail(
            email,
            "E-Mail bestätigen",
            `
              <p>Hallo ${firstname},</p>
              <p>bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:</p>
              <p><a href="${confirmUrl}">${confirmUrl}</a></p>
            `
          ).then(() => {
            console.log("E-Mail erfolgreich versendet an:", email);
            return sendSuccess();
          }).catch((mailErr) => {
            console.error("E-Mail-Versand fehlgeschlagen an:", email, "Fehler:", mailErr?.message || mailErr);
            return res.status(201).json({
              message: "Registrierung erfolgreich, aber E-Mail-Versand fehlgeschlagen.",
              ...(process.env.NODE_ENV === "development" ? { confirmUrl } : {})
            });
          });
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

  // Reset password (used by frontend /reset-password)
  // Expects { username: <email or username>, password: <newPassword> }
  router.post("/reset-password", (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ success: false, error: "username and password required" });

    // find user by email (frontend sends email as username)
    db.get(
      `SELECT id, email FROM users WHERE email = ?`,
      [username],
      (err, user) => {
        if (err) {
          console.error('[reset-password] db.get error', err && (err.stack || err.message || err));
          return res.status(500).json({ success: false, error: "Datenbankfehler" });
        }
        if (!user) return res.status(404).json({ success: false, error: "User not found" });

        let hashed;
        try {
          hashed = bcrypt.hashSync(password, 10);
        } catch (hErr) {
          console.error('[reset-password] bcrypt error', hErr && (hErr.stack || hErr.message || hErr));
          return res.status(500).json({ success: false, error: 'Hashing failed' });
        }

        db.run(
          `UPDATE users SET password = ? WHERE id = ?`,
          [hashed, user.id],
          function (uErr) {
            if (uErr) {
              console.error('[reset-password] db.run update error', uErr && (uErr.stack || uErr.message || uErr));
              return res.status(500).json({ success: false, error: "Update failed" });
            }
            // attempt to send confirmation email (non-blocking for success)
            try {
              if (ctx && ctx.mailerState && ctx.mailerState.enabled && ctx.transporter) {
                const subject = 'Match League – Passwort geändert';
                const html = `<p>Hallo,</p><p>dies ist eine automatische Bestätigung, dass dein Passwort erfolgreich geändert wurde.</p>`;
                ctx.sendMail(user.email, subject, html).then(() => {
                  console.log('[reset-password] confirmation email sent to', user.email);
                }).catch((mailErr) => {
                  console.error('[reset-password] sendMail error', mailErr && (mailErr.stack || mailErr.message || mailErr));
                });
              }
            } catch (e) {
              console.error('[reset-password] unexpected sendMail error', e && (e.stack || e.message || e));
            }
            return res.json({ success: true });
          }
        );
      }
    );
  });

      // Resend confirmation email (used when user didn't receive or lost the original link)
      router.post("/resend-confirmation", (req, res) => {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ success: false, error: "email required" });

        // find user by email
        db.get(
          `SELECT id, firstname, confirmation_token, is_confirmed FROM users WHERE email = ?`,
          [email],
          (err, user) => {
            if (err) {
              console.error('[resend-confirmation] db.get error', err && (err.stack || err.message || err));
              return res.status(500).json({ success: false, error: "Datenbankfehler" });
            }
            if (!user) return res.status(404).json({ success: false, error: "User not found" });
            if (user.is_confirmed) return res.status(400).json({ success: false, error: "E-Mail bereits bestätigt" });

            const sendEmailAndRespond = (tkn) => {
              const fallbackPort = process.env.PORT || 5001;
              const inferredHost = req && req.get && req.get('host') ? req.get('host') : `localhost:${fallbackPort}`;
              const inferredProto = req && req.protocol ? req.protocol : (process.env.BACKEND_PROTO || 'http');
              const backendBase = process.env.BACKEND_PUBLIC_URL || `${inferredProto}://${inferredHost}`;
              const confirmUrl = `${backendBase}/confirm/${tkn}`;
              try {
                // Enforce resend cooldown if ctx provides a resendCooldowns map
                const cooldowns = (req && req.app && req.app.locals && req.app.locals.ctx && req.app.locals.ctx.resendCooldowns) ? req.app.locals.ctx.resendCooldowns : (global && global._app_ctx && global._app_ctx.resendCooldowns) ? global._app_ctx.resendCooldowns : null;
                const cooldownSeconds = (req && req.app && req.app.locals && req.app.locals.ctx && req.app.locals.ctx.resendCooldownSeconds) ? req.app.locals.ctx.resendCooldownSeconds : (global && global._app_ctx && global._app_ctx.resendCooldownSeconds) ? global._app_ctx.resendCooldownSeconds : 300;

                if (cooldowns) {
                  const last = cooldowns.get(email);
                  const now = Date.now();
                  if (last && (now - last) < (cooldownSeconds * 1000)) {
                    const retryAfterSec = Math.ceil((cooldownSeconds * 1000 - (now - last)) / 1000);
                    res.set('Retry-After', String(retryAfterSec));
                    return res.status(429).json({ success: false, error: 'Too many requests', retry_after: retryAfterSec });
                  }
                }

                if (ctx && ctx.mailerState && ctx.mailerState.enabled && ctx.sendMail) {
                  const subject = 'E-Mail bestätigen';
                  const html = `<p>Hallo ${user.firstname || ''},</p><p>bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`;
                  ctx.sendMail(email, subject, html).then(() => {
                    console.log('[resend-confirmation] email sent to', email);
                    // record cooldown timestamp
                    try { if (cooldowns) cooldowns.set(email, Date.now()); } catch (e) { /* non-fatal */ }
                    return res.json({ success: true, message: 'Confirmation email sent' , ...(process.env.NODE_ENV === 'development' ? { confirmUrl } : {}) });
                  }).catch((mailErr) => {
                    console.error('[resend-confirmation] sendMail error', mailErr && (mailErr.stack || mailErr.message || mailErr));
                    return res.status(500).json({ success: false, error: 'E-Mail-Versand fehlgeschlagen', ...(process.env.NODE_ENV === 'development' ? { confirmUrl } : {}) });
                  });
                } else {
                  console.log('[resend-confirmation] mailer not enabled; confirmUrl:', confirmUrl);
                  // record cooldown even when returning dev url to avoid spamming endpoint in dev
                  try { if (cooldowns) cooldowns.set(email, Date.now()); } catch (e) { /* non-fatal */ }
                  return res.status(200).json({ success: true, message: 'Mailer not enabled; confirm URL returned (dev)', confirmUrl });
                }
              } catch (e) {
                console.error('[resend-confirmation] unexpected error', e && (e.stack || e.message || e));
                return res.status(500).json({ success: false, error: 'Unexpected error' });
              }
            };

            // reuse existing token if present, otherwise generate and persist a new one
            if (user.confirmation_token) {
              return sendEmailAndRespond(user.confirmation_token);
            }

            const newToken = jwt.sign({ email }, SECRET, { expiresIn: '1d' });
            db.run(
              `UPDATE users SET confirmation_token = ? WHERE id = ?`,
              [newToken, user.id],
              function (uErr) {
                if (uErr) {
                  console.error('[resend-confirmation] db.run update error', uErr && (uErr.stack || uErr.message || uErr));
                  return res.status(500).json({ success: false, error: 'Datenbankfehler beim Setzen des Tokens' });
                }
                return sendEmailAndRespond(newToken);
              }
            );
          }
        );
      });

  router.get("/confirm/:token", (req, res) => {
    const { token } = req.params;
    let email = null;
    try {
      const payload = jwt.verify(token, SECRET);
      email = payload?.email;
      if (!email) throw new Error("Kein E-Mail-Feld im Token");
    } catch {
      // redirect to frontend with error so the frontend can render a nice page
      const frontendBaseErr = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${req.get('host').replace(/:\d+$/, ':3000')}`;
      return res.redirect(`${frontendBaseErr}/registration-success?confirmed=0&error=invalid_token`);
    }

    // find user first (we need id/is_admin for creating jwt)
    db.get(`SELECT id, is_admin FROM users WHERE email = ?`, [email], (getErr, userRow) => {
      if (getErr) {
        console.error('[confirm] db.get error', getErr && (getErr.stack || getErr.message || getErr));
        const frontendBaseErr = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${req.get('host').replace(/:\d+$/, ':3000')}`;
        return res.redirect(`${frontendBaseErr}/registration-success?confirmed=0&error=db_error`);
      }
      if (!userRow) {
        const frontendBaseErr = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${req.get('host').replace(/:\d+$/, ':3000')}`;
        return res.redirect(`${frontendBaseErr}/registration-success?confirmed=0&error=user_not_found`);
      }

      db.run(
        `UPDATE users SET is_confirmed=1, confirmation_token=NULL WHERE email=? AND confirmation_token=?`,
        [email, token],
        function (err) {
          if (err) {
            console.error('[confirm] db.run error', err && (err.stack || err.message || err));
            const frontendBaseErr = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${req.get('host').replace(/:\d+$/, ':3000')}`;
            return res.redirect(`${frontendBaseErr}/registration-success?confirmed=0&error=db_error`);
          }
          if (this.changes === 0) {
            const frontendBaseErr = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${req.get('host').replace(/:\d+$/, ':3000')}`;
            return res.redirect(`${frontendBaseErr}/registration-success?confirmed=0&error=invalid_or_used_token`);
          }

          // create an opaque one-time token and store it in ctx.oneTimeAuthTokens
          try {
            const oneTime = Math.random().toString(36).slice(2) + Date.now().toString(36);
            const expiresAt = Date.now() + 1000 * 60 * 15; // valid 15 minutes
            // store minimal info for exchange
            if (req && req.app && req.app.locals && req.app.locals.ctx) {
              req.app.locals.ctx.oneTimeAuthTokens.set(oneTime, { userId: userRow.id, is_admin: !!userRow.is_admin, expiresAt });
            } else if (global && global._app_ctx && global._app_ctx.oneTimeAuthTokens) {
              global._app_ctx.oneTimeAuthTokens.set(oneTime, { userId: userRow.id, is_admin: !!userRow.is_admin, expiresAt });
            }

            const frontendBase = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${req.get('host').replace(/:\d+$/, ':3000')}`;
            return res.redirect(`${frontendBase}/registration-success?confirmed=1&one_time=${encodeURIComponent(oneTime)}`);
          } catch (e) {
            console.error('[confirm] one-time token store failed', e && (e.stack || e.message));
            const frontendBase = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${req.get('host').replace(/:\d+$/, ':3000')}`;
            return res.redirect(`${frontendBase}/registration-success?confirmed=1`);
          }
        }
      );
    });
  });

  // Exchange endpoint: client posts { one_time } to receive a short-lived JWT (or 403)
  router.post('/exchange-one-time', (req, res) => {
    const { one_time } = req.body || {};
    if (!one_time) return res.status(400).json({ error: 'one_time required' });

    // Access ctx store via req.app.locals.ctx if available
    const store = (req && req.app && req.app.locals && req.app.locals.ctx && req.app.locals.ctx.oneTimeAuthTokens) ? req.app.locals.ctx.oneTimeAuthTokens : (global && global._app_ctx && global._app_ctx.oneTimeAuthTokens) ? global._app_ctx.oneTimeAuthTokens : null;
    if (!store) return res.status(500).json({ error: 'token store unavailable' });

    const data = store.get(one_time);
    if (!data) return res.status(404).json({ error: 'token not found or expired' });
    if (Date.now() > data.expiresAt) {
      store.delete(one_time);
      return res.status(410).json({ error: 'token expired' });
    }

    // create JWT for user
    const userId = data.userId;
    db.get(`SELECT id, email, is_admin FROM users WHERE id = ?`, [userId], (err, userRow) => {
      if (err || !userRow) {
        if (data) store.delete(one_time);
        return res.status(500).json({ error: 'user not available' });
      }
      const jwtToken = jwt.sign({ id: userRow.id, email: userRow.email, is_admin: !!userRow.is_admin }, SECRET, { expiresIn: '7d' });
      // delete the one-time token (single-use)
      store.delete(one_time);
      return res.json({ token: jwtToken, is_admin: !!userRow.is_admin });
    });
  });

  return router;
};
