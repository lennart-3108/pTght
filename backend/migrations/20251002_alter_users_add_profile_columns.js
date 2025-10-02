exports.up = async function (knex) {
  const table = 'users';
  const exists = await knex.schema.hasTable(table);
  if (!exists) return;

  // Helper to add a column only if missing
  const addIfMissing = async (col, add) => {
    const has = await knex.schema.hasColumn(table, col);
    if (!has) {
      await knex.schema.alterTable(table, (t) => add(t));
    }
  };

  await addIfMissing('username', (t) => t.string('username').nullable().index());
  await addIfMissing('firstname', (t) => t.string('firstname'));
  await addIfMissing('lastname', (t) => t.string('lastname'));
  // Store as DATE/TEXT (SQLite stores dates as TEXT under the hood)
  await addIfMissing('birthday', (t) => t.date('birthday'));
  await addIfMissing('confirmation_token', (t) => t.string('confirmation_token'));
  await addIfMissing('is_confirmed', (t) => t.boolean('is_confirmed').defaultTo(false));
};

exports.down = async function (knex) {
  const table = 'users';
  const dropIfExists = async (col) => {
    const has = await knex.schema.hasColumn(table, col);
    if (has) {
      await knex.schema.alterTable(table, (t) => t.dropColumn(col));
    }
  };

  await dropIfExists('username');
  await dropIfExists('firstname');
  await dropIfExists('lastname');
  await dropIfExists('birthday');
  await dropIfExists('confirmation_token');
  await dropIfExists('is_confirmed');
};
