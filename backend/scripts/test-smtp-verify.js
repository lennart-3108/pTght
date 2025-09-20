const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// Load env from backend/.env.prod if present
const envPath = path.join(__dirname, '..', '.env.prod');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const cfg = {
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || undefined,
  secure: (process.env.MAIL_SECURE === 'true'),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
};

function mask(v) {
  if (!v) return '(leer)';
  return v.length > 6 ? v.replace(/.(?=.{4})/g, '•') : '••••';
}

console.log('Testing SMTP verify with:');
console.log('- host:', cfg.host + ':' + cfg.port, 'secure=' + cfg.secure);
console.log('- user:', mask(cfg.auth.user));

if (!cfg.host || !cfg.auth.user || !cfg.auth.pass) {
  console.error('Missing MAIL_HOST, MAIL_USER or MAIL_PASS in backend/.env.prod');
  process.exit(2);
}

const transporter = nodemailer.createTransport({
  host: cfg.host,
  port: cfg.port,
  secure: cfg.secure,
  auth: cfg.auth,
  tls: { rejectUnauthorized: false }
});

transporter.verify((err, success) => {
  if (err) {
    console.error('VERIFY FAILED:', err && (err.message || err));
    if (err.response) console.error('SMTP RESPONSE:', err.response);
    process.exit(1);
  }
  console.log('VERIFY OK');
  process.exit(0);
});
