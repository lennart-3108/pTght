exports.seed = async function(knex) {
  // Check if cities already exist
  const existingCities = await knex('cities').count('* as count').first();
  if (existingCities.count > 0) {
    console.log('Cities already seeded, skipping...');
    return;
  }

  // Insert major German cities
  const cities = await knex('cities').insert([
    { name: 'Berlin', country_id: 1, state_id: 1 },
    { name: 'München', country_id: 1, state_id: 2 },
    { name: 'Hamburg', country_id: 1, state_id: 3 },
    { name: 'Köln', country_id: 1, state_id: 4 },
    { name: 'Frankfurt am Main', country_id: 1, state_id: 5 },
    { name: 'Stuttgart', country_id: 1, state_id: 6 },
    { name: 'Düsseldorf', country_id: 1, state_id: 4 },
    { name: 'Dortmund', country_id: 1, state_id: 4 },
    { name: 'Essen', country_id: 1, state_id: 4 },
    { name: 'Leipzig', country_id: 1, state_id: 7 },
    { name: 'Bremen', country_id: 1, state_id: 8 },
    { name: 'Dresden', country_id: 1, state_id: 7 },
    { name: 'Hannover', country_id: 1, state_id: 9 },
    { name: 'Nürnberg', country_id: 1, state_id: 2 },
    { name: 'Freiburg', country_id: 1, state_id: 6 },
  ]).returning('id');

  console.log(`Inserted ${cities.length} cities`);

  // Get Berlin's ID for districts
  const berlin = await knex('cities').where('name', 'Berlin').first();
  const muenchen = await knex('cities').where('name', 'München').first();
  const hamburg = await knex('cities').where('name', 'Hamburg').first();

  // Insert Berlin districts
  if (berlin) {
    await knex('districts').insert([
      { city_id: berlin.id, name: 'Mitte', type: 'district', population: 380000 },
      { city_id: berlin.id, name: 'Friedrichshain-Kreuzberg', type: 'district', population: 290000 },
      { city_id: berlin.id, name: 'Pankow', type: 'district', population: 410000 },
      { city_id: berlin.id, name: 'Charlottenburg-Wilmersdorf', type: 'district', population: 340000 },
      { city_id: berlin.id, name: 'Spandau', type: 'district', population: 245000 },
      { city_id: berlin.id, name: 'Steglitz-Zehlendorf', type: 'district', population: 310000 },
      { city_id: berlin.id, name: 'Tempelhof-Schöneberg', type: 'district', population: 350000 },
      { city_id: berlin.id, name: 'Neukölln', type: 'district', population: 330000 },
      { city_id: berlin.id, name: 'Treptow-Köpenick', type: 'district', population: 275000 },
      { city_id: berlin.id, name: 'Marzahn-Hellersdorf', type: 'district', population: 270000 },
      { city_id: berlin.id, name: 'Lichtenberg', type: 'district', population: 295000 },
      { city_id: berlin.id, name: 'Reinickendorf', type: 'district', population: 265000 },
    ]);
    console.log('Inserted Berlin districts');
  }

  // Insert München districts
  if (muenchen) {
    await knex('districts').insert([
      { city_id: muenchen.id, name: 'Altstadt-Lehel', type: 'district', population: 22000 },
      { city_id: muenchen.id, name: 'Ludwigsvorstadt-Isarvorstadt', type: 'district', population: 56000 },
      { city_id: muenchen.id, name: 'Maxvorstadt', type: 'district', population: 54000 },
      { city_id: muenchen.id, name: 'Schwabing-West', type: 'district', population: 68000 },
      { city_id: muenchen.id, name: 'Schwabing-Freimann', type: 'district', population: 75000 },
      { city_id: muenchen.id, name: 'Bogenhausen', type: 'district', population: 86000 },
      { city_id: muenchen.id, name: 'Sendling', type: 'district', population: 42000 },
      { city_id: muenchen.id, name: 'Pasing-Obermenzing', type: 'district', population: 76000 },
    ]);
    console.log('Inserted München districts');
  }

  // Insert Hamburg districts
  if (hamburg) {
    await knex('districts').insert([
      { city_id: hamburg.id, name: 'Hamburg-Mitte', type: 'district', population: 330000 },
      { city_id: hamburg.id, name: 'Altona', type: 'district', population: 275000 },
      { city_id: hamburg.id, name: 'Eimsbüttel', type: 'district', population: 270000 },
      { city_id: hamburg.id, name: 'Hamburg-Nord', type: 'district', population: 315000 },
      { city_id: hamburg.id, name: 'Wandsbek', type: 'district', population: 440000 },
      { city_id: hamburg.id, name: 'Bergedorf', type: 'district', population: 132000 },
      { city_id: hamburg.id, name: 'Harburg', type: 'district', population: 171000 },
    ]);
    console.log('Inserted Hamburg districts');
  }
};
