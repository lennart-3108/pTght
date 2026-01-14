exports.up = function(knex) {
  return knex.schema
    .createTable('match_comments', (table) => {
      table.increments('id').primary();
      table.integer('matchId').unsigned().notNullable();
      table.integer('userId').unsigned().notNullable();
      table.text('text').notNullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      
      table.foreign('matchId').references('id').inTable('games').onDelete('CASCADE');
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
      table.index(['matchId', 'createdAt']);
    })
    .createTable('match_likes', (table) => {
      table.increments('id').primary();
      table.integer('matchId').unsigned().notNullable();
      table.integer('userId').unsigned().notNullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      
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
