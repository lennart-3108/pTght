exports.up = async function (knex) {
  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) return;

  const hasRole = await knex.schema.hasColumn('users', 'role');
  if (!hasRole) {
    await knex.schema.table('users', (t) => {
      t.string('role', 50).defaultTo('free');
    });
  }

  // Backfill: ensure every existing row has a role
  await knex('users')
    .whereNull('role')
    .orWhere('role', '')
    .update({ role: 'free' });

  // Admins always have role=admin
  const hasIsAdmin = await knex.schema.hasColumn('users', 'is_admin');
  if (hasIsAdmin) {
    await knex('users')
      .where('is_admin', 1)
      .update({ role: 'admin' });
  }
};

exports.down = async function (knex) {
  // SQLite doesn't support dropping columns reliably; keep column in place.
};
