exports.seed = async function(knex) {
  // Ensure countries exist
  const hasCountries = await knex.schema.hasTable('countries').catch(() => false);
  const hasCities = await knex.schema.hasTable('cities').catch(() => false);
  if (!hasCountries || !hasCities) return;

  // Resolve Germany (DE), Austria (AT), Switzerland (CH) if present
  const getCountryId = async (iso2) => {
    try {
      const row = await knex('countries')
        .select('id')
        .whereRaw('(upper(iso2) = ? OR upper(code) = ?)', [iso2.toUpperCase(), iso2.toUpperCase()])
        .first();
      return row?.id || null;
    } catch { return null; }
  };

  const deId = await getCountryId('DE');
  const atId = await getCountryId('AT');
  const chId = await getCountryId('CH');

  // Minimal defensive seed: only insert if table is empty (or very small)
  const existing = await knex('cities').count({ c: '*' }).first().catch(() => ({ c: 0 }));
  const count = Number(existing?.c || 0);
  if (count > 0) {
    // don't overwrite existing data
    return;
  }

  const rows = [];
  if (deId) {
    rows.push(
      { name: 'Berlin', country_id: deId },
      { name: 'München', country_id: deId },
      { name: 'Hamburg', country_id: deId },
      { name: 'Köln', country_id: deId },
      { name: 'Frankfurt am Main', country_id: deId }
    );
  }
  if (atId) {
    rows.push(
      { name: 'Wien', country_id: atId },
      { name: 'Graz', country_id: atId }
    );
  }
  if (chId) {
    rows.push(
      { name: 'Zürich', country_id: chId },
      { name: 'Genf', country_id: chId }
    );
  }

  if (rows.length) {
    try { await knex('cities').insert(rows); } catch {}
  }
};
