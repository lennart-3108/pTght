const knex = require('knex')(require('./knexfile').development);

async function check() {
  const rulesets = await knex('rulesets').select('id', 'name', 'sport_id', 'version', 'is_active');
  console.log('Rulesets in database:');
  console.log(JSON.stringify(rulesets, null, 2));
  await knex.destroy();
}

check().catch(console.error);
