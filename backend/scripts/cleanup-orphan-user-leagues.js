#!/usr/bin/env node
const db = require('../db');

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    dryRun: !argv.includes('--apply'),
  };
}

async function main() {
  const { apply, dryRun } = parseArgs(process.argv.slice(2));

  const rows = await db('user_leagues as ul')
    .leftJoin('users as u', 'u.id', 'ul.user_id')
    .whereNull('u.id')
    .select('ul.user_id', 'ul.league_id');

  const count = rows.length;
  console.log(JSON.stringify({ count, mode: dryRun ? 'dry-run' : 'apply' }, null, 2));

  if (!count) {
    process.exit(0);
  }

  if (!apply) {
    console.log('No changes applied. Run with --apply to delete orphan user_leagues rows.');
    process.exit(0);
  }

  const deleted = await db('user_leagues as ul')
    .whereExists(function () {
      this.select(db.raw('1'))
        .from('user_leagues as inner_ul')
        .leftJoin('users as u', 'u.id', 'inner_ul.user_id')
        .whereRaw('inner_ul.user_id = ul.user_id')
        .whereRaw('inner_ul.league_id = ul.league_id')
        .whereNull('u.id');
    })
    .del();

  console.log(JSON.stringify({ deleted }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('cleanup-orphan-user-leagues failed:', err && (err.stack || err.message || err));
  process.exit(2);
});
