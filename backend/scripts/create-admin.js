#!/usr/bin/env node
const path = require('path');
const cfg = require(path.resolve(__dirname, '..', 'src', 'config')).loadConfig();
const dbModule = require(path.resolve(__dirname, '..', 'src', 'db'));

const db = dbModule.initDb(cfg.DB_PATH);

// createIncrementalAdmin will insert an admin like admin1@example.com with password test1234
dbModule.createIncrementalAdmin(db, (info) => {
  if (!info) {
    console.log('Admin creation finished (no info returned).');
    process.exit(0);
  }
  // Mask output lightly for display
  const maskedEmail = info.email ? info.email : '<unknown>';
  console.log(`Created admin: ${maskedEmail}`);
  console.log('Password: test1234 (default startup password)');
  process.exit(0);
});
