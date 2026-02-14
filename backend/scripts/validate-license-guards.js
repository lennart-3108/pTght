#!/usr/bin/env node
const db = require('../db');
const { getTeamCreationAllowance, getTournamentCreationAllowance } = require('../services/license-guards');

function parseArgs(argv) {
  const userIds = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--user' || arg === '-u') {
      const val = Number(argv[i + 1]);
      if (Number.isFinite(val) && val > 0) userIds.push(val);
      i += 1;
    }
  }
  return userIds;
}

async function main() {
  const userIds = parseArgs(process.argv.slice(2));
  if (!userIds.length) {
    console.log('Usage: node scripts/validate-license-guards.js --user <id> [--user <id>]');
    process.exit(1);
  }

  for (const userId of userIds) {
    const team = await getTeamCreationAllowance(db, userId);
    const tournaments = await getTournamentCreationAllowance(db, userId);

    console.log(`\n[User ${userId}]`);
    console.log(' Team allowance:', JSON.stringify(team));
    console.log(' Tournament allowance:', JSON.stringify(tournaments));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Validation failed:', err && (err.stack || err.message || err));
  process.exit(2);
});
