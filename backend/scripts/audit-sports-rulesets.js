const makeKnex = require('knex');
const knexCfg = require('../knexfile');

async function main() {
  const knex = makeKnex(knexCfg);
  const hasSports = await knex.schema.hasTable('sports');
  const hasRulesets = await knex.schema.hasTable('rulesets');

  console.log(JSON.stringify({ hasSports, hasRulesets }));
  if (!hasSports) {
    await knex.destroy();
    return;
  }

  const sportsTotal = await knex('sports').count({ c: '*' }).first();
  console.log('sports_total', Number(sportsTotal?.c || 0));

  const cols = await knex.raw("PRAGMA table_info('sports')");
  const rows = Array.isArray(cols) ? cols : (cols?.[0] || []);
  const sportColNames = new Set((rows || []).map((c) => String(c.name || '').toLowerCase()));

  if (sportColNames.has('is_published')) {
    const published = await knex('sports').where('is_published', 1).count({ c: '*' }).first();
    const unpublished = await knex('sports').where('is_published', 0).count({ c: '*' }).first();
    console.log('sports_published', Number(published?.c || 0));
    console.log('sports_unpublished', Number(unpublished?.c || 0));
  }

  if (hasRulesets) {
    const rulesetsTotal = await knex('rulesets').count({ c: '*' }).first();
    console.log('rulesets_total', Number(rulesetsTotal?.c || 0));

    const sportsWithoutRuleset = await knex('sports as s')
      .leftJoin('rulesets as r', 'r.sport_id', 's.id')
      .groupBy('s.id')
      .havingRaw('COUNT(r.id) = 0')
      .select('s.id', 's.name')
      .orderBy('s.id', 'asc');

    console.log('sports_without_ruleset_count', sportsWithoutRuleset.length);
    if (sportsWithoutRuleset.length) {
      console.log('sports_without_ruleset_sample', sportsWithoutRuleset.slice(0, 25));
    }
  }

  await knex.destroy();
}

main().catch((e) => {
  console.error(e && (e.stack || e.message || e));
  process.exit(1);
});
