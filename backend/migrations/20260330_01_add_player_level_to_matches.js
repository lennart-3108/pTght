exports.up = async function(knex) {
  const info = await knex('matches').columnInfo();
  if (!info.player_level) {
    await knex.schema.alterTable('matches', t => {
      t.string('player_level', 32).nullable();
    });
  }
};

exports.down = async function(knex) {
  const info = await knex('matches').columnInfo();
  if (info.player_level) {
    await knex.schema.alterTable('matches', t => {
      t.dropColumn('player_level');
    });
  }
};
