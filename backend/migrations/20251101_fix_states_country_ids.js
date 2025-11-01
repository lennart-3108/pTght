/**
 * Migration: Fix states country_id to match actual countries table IDs
 * States currently reference country_id=333 for Germany, but countries table has DE with a different ID
 */

exports.up = async function(knex) {
  console.log('[Migration] Fixing states country_id references...');
  
  // Check if states and countries tables exist
  const hasStates = await knex.schema.hasTable('states');
  const hasCountries = await knex.schema.hasTable('countries');
  
  if (!hasStates || !hasCountries) {
    console.log('[Migration] States or countries table missing, skipping.');
    return;
  }

  // Get the correct country IDs
  const de = await knex('countries').where('code', 'DE').first();
  const at = await knex('countries').where('code', 'AT').first();
  const ch = await knex('countries').where('code', 'CH').first();
  
  if (!de) {
    console.log('[Migration] Germany not found in countries table, skipping.');
    return;
  }

  console.log(`[Migration] Found Germany with ID ${de.id}, updating states...`);

  // Update German states (country_id was likely 333 or similar old value)
  // We'll update all states with German codes (DE-*)
  const deStates = await knex('states').where('code', 'like', 'DE-%');
  if (deStates.length > 0) {
    await knex('states').where('code', 'like', 'DE-%').update({ country_id: de.id });
    console.log(`[Migration] Updated ${deStates.length} German states to country_id=${de.id}`);
  }

  // Update Austrian states if they exist
  if (at) {
    const atStates = await knex('states').where('code', 'like', 'AT-%');
    if (atStates.length > 0) {
      await knex('states').where('code', 'like', 'AT-%').update({ country_id: at.id });
      console.log(`[Migration] Updated ${atStates.length} Austrian states to country_id=${at.id}`);
    }
  }

  // Update Swiss cantons if they exist
  if (ch) {
    const chStates = await knex('states').where('code', 'like', 'CH-%');
    if (chStates.length > 0) {
      await knex('states').where('code', 'like', 'CH-%').update({ country_id: ch.id });
      console.log(`[Migration] Updated ${chStates.length} Swiss cantons to country_id=${ch.id}`);
    }
  }

  console.log('[Migration] States country_id references fixed.');
};

exports.down = async function(knex) {
  // No rollback - old IDs were incorrect anyway
  console.log('[Migration] Rollback skipped - cannot restore incorrect IDs.');
};
