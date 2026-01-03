exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // Add city_id and district_id columns if they don't exist
    table.integer('city_id').unsigned().nullable();
    table.integer('district_id').unsigned().nullable();
    
    // Add foreign key constraints
    table.foreign('city_id').references('cities.id').onDelete('SET NULL');
    table.foreign('district_id').references('districts.id').onDelete('SET NULL');
    
    // Add indexes for query performance
    table.index('city_id');
    table.index('district_id');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    // Drop foreign keys first
    table.dropForeign('city_id');
    table.dropForeign('district_id');
    
    // Drop the columns
    table.dropColumn('city_id');
    table.dropColumn('district_id');
  });
};
