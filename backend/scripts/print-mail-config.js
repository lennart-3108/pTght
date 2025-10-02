/* Minimaldiagnose für E-Mail-/Mailer-Konfiguration */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
  } catch (e) {
    // .env konnte nicht geladen werden (dotenv fehlt o.ä.)
  }
}

const mask = v => (v ? v.replace(/.(?=.{4})/g, '•') : '');
const {
  MAIL_HOST,
  MAIL_PORT,
  MAIL_USER,
  MAIL_PASS,
  MAIL_FROM,
  FORWARD_TO,
  IMAP_HOST,
  IMAP_PORT,
  IMAP_SECURE,
  IMAP_USER,
  IMAP_PASS,
  IMAP_MAILBOX
} = process.env;

let target;
if (!MAIL_HOST) {
  target = 'Unbekannt (keine MAIL_HOST gesetzt) – Ziel hängt von der Code-Konfiguration ab.';
} else if ((MAIL_HOST || '').includes('mailtrap')) {
  target = 'Mailtrap (Email Testing Inbox)';
} else {
  target = `SMTP (${MAIL_HOST}:${MAIL_PORT || '25'})`;
}

console.log('E-Mail-/Mailer-Konfiguration (aus Umgebungsvariablen):');
console.log('- Ziel:', target);
console.log('- MAIL_HOST:', MAIL_HOST || '(leer)');
console.log('- MAIL_PORT:', MAIL_PORT || '(leer)');
console.log('- MAIL_USER:', mask(MAIL_USER));
console.log('- MAIL_PASS:', mask(MAIL_PASS));
console.log('- MAIL_FROM:', MAIL_FROM || '(leer)');
console.log('- FORWARD_TO:', FORWARD_TO || '(leer)');
console.log('- IMAP_HOST:', IMAP_HOST || '(leer)');
console.log('- IMAP_PORT:', IMAP_PORT || '(leer)');
console.log('- IMAP_SECURE:', IMAP_SECURE || '(leer)');
console.log('- IMAP_USER:', mask(IMAP_USER));
console.log('- IMAP_PASS:', mask(IMAP_PASS));
console.log('- IMAP_MAILBOX:', IMAP_MAILBOX || '(leer)');

// Zusätzlich: Aus dem Code abgeleitete (inkl. Defaults) auflösen
let resolved;
try {
  resolved = require('../src/config').loadConfig();
} catch (e) {
  // still fine
}

if (resolved && resolved.mailer) {
  const m = resolved.mailer;
  console.log('\nErkannte Konfiguration (inkl. Defaults aus Code):');
  console.log('- transport.host:', m.host);
  console.log('- transport.port:', m.port);
  console.log('- transport.secure:', m.secure);
  console.log('- transport.user:', mask(m.user));
  console.log('- forwardTo:', m.forwardTo || '(leer)');
  if (m.imap) {
    console.log('- imap.host:', m.imap.host);
    console.log('- imap.port:', m.imap.port);
    console.log('- imap.secure:', m.imap.secure);
    console.log('- imap.user:', mask(m.imap.user));
    console.log('- imap.mailbox:', m.imap.mailbox);
  } else {
    console.log('- imap: (deaktiviert)');
  }
} else {
  console.log('\n(Hinweis) Konnte src/config nicht laden, zeige nur rohe Umgebungsvariablen.');
}

console.log('\nTipp: Wenn MAIL_* leer sind, nutzt der Code Provider-Defaults. Setze MAIL_HOST/MAIL_PORT/MAIL_SECURE/MAIL_USER/MAIL_PASS/MAIL_FROM und starte den Prozess mit --update-env neu.');
