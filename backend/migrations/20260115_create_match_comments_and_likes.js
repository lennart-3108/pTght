/**
 * DEPRECATED: Diese Migration wurde durch 20260206_fix_match_comments_fk.js ersetzt
 * Die alten Foreign Keys auf 'games' waren falsch (games wurde obsolet).
 * 
 * Diese Migration wird übersprungen wenn 20260206_fix_match_comments_fk.js bereits gelaufen ist.
 */
exports.up = async function(knex) {
  // Prüfen ob die Tabellen bereits durch die korrigierte Migration existieren
  const hasComments = await knex.schema.hasTable('match_comments');
  const hasLikes = await knex.schema.hasTable('match_likes');
  
  if (hasComments && hasLikes) {
    // Check if FKs point to 'matches' (new) or 'games' (old)
    const commentsFkInfo = await knex.raw("PRAGMA foreign_key_list('match_comments')");
    const pointsToMatches = commentsFkInfo.some(fk => fk.table === 'matches');
    
    if (pointsToMatches) {
      console.log('ℹ️  Tables already created with correct FKs by 20260206_fix_match_comments_fk.js - skipping');
      return;
    }
  }
  
  // Falls die korrigierte Migration noch nicht gelaufen ist, erstelle mit alten FKs
  // (wird später von 20260206_fix_match_comments_fk.js korrigiert)
  return knex.schema
    .createTable('match_comments', (table) => {
      table.increments('id').primary();
      table.integer('matchId').unsigned().notNullable();
      table.integer('userId').unsigned().notNullable();
      table.text('text').notNullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      
      // DEPRECATED FK - wird von 20260206_fix_match_comments_fk.js korrigiert
      table.foreign('matchId').references('id').inTable('games').onDelete('CASCADE');
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
      table.index(['matchId', 'createdAt']);
    })
    .createTable('match_likes', (table) => {
      table.increments('id').primary();
      table.integer('matchId').unsigned().notNullable();
      table.integer('userId').unsigned().notNullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      
      // DEPRECATED FK - wird von 20260206_fix_match_comments_fk.js korrigiert
      table.foreign('matchId').references('id').inTable('games').onDelete('CASCADE');
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
      table.unique(['matchId', 'userId']); // Ein User kann ein Match nur einmal liken
      table.index('matchId');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('match_likes')
    .dropTableIfExists('match_comments');
};
