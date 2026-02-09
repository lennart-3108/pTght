/**
 * Ensure racket sports category and tennis disciplines exist with correct hierarchy.
 */

exports.up = async function (knex) {
  const hasSports = await knex.schema.hasTable('sports');
  if (!hasSports) return;

  let racketCategory = null;
  const hasCategories = await knex.schema.hasTable('sport_categories');
  if (hasCategories) {
    racketCategory = await knex('sport_categories').where({ slug: 'racket-sports' }).first();
    if (!racketCategory) {
      const ids = await knex('sport_categories').insert({
        name: 'Racketsportarten',
        slug: 'racket-sports',
        icon: '🎾',
        sort_order: 1
      });
      const id = Array.isArray(ids) ? ids[0] : ids;
      racketCategory = await knex('sport_categories').where({ id }).first();
    }
  }

  const tennis = await knex('sports').where({ name: 'Tennis', parent_id: null }).first();
  if (tennis && racketCategory && tennis.category_id !== racketCategory.id) {
    await knex('sports').where({ id: tennis.id }).update({ category_id: racketCategory.id });
  }

  let rtSetBased = null;
  const hasResultTypes = await knex.schema.hasTable('result_types');
  if (hasResultTypes) {
    rtSetBased = await knex('result_types').where({ slug: 'set-based' }).first();
  }
  if (tennis && rtSetBased && tennis.result_type_id !== rtSetBased.id) {
    await knex('sports').where({ id: tennis.id }).update({ result_type_id: rtSetBased.id });
  }

  const ensureDiscipline = async ({ name, category, type }) => {
    if (!tennis) return;
    const existing = await knex('sports').where({ name }).first();
    const payload = {
      parent_id: tennis.id,
      category,
      type
    };
    if (rtSetBased) payload.result_type_id = rtSetBased.id;
    if (racketCategory) payload.category_id = racketCategory.id;

    if (existing) {
      await knex('sports').where({ id: existing.id }).update(payload);
    } else {
      await knex('sports').insert({
        name,
        ...payload
      });
    }
  };

  await ensureDiscipline({ name: 'Tennis Einzel', category: 'Einzel', type: 'Single' });
  await ensureDiscipline({ name: 'Tennis Doppel', category: 'Doppel', type: 'Team' });
};

exports.down = async function () {
  // No-op: keep data changes
};
