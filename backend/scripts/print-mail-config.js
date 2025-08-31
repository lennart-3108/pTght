/* Minimaldiagnose für E-Mail-Konfiguration */
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
  MAIL_FROM
} = process.env;

let target;
if (!MAIL_HOST) {
  target = 'Unbekannt (keine MAIL_HOST gesetzt) – Ziel hängt von der Code-Konfiguration ab.';
} else if ((MAIL_HOST || '').includes('mailtrap')) {
  target = 'Mailtrap (Email Testing Inbox)';
} else {
  target = `SMTP (${MAIL_HOST}:${MAIL_PORT || '25'})`;
}

console.log('E-Mail-Konfiguration (aus Umgebungsvariablen):');
console.log('- Ziel:', target);
console.log('- MAIL_HOST:', MAIL_HOST || '(leer)');
console.log('- MAIL_PORT:', MAIL_PORT || '(leer)');
console.log('- MAIL_USER:', mask(MAIL_USER));
console.log('- MAIL_PASS:', mask(MAIL_PASS));
console.log('- MAIL_FROM:', MAIL_FROM || '(leer)');
console.log('\nHinweis: Falls keine Variablen gesetzt sind, im Code nach nodemailer.createTransport suchen.');
