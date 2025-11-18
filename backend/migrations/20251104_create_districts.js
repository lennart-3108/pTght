exports.up = function(knex) {
  return knex.schema
    // 1. Create districts table
    .createTableIfNotExists('districts', function(table) {
      table.increments('id').primary();
      table.integer('city_id').unsigned().notNullable();
      table.string('name', 100).notNullable();
      table.string('type', 50).defaultTo('district'); // district, neighborhood, borough
      table.integer('population').unsigned();
      table.text('description');
      table.timestamps(true, true);
      
      // Foreign key
      table.foreign('city_id').references('cities.id').onDelete('CASCADE');
      
      // Indexes
      table.index('city_id');
      table.index('name');
    })
    // 2. Add district_id to leagues table
    .then(async () => {
      const hasDistrictId = await knex.schema.hasColumn('leagues', 'district_id');
      const hasLevel = await knex.schema.hasColumn('leagues', 'level');
      
      if (!hasDistrictId || !hasLevel) {
        return knex.schema.table('leagues', function(table) {
          if (!hasDistrictId) {
            table.integer('district_id').unsigned();
            table.foreign('district_id').references('districts.id').onDelete('SET NULL');
            table.index('district_id');
          }
          if (!hasLevel) {
            table.string('level', 50); // 'national', 'state', 'city', 'district'
            table.index('level');
          }
        });
      }
    })
    // 3. Set level for existing leagues based on their scope
    .then(() => {
      return knex.raw(`
        UPDATE leagues 
        SET level = CASE
          WHEN city_id IS NOT NULL THEN 'city'
          WHEN sport_id IS NOT NULL THEN 'city'
          ELSE 'city'
        END
      `);
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('leagues', function(table) {
      table.dropColumn('district_id');
      table.dropColumn('level');
    })
    .dropTable('districts');
};
