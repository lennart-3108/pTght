exports.up = function(knex) {
  return knex.schema
    .alterTable('match_comments', (table) => {
      table.integer('parentCommentId').unsigned().nullable();
      table.integer('likes').unsigned().defaultTo(0);
      table.foreign('parentCommentId').references('id').inTable('match_comments').onDelete('CASCADE');
      table.index('parentCommentId');
    })
    .createTable('comment_likes', (table) => {
      table.increments('id').primary();
      table.integer('commentId').unsigned().notNullable();
      table.integer('userId').unsigned().notNullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      
      table.foreign('commentId').references('id').inTable('match_comments').onDelete('CASCADE');
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
      table.unique(['commentId', 'userId']);
      table.index('commentId');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('comment_likes')
    .alterTable('match_comments', (table) => {
      table.dropColumn('parentCommentId');
      table.dropColumn('likes');
    });
};
