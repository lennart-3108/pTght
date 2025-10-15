// Adds states (subdivisions) table and links cities to states; ensures countries table has iso2 uniqueness.
// Idempotent & defensive against partially existing schema.
exports.up = async function(knex) {
  // Ensure countries table has expected columns/constraints
  const hasCountries = await knex.schema.hasTable('countries');
  if (hasCountries) {
    const colInfo = await knex('countries').columnInfo().catch(() => ({}));
    // ensure code column length <=2 for iso2 primary usage (existing code may be longer; keep but add iso2 if needed)
    if (!Object.prototype.hasOwnProperty.call(colInfo, 'iso2')) {
      await knex.schema.table('countries', (t) => {
        t.string('iso2', 2).nullable().index();
      });
    }
    // backfill iso2 from code when code length 2
    try {
      await knex('countries').whereRaw('length(code)=2').andWhere(function(){this.whereNull('iso2').orWhere('iso2','');}).update({ iso2: knex.raw('upper(code)') });
    } catch {}
    // add uniqueness on iso2 if not existing
    try { await knex.schema.alterTable('countries', (t) => { t.unique(['iso2']); }); } catch {}
  }

  // Create states table
  const hasStates = await knex.schema.hasTable('states');
  if (!hasStates) {
    await knex.schema.createTable('states', (t) => {
      t.increments('id').primary();
      t.integer('country_id').unsigned().notNullable().references('id').inTable('countries').onDelete('CASCADE');
      t.string('code', 16).notNullable(); // e.g. DE-BY, US-CA
      t.string('name').notNullable();
      t.string('type').nullable(); // province, state, canton, etc.
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.unique(['country_id','code']);
      t.index(['country_id']);
    });
  }

  // Add state_id to cities if missing
  const hasCities = await knex.schema.hasTable('cities');
  if (hasCities) {
    const cityCols = await knex('cities').columnInfo().catch(() => ({}));
    if (!Object.prototype.hasOwnProperty.call(cityCols, 'state_id')) {
      await knex.schema.table('cities', (t) => {
        t.integer('state_id').unsigned().nullable().references('id').inTable('states').onDelete('SET NULL');
      });
    }
    // ensure index for lookups
    try { await knex.schema.alterTable('cities', (t) => { t.index(['country_id']); t.index(['state_id']); }); } catch {}
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('cities')) {
    const hasStateId = await knex.schema.hasColumn('cities', 'state_id');
    if (hasStateId) {
      await knex.schema.table('cities', (t) => { t.dropColumn('state_id'); });
    }
  }
  if (await knex.schema.hasTable('states')) {
    await knex.schema.dropTable('states');
  }
  if (await knex.schema.hasTable('countries')) {
    // drop iso2 column & constraint (best-effort)
    const hasIso2 = await knex.schema.hasColumn('countries', 'iso2');
    if (hasIso2) {
      try { await knex.schema.table('countries', (t) => { t.dropUnique(['iso2']); }); } catch {}
      await knex.schema.table('countries', (t) => { t.dropColumn('iso2'); });
    }
  }
};
