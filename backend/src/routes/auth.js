const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { renderEmailTemplate } = require("../emailTemplate");

module.exports = function authRoutes(ctx) {
  const router = express.Router();
  const { db, SECRET, transporter, mailerState, SESSION_EPOCH } = ctx;

  router.post("/register", (req, res) => {
    try {
      // Request body logging removed (security: contained plaintext passwords)
      
      const { 
        firstname, lastname, birthday, email, password, sports, 
        city_id, district_id, gender, country_code,
        accept_terms, accept_gdpr 
      } = req.body || {};
      
      if (!firstname || !lastname || !birthday || !email || !password) {
        console.log('[register] Missing required fields:', { firstname: !!firstname, lastname: !!lastname, birthday: !!birthday, email: !!email, password: !!password });
        return res.status(400).json({ error: "Alle Felder sind erforderlich" });
      }
    
    // Validate minimum age (16 years)
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 16) {
      return res.status(400).json({ error: "Du musst mindestens 16 Jahre alt sein" });
    }
    
    // Validate Terms acceptance
    if (!accept_terms) {
      return res.status(400).json({ error: "Du musst die AGB akzeptieren" });
    }
    
    // Validate GDPR for EU countries
    const euCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'NL', 'BE', 'ES', 'PT', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'LT', 'LV', 'EE', 'IE', 'DK', 'SE', 'FI', 'LU', 'MT', 'CY'];
    if (country_code && euCountries.includes(String(country_code).toUpperCase()) && !accept_gdpr) {
      return res.status(400).json({ error: "Du musst die Datenschutzerklärung (DSGVO) akzeptieren" });
    }
    
    const confirmationToken = jwt.sign({ email, epoch: SESSION_EPOCH || 1 }, SECRET, { expiresIn: "1d" });
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert user with default role=free when the column exists.
    db.all(`PRAGMA table_info(users)`, (piErr, cols) => {
      if (piErr) {
        console.error('[register] PRAGMA table_info(users) error:', piErr);
        return res.status(500).json({ error: "Datenbankfehler beim Anlegen des Nutzers" });
      }
      const colNames = new Set((cols || []).map(c => String(c.name || '').toLowerCase()));
      const hasRole = colNames.has('role');

      const columns = [
        'firstname',
        'lastname',
        'birthday',
        'email',
        'password',
        'confirmation_token',
        'is_confirmed',
        'city_id',
        'district_id',
        'gender',
        'accept_terms',
        'accept_gdpr',
        'country_code',
      ];
      const values = [
        firstname,
        lastname,
        birthday,
        email,
        hashedPassword,
        confirmationToken,
        0,
        city_id || null,
        district_id || null,
        gender || null,
        accept_terms ? 1 : 0,
        accept_gdpr ? 1 : 0,
        country_code || null,
      ];

      if (hasRole) {
        columns.push('role');
        values.push('free');
      }

      const placeholders = values.map(() => '?').join(', ');
      const sql = `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders})`;

      db.run(sql, values, function (err) {
        if (err) {
          console.error('[register] Database error:', err);
          if (err.code === "SQLITE_CONSTRAINT") {
            return res.status(400).json({ error: "E-Mail bereits registriert" });
          }
          return res.status(500).json({ error: "Datenbankfehler beim Anlegen des Nutzers" });
        }

        const newUserId = this.lastID;
        const sportsArr = Array.isArray(sports) ? sports : [];
        sportsArr.forEach(sportName => {
          db.get(`SELECT id FROM sports WHERE name = ?`, [sportName], (e, sport) => {
            if (sport) db.run(`INSERT INTO user_sports (user_id, sport_id) VALUES (?, ?)`, [newUserId, sport.id]);
          });
        });

  // derive backend base from request if possible so generated links use the right host/port
  const fallbackPort = process.env.PORT || 5001;
  const inferredHost = req && req.get && req.get('host') ? req.get('host') : `localhost:${fallbackPort}`;
  const inferredProto = req && req.protocol ? req.protocol : (process.env.BACKEND_PROTO || 'http');
  // if the router is mounted under /api, include it in public URL unless BACKEND_PUBLIC_URL is set
  const publicPrefix = (req && typeof req.baseUrl === 'string') ? req.baseUrl : '';
  const backendBase = process.env.BACKEND_PUBLIC_URL || `${inferredProto}://${inferredHost}${publicPrefix}`;
  const confirmUrl = `${backendBase}/confirm/${confirmationToken}`;

        const sendSuccess = () =>
          res.status(201).json({
            message: "Registrierung erfolgreich. Bitte E-Mail bestätigen.",
            ...(process.env.NODE_ENV === "development" ? { confirmUrl } : {})
          });

        if (mailerState?.enabled && transporter) {
          // mailer log sanitized (no PII)
          const subject = "E-Mail bestätigen";
          const html = renderEmailTemplate({
            title: "E-Mail bestätigen",
            body: `<p>Hallo ${firstname},</p><p>bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`,
            ctaLabel: "E-Mail bestätigen",
            ctaUrl: confirmUrl,
            previewText: "Bitte E-Mail bestätigen",
          });

          ctx.sendMail(email, subject, html).then(() => {
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
      });
    });
    } catch (error) {
      console.error('[register] Unexpected error:', error);
      return res.status(500).json({ error: "Interner Serverfehler" });
    }
  });

  router.post("/login", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "E-Mail und Passwort erforderlich" });
    }

    // Allow login via username or email. If a 'username' column exists, try matching by username first.
    db.all(`PRAGMA table_info(users)`, (piErr, cols) => {
      if (piErr) return res.status(500).json({ error: "Datenbankfehler" });
      const colNames = new Set((cols || []).map(c => String(c.name || '').toLowerCase()));
      const hasUsername = colNames.has('username');
      const hasRole = colNames.has('role');
      const key = String(email).trim();
      
      // Special case: allow "admin" as username only
      const isAdminLogin = key === 'admin';
      
      const selectRole = hasRole ? ', role' : '';
      const querySql = hasUsername && isAdminLogin
        ? `SELECT id, email, password_hash, is_admin, is_confirmed${selectRole} FROM users WHERE username = ?`
        : hasUsername
          ? `SELECT id, email, password_hash, is_admin, is_confirmed${selectRole} FROM users WHERE username = ? OR email = ?`
          : `SELECT id, email, password_hash, is_admin, is_confirmed${selectRole} FROM users WHERE email = ?`;
      const params = hasUsername && isAdminLogin ? [key] : hasUsername ? [key, key] : [key];

      db.get(querySql, params, (err, user) => {
        if (err) return res.status(500).json({ error: "Datenbankfehler" });
        if (!user) return res.status(401).json({ error: "Ungültige Zugangsdaten" });
        if (!user.is_confirmed) return res.status(403).json({ error: "E-Mail noch nicht bestätigt" });

        // Defensive: if the password hash is missing/invalid, treat as invalid credentials
        if (typeof user.password_hash !== 'string' || user.password_hash.length < 10) {
          return res.status(401).json({ error: "Ungültige Zugangsdaten" });
        }

        let ok = false;
        try {
          ok = bcrypt.compareSync(password, user.password_hash);
        } catch (e) {
          // Invalid hash format or other bcrypt error – treat as invalid credentials
          return res.status(401).json({ error: "Ungültige Zugangsdaten" });
        }
        if (!ok) return res.status(401).json({ error: "Ungültige Zugangsdaten" });

        const role = (user && user.role) ? String(user.role) : (user.is_admin ? 'admin' : 'free');

        const token = jwt.sign(
          { id: user.id, email: user.email, isAdmin: !!user.is_admin, role, epoch: SESSION_EPOCH || 1 },
          SECRET,
          { expiresIn: "7d" }
        );
        return res.json({ token, is_admin: !!user.is_admin, role });
      });
    });
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
          `UPDATE users SET password_hash = ? WHERE id = ?`,
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
                const html = renderEmailTemplate({
                  title: 'Passwort geändert',
                  body: '<p>Hallo,</p><p>dies ist eine automatische Bestätigung, dass dein Passwort erfolgreich geändert wurde.</p>',
                  previewText: 'Passwort wurde geändert',
                });
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
              const publicPrefix = (req && typeof req.baseUrl === 'string') ? req.baseUrl : '';
              const backendBase = process.env.BACKEND_PUBLIC_URL || `${inferredProto}://${inferredHost}${publicPrefix}`;
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

                if (ctx && ctx.mailerState && ctx.mailerState.enabled && ctx.transporter && ctx.sendMail) {
                  const subject = 'E-Mail bestätigen';
                  const html = renderEmailTemplate({
                    title: 'E-Mail bestätigen',
                    body: `<p>Hallo ${user.firstname || ''},</p><p>bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`,
                    ctaLabel: 'E-Mail bestätigen',
                    ctaUrl: confirmUrl,
                    previewText: 'Bitte E-Mail bestätigen',
                  });
                  ctx.sendMail(email, subject, html).then(() => {
                    console.log('[resend-confirmation] email sent to', email);
                    // record cooldown timestamp
                    try { if (cooldowns) cooldowns.set(email, Date.now()); } catch (e) { /* non-fatal */ }
                    return res.json({ success: true, message: 'Confirmation email sent' , ...(process.env.NODE_ENV === 'development' ? { confirmUrl } : {}) });
                  }).catch((mailErr) => {
                    console.error('[resend-confirmation] sendMail error', mailErr && (mailErr.stack || mailErr.message || mailErr));
                    // Fallback: gib trotzdem 200 zurück und zeige den Bestätigungslink
                    // So blockiert ein Mailer-Fehler den Nutzerfluss nicht.
                    try { if (cooldowns) cooldowns.set(email, Date.now()); } catch (e) { /* non-fatal */ }
                    return res.status(200).json({ success: true, message: 'Mailer-Fehler – Link wird angezeigt', confirmUrl });
                  });
                } else {
                  console.log('[resend-confirmation] mailer not enabled (dev mode)');
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

            const newToken = jwt.sign({ email, epoch: SESSION_EPOCH || 1 }, SECRET, { expiresIn: '1d' });
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

  // Forgot password - send reset link via email
  router.post("/forgot-password", (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, error: "E-Mail erforderlich" });

    // Find user by email
    db.get(
      `SELECT id, firstname, email FROM users WHERE email = ?`,
      [email],
      (err, user) => {
        if (err) {
          console.error('[forgot-password] db.get error', err && (err.stack || err.message || err));
          return res.status(500).json({ success: false, error: "Datenbankfehler" });
        }
        if (!user) {
          console.log('[forgot-password] user not found:', email);
          return res.status(404).json({ success: false, error: "Kein Konto mit dieser E-Mail-Adresse gefunden. Bitte registriere dich zuerst." });
        }

        // Generate password reset token (valid for 1 hour)
        const resetToken = jwt.sign({ email, type: 'password-reset', epoch: SESSION_EPOCH || 1 }, SECRET, { expiresIn: "1h" });

        // Store token in database
        db.run(
          `UPDATE users SET confirmation_token = ? WHERE id = ?`,
          [resetToken, user.id],
          function (updateErr) {
            if (updateErr) {
              console.error('[forgot-password] db.run update error', updateErr && (updateErr.stack || updateErr.message || updateErr));
              return res.status(500).json({ success: false, error: "Fehler beim Erstellen des Reset-Links" });
            }

            // Build reset URL — link directly to frontend reset page
            const host = req && req.get && req.get('host') ? req.get('host') : 'localhost:3000';
            const proto = req && req.protocol ? req.protocol : (process.env.BACKEND_PROTO || 'http');
            const frontendBase = process.env.FRONTEND_PUBLIC_URL || `${proto}://${host.replace(/:\d+$/, '')}`;
            const resetUrl = `${frontendBase}/resetpassword?token=${resetToken}`;

            // Send email
            if (ctx && ctx.mailerState && ctx.mailerState.enabled && ctx.transporter && ctx.sendMail) {
              const subject = 'Match League – Passwort zurücksetzen';
              const html = renderEmailTemplate({
                title: 'Passwort zurücksetzen',
                body: `<p>Hallo ${user.firstname || ''},</p><p>du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt. Klicke auf den folgenden Link, um ein neues Passwort festzulegen:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Dieser Link ist 1 Stunde lang gültig.</p><p>Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail einfach.</p>`,
                ctaLabel: 'Passwort zurücksetzen',
                ctaUrl: resetUrl,
                previewText: 'Passwort zurücksetzen',
              });

              ctx.sendMail(email, subject, html).then(() => {
                console.log('[forgot-password] reset email sent to', email);
                return res.json({ success: true, message: "Reset-Link wurde versendet." });
              }).catch((mailErr) => {
                console.error('[forgot-password] sendMail error', mailErr && (mailErr.stack || mailErr.message || mailErr));
                return res.status(500).json({ success: false, error: "Fehler beim Versenden der E-Mail" });
              });
            } else {
              console.log('[forgot-password] mailer not enabled (dev mode)');
              return res.json({ 
                success: true, 
                message: "Mailer nicht aktiviert (dev)", 
                ...(process.env.NODE_ENV === 'development' ? { resetUrl } : {})
              });
            }
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
      const host = req.get('host');
      const frontendBaseErr = process.env.FRONTEND_PUBLIC_URL || 
        (host.includes('dev.matchleague.org') ? 'https://dev.matchleague.org' : 
         host.includes('matchleague.org') ? 'https://matchleague.org' :
         `${req.protocol}://${host.replace(/:\d+$/, ':3000')}`);
      return res.redirect(`${frontendBaseErr}/registration-success?confirmed=0&error=invalid_token`);
    }

    // find user first (we need id/is_admin for creating jwt)
    const host = req.get('host');
    const getFrontendBase = () => process.env.FRONTEND_PUBLIC_URL || 
      (host.includes('dev.matchleague.org') ? 'https://dev.matchleague.org' : 
       host.includes('matchleague.org') ? 'https://matchleague.org' :
       `${req.protocol}://${host.replace(/:\d+$/, ':3000')}`);

    db.get(`SELECT id, is_admin FROM users WHERE email = ?`, [email], (getErr, userRow) => {
      if (getErr) {
        console.error('[confirm] db.get error', getErr && (getErr.stack || getErr.message || getErr));
        return res.redirect(`${getFrontendBase()}/registration-success?confirmed=0&error=db_error`);
      }
      if (!userRow) {
        return res.redirect(`${getFrontendBase()}/registration-success?confirmed=0&error=user_not_found`);
      }

      // Check if already confirmed
      db.get(`SELECT is_confirmed FROM users WHERE email = ?`, [email], (checkErr, confirmRow) => {
        if (checkErr) {
          console.error('[confirm] db.get check error', checkErr);
          return res.redirect(`${getFrontendBase()}/registration-success?confirmed=0&error=db_error`);
        }

        if (confirmRow && confirmRow.is_confirmed) {
          // Already confirmed - still redirect to success page
          return res.redirect(`${getFrontendBase()}/registration-success?confirmed=1&already=1`);
        }

        // Confirm user (accept any valid token for this email, not just the one in DB)
        db.run(
          `UPDATE users SET is_confirmed=1, confirmation_token=NULL WHERE email=?`,
          [email],
          function (err) {
            if (err) {
              console.error('[confirm] db.run error', err && (err.stack || err.message || err));
              const frontendBaseErr = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${req.get('host').replace(/:\d+$/, ':3000')}`;
              return res.redirect(`${frontendBaseErr}/registration-success?confirmed=0&error=db_error`);
            }
            if (this.changes === 0) {
              return res.redirect(`${getFrontendBase()}/registration-success?confirmed=0&error=update_failed`);
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

              return res.redirect(`${getFrontendBase()}/registration-success?confirmed=1&one_time=${encodeURIComponent(oneTime)}`);
            } catch (e) {
              console.error('[confirm] one-time token store failed', e && (e.stack || e.message));
              return res.redirect(`${getFrontendBase()}/registration-success?confirmed=1`);
            }
          }
        );
      });
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
      const jwtToken = jwt.sign({ id: userRow.id, email: userRow.email, isAdmin: !!userRow.is_admin, epoch: SESSION_EPOCH || 1 }, SECRET, { expiresIn: '7d' });
      // delete the one-time token (single-use)
      store.delete(one_time);
      return res.json({ token: jwtToken, is_admin: !!userRow.is_admin });
    });
  });

  // Handle password reset link - redirect to frontend with token
  router.get("/reset-password/:token", (req, res) => {
    const { token } = req.params;
    
    // Verify token is valid
    try {
      const payload = jwt.verify(token, SECRET);
      if (payload.type !== 'password-reset') {
        throw new Error("Invalid token type");
      }
      
      // Redirect to frontend password reset page with token
      // On prod, the frontend is on the same host (no port). Fallback strips port for same-origin.
      const host = req.get('host') || 'localhost:3000';
      const frontendBase = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${host.replace(/:\d+$/, '')}`;
      return res.redirect(`${frontendBase}/resetpassword?token=${token}`);
    } catch (e) {
      console.error('[reset-password-link] token verification failed', e.message);
      const host = req.get('host') || 'localhost:3000';
      const frontendBase = process.env.FRONTEND_PUBLIC_URL || `${req.protocol}://${host.replace(/:\d+$/, '')}`;
      return res.redirect(`${frontendBase}/resetpassword?error=invalid_token`);
    }
  });

  // Set new password with reset token
  router.post("/reset-password-with-token", (req, res) => {
    const { token, newPassword } = req.body || {};
    
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: "Token und neues Passwort erforderlich" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Passwort muss mindestens 6 Zeichen lang sein" });
    }

    // Verify token
    let email;
    try {
      const payload = jwt.verify(token, SECRET);
      if (payload.type !== 'password-reset') {
        throw new Error("Invalid token type");
      }
      email = payload.email;
      if (!email) throw new Error("No email in token");
    } catch (e) {
      console.error('[reset-password-with-token] token verification failed', e.message);
      return res.status(400).json({ success: false, error: "Ungültiger oder abgelaufener Token" });
    }

    // Find user and verify token matches
    db.get(
      `SELECT id, email, confirmation_token FROM users WHERE email = ?`,
      [email],
      (err, user) => {
        if (err) {
          console.error('[reset-password-with-token] db.get error', err);
          return res.status(500).json({ success: false, error: "Datenbankfehler" });
        }
        
        if (!user) {
          return res.status(404).json({ success: false, error: "Benutzer nicht gefunden" });
        }

        // Verify token matches what's stored (prevents token reuse)
        if (user.confirmation_token !== token) {
          return res.status(400).json({ success: false, error: "Token wurde bereits verwendet oder ist ungültig" });
        }

        // Hash new password
        let hashed;
        try {
          hashed = bcrypt.hashSync(newPassword, 10);
        } catch (hErr) {
          console.error('[reset-password-with-token] bcrypt error', hErr);
          return res.status(500).json({ success: false, error: "Fehler beim Verschlüsseln des Passworts" });
        }

        // Update password and clear token
        db.run(
          `UPDATE users SET password = ?, confirmation_token = NULL WHERE id = ?`,
          [hashed, user.id],
          function (updateErr) {
            if (updateErr) {
              console.error('[reset-password-with-token] db.run update error', updateErr);
              return res.status(500).json({ success: false, error: "Fehler beim Aktualisieren des Passworts" });
            }

            // Send confirmation email
            try {
              if (ctx && ctx.mailerState && ctx.mailerState.enabled && ctx.transporter) {
                const subject = 'Match League – Passwort geändert';
                const html = renderEmailTemplate({
                  title: 'Passwort erfolgreich geändert',
                  body: '<p>Hallo,</p><p>dein Passwort wurde erfolgreich geändert. Du kannst dich jetzt mit deinem neuen Passwort anmelden.</p><p>Falls du diese Änderung nicht vorgenommen hast, kontaktiere bitte sofort den Support.</p>',
                  previewText: 'Passwort wurde geändert',
                });
                ctx.sendMail(user.email, subject, html).catch((mailErr) => {
                  console.error('[reset-password-with-token] sendMail error', mailErr);
                });
              }
            } catch (e) {
              console.error('[reset-password-with-token] sendMail unexpected error', e);
            }

            return res.json({ success: true, message: "Passwort erfolgreich geändert" });
          }
        );
      }
    );
  });

  return router;
};
