exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('countries').del().catch(() => {});
  const countries = [
    { code: 'DE', name: 'Germany' },
    { code: 'AT', name: 'Austria' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'FR', name: 'France' },
    { code: 'ES', name: 'Spain' },
    { code: 'IT', name: 'Italy' },
  ];
  for (const c of countries) {
    await knex('countries').insert({ code: c.code, name: c.name }).catch(() => {});
  }
};
