const k = require('knex')(require('../knexfile'));

(async () => {
  const matches = await k('matches')
    .select('id', 'home_user_id', 'slot_duration')
    .where('home_user_id', 154)
    .where('status', 'open');
  console.log('Found', matches.length, 'open matches by Peter Parker');

  let inserted = 0;
  for (const m of matches) {
    const dur = m.slot_duration || 60;
    const endH = 18 + Math.floor(dur / 60);
    const endM = dur % 60;
    const timeEnd = String(endH).padStart(2, '0') + ':' + String(endM).padStart(2, '0');

    const existing = await k('match_time_frames')
      .where({ match_id: m.id, date: '2026-02-24', time_start: '18:00' })
      .first();
    if (existing) continue;

    await k('match_time_frames').insert({
      match_id: m.id,
      date: '2026-02-24',
      time_start: '18:00',
      time_end: timeEnd,
      created_by_user_id: 154
    });
    inserted++;
  }
  console.log('Inserted', inserted, 'time frames');
  await k.destroy();
})();
