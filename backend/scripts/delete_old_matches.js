/**
 * Delete all matches older than 72 hours
 */

const knex = require('knex');
const path = require('path');
const fs = require('fs');

// Load knexfile configuration
const knexfile = require('../knexfile.js');

// Get database file path
const envFile = process.env.SQLITE_FILE || process.env.DB_FILE;
let filename = envFile || path.join(__dirname, '..', 'database.sqlite');
const sportsDb = path.join(__dirname, '..', 'sportsplatform.db');
if (!envFile && fs.existsSync(sportsDb)) {
  filename = sportsDb;
}

const config = {
  client: 'sqlite3',
  connection: { filename },
  useNullAsDefault: true
};

async function deleteOldMatches() {
  const db = knex(config);

  try {
    console.log('🔍 Checking for matches older than 72 hours...');

    const hasMatches = await db.schema.hasTable('matches');
    if (!hasMatches) {
      console.log('❌ matches table does not exist');
      await db.destroy();
      return;
    }

    // Calculate cutoff time (72 hours ago)
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 72);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`📅 Cutoff date: ${cutoffISO}`);

    // Check which columns exist
    const info = await db('matches').columnInfo();
    const hasCreatedAt = !!info.created_at;
    const hasKickoffAt = !!info.kickoff_at;

    if (!hasCreatedAt && !hasKickoffAt) {
      console.log('❌ matches table has no created_at or kickoff_at column');
      await db.destroy();
      return;
    }

    // Use created_at if available, otherwise kickoff_at
    const dateColumn = hasCreatedAt ? 'created_at' : 'kickoff_at';
    console.log(`📊 Using column: ${dateColumn}`);

    // Count old matches first
    const oldMatches = await db('matches')
      .where(dateColumn, '<', cutoffISO)
      .select('id', dateColumn);

    if (oldMatches.length === 0) {
      console.log('✅ No matches older than 72 hours found');
      await db.destroy();
      return;
    }

    console.log(`\n🗑️  Found ${oldMatches.length} matches to delete:`);
    oldMatches.forEach((match, idx) => {
      console.log(`   ${idx + 1}. Match #${match.id} - ${match[dateColumn]}`);
    });

    // Delete old matches
    const deleted = await db('matches')
      .where(dateColumn, '<', cutoffISO)
      .del();

    console.log(`\n✅ Successfully deleted ${deleted} matches`);

    // Show remaining matches count
    const remaining = await db('matches').count('* as count').first();
    console.log(`📊 Remaining matches: ${remaining.count}`);

  } catch (error) {
    console.error('❌ Error deleting old matches:', error.message);
    throw error;
  } finally {
    await db.destroy();
  }
}

// Run the script
deleteOldMatches()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
