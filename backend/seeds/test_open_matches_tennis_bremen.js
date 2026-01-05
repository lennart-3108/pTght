/**
 * Seed: Create test open matches for Tennis Einzel in Bremen
 * - 1 day range
 * - 2 days range
 * - 7 days range
 * - Fixed range: 01.02.2026 - 20.02.2026
 */

exports.seed = async function(knex) {
  // Get Tennis Einzel sport
  const tennisEinzel = await knex('sports').where({ name: 'Tennis Einzel' }).first();
  if (!tennisEinzel) {
    console.log('[Seed] Tennis Einzel not found, skipping');
    return;
  }

  // Get Bremen city
  const bremen = await knex('cities').where({ name: 'Bremen' }).first();
  if (!bremen) {
    console.log('[Seed] Bremen not found, skipping');
    return;
  }

  // Get or create "Open Matches" league for Tennis Einzel in Bremen
  let league = await knex('leagues')
    .where({ name: 'Open Matches', sport_id: tennisEinzel.id, city_id: bremen.id })
    .first();
  
  if (!league) {
    const [leagueId] = await knex('leagues').insert({
      name: 'Open Matches',
      sport_id: tennisEinzel.id,
      city_id: bremen.id
    });
    league = { id: leagueId };
  }

  // Get first user for home_user_id
  const user = await knex('users').first();
  if (!user) {
    console.log('[Seed] No users found, skipping');
    return;
  }

  const now = new Date();
  
  // Create matches
  const matches = [
    // 1 day range
    {
      league_id: league.id,
      home_user_id: user.id,
      when_type: 'range',
      range_days: 1,
      kickoff_at: now.toISOString(),
      kickoff_end_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'open'
    },
    // 2 days range
    {
      league_id: league.id,
      home_user_id: user.id,
      when_type: 'range',
      range_days: 2,
      kickoff_at: now.toISOString(),
      kickoff_end_at: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'open'
    },
    // 7 days range
    {
      league_id: league.id,
      home_user_id: user.id,
      when_type: 'range',
      range_days: 7,
      kickoff_at: now.toISOString(),
      kickoff_end_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'open'
    },
    // Fixed range: 01.02.2026 - 20.02.2026
    {
      league_id: league.id,
      home_user_id: user.id,
      when_type: 'fixed',
      kickoff_at: new Date('2026-02-01T12:00:00').toISOString(),
      kickoff_end_at: new Date('2026-02-20T20:00:00').toISOString(),
      status: 'open'
    }
  ];

  await knex('matches').insert(matches);
  console.log(`[Seed] Created ${matches.length} test open matches for Tennis Einzel in Bremen`);
};
