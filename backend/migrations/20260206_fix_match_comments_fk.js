/**
 * Fix Foreign Keys in match_comments and match_likes
 * 
 * Problem: Diese Tabellen haben FK auf obsolete 'games' statt 'matches'
 * Lösung: Tabellen droppen und neu erstellen mit korrekten FK
 * 
 * Sicher da: Beide Tabellen sind leer (0 Einträge)
 */

exports.up = async function(knex) {
  // Check if tables exist
  const hasComments = await knex.schema.hasTable('match_comments');
  const hasLikes = await knex.schema.hasTable('match_likes');
  const hasCommentLikes = await knex.schema.hasTable('comment_likes');

  // Drop in reverse dependency order
  if (hasCommentLikes) {
    console.log('Dropping comment_likes (depends on match_comments)...');
    await knex.schema.dropTable('comment_likes');
  }

  if (hasComments) {
    console.log('Dropping match_comments (old FK to games)...');
    await knex.schema.dropTable('match_comments');
  }

  if (hasLikes) {
    console.log('Dropping match_likes (old FK to games)...');
    await knex.schema.dropTable('match_likes');
  }

  // Recreate with correct FK to 'matches'
  console.log('Creating match_comments with FK to matches...');
  await knex.schema.createTable('match_comments', (table) => {
    table.increments('id').primary();
    table.integer('matchId').unsigned().notNullable();
    table.integer('userId').unsigned().notNullable();
    table.integer('parentCommentId').unsigned().nullable();
    table.text('text').notNullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    
    // FIXED: FK auf 'matches' statt 'games'
    table.foreign('matchId').references('id').inTable('matches').onDelete('CASCADE');
    table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('parentCommentId').references('id').inTable('match_comments').onDelete('CASCADE');
    
    table.index(['matchId', 'createdAt']);
  });

  console.log('Creating match_likes with FK to matches...');
  await knex.schema.createTable('match_likes', (table) => {
    table.increments('id').primary();
    table.integer('matchId').unsigned().notNullable();
    table.integer('userId').unsigned().notNullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    
    // FIXED: FK auf 'matches' statt 'games'
    table.foreign('matchId').references('id').inTable('matches').onDelete('CASCADE');
    table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
    
    table.unique(['matchId', 'userId']); // Ein User kann ein Match nur einmal liken
    table.index('matchId');
  });

  console.log('Creating comment_likes with FK to match_comments...');
  await knex.schema.createTable('comment_likes', (table) => {
    table.increments('id').primary();
    table.integer('commentId').unsigned().notNullable();
    table.integer('userId').unsigned().notNullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    
    table.foreign('commentId').references('id').inTable('match_comments').onDelete('CASCADE');
    table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
    
    table.unique(['commentId', 'userId']);
    table.index('commentId');
  });

  console.log('✅ Match comments/likes tables fixed!');
};

exports.down = async function(knex) {
  // Rollback: Drop tables (they'll be recreated by original migration)
  await knex.schema.dropTableIfExists('comment_likes');
  await knex.schema.dropTableIfExists('match_comments');
  await knex.schema.dropTableIfExists('match_likes');
};
