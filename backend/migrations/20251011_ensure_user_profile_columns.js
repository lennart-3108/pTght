// SQLite-safe: add user profile columns only if missing
exports.up = async function (knex) {
  const table = 'users';
  const hasUsers = await knex.schema.hasTable(table);
  if (!hasUsers) return;

  const addIfMissing = async (col, add) => {
    const has = await knex.schema.hasColumn(table, col).catch(() => false);
    if (!has) {
      await knex.schema.alterTable(table, (t) => add(t));
    }
  };

  await addIfMissing('firstname', (t) => t.string('firstname'));
  await addIfMissing('lastname', (t) => t.string('lastname'));
  await addIfMissing('username', (t) => t.string('username').nullable().index());
  await addIfMissing('birthday', (t) => t.date('birthday'));
  await addIfMissing('is_confirmed', (t) => t.boolean('is_confirmed').defaultTo(false));
  await addIfMissing('confirmation_token', (t) => t.string('confirmation_token'));
};

exports.down = async function (knex) {
  // No-op: keep columns
};
