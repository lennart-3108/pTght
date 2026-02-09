/**
 * Drop obsolete 'games' table
 * 
 * Die games Tabelle wurde komplett nach 'matches' migriert (20250918_games_to_matches.js)
 * und ist jetzt leer. Alle Foreign Keys wurden korrigiert (20260206_fix_match_comments_fk.js).
 * 
 * Diese Migration kann sicher ausgeführt werden.
 */

exports.up = async function(knex) {
  const hasGames = await knex.schema.hasTable('games');
  
  if (hasGames) {
    // Sicherheitscheck: Tabelle muss leer sein
    const count = await knex('games').count('* as count').first();
    
    if (count.count > 0) {
      throw new Error(`Cannot drop 'games' table: contains ${count.count} rows. Data must be migrated first!`);
    }
    
    console.log('Dropping obsolete games table...');
    await knex.schema.dropTable('games');
    console.log('✅ Games table dropped successfully');
  } else {
    console.log('ℹ️  Games table already dropped');
  }
};

exports.down = async function(knex) {
  // Rollback: Recreate basic games table structure
  // (Daten können nicht wiederhergestellt werden)
  await knex.schema.createTable('games', (table) => {
    table.increments('id').primary();
    table.integer('league_id').notNullable().references('leagues.id').onDelete('CASCADE');
    table.text('kickoff_at').notNullable();
    table.text('home').notNullable();
    table.text('away').notNullable();
    table.integer('home_score').nullable();
    table.integer('away_score').nullable();
  });
  
  console.log('⚠️  Games table recreated (empty - data not restored)');
};
