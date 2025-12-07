/**
 * Repair migration: ensure slots.buffer_before and buffer_after exist.
 * These columns support booking buffer times around each slot.
 * Idempotent: only adds if missing.
 */
exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('slots');
  if (!hasTable) return;
  const info = await knex('slots').columnInfo().catch(() => ({}));
  
  const changes = [];
  if (!Object.prototype.hasOwnProperty.call(info, 'buffer_before')) {
    await knex.schema.alterTable('slots', (t) => {
      t.integer('buffer_before').defaultTo(0);
    });
    changes.push('buffer_before');
  }
  if (!Object.prototype.hasOwnProperty.call(info, 'buffer_after')) {
    await knex.schema.alterTable('slots', (t) => {
      t.integer('buffer_after').defaultTo(0);
    });
    changes.push('buffer_after');
  }
  
  if (changes.length) {
    console.log(`✓ Added slots.${changes.join(', slots.')}`);
  } else {
    console.log('✓ slots buffer columns already exist');
  }
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('slots');
  if (!hasTable) return;
  const info = await knex('slots').columnInfo().catch(() => ({}));
  
  if (Object.prototype.hasOwnProperty.call(info, 'buffer_after')) {
    await knex.schema.alterTable('slots', (t) => { t.dropColumn('buffer_after'); });
  }
  if (Object.prototype.hasOwnProperty.call(info, 'buffer_before')) {
    await knex.schema.alterTable('slots', (t) => { t.dropColumn('buffer_before'); });
  }
};
