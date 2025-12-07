exports.up = function(knex) {
  return knex.schema.renameTable('states', 'counties');
};

exports.down = function(knex) {
  return knex.schema.renameTable('counties', 'states');
};
