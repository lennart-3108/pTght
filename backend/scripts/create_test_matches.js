/**
 * create_test_matches.js
 * ---------------------
 * Erstellt für jeden veröffentlichten Sport (top-level) in der DB:
 *   - 1x Spieler-Liga in Bremen mit SportBot als Mitglied
 *   - 1x offenes Match (home_user_id = SportBot)
 *   - Verfügbarkeit: nächste 7 Tage, 14:00–20:00 (Nachmittags-Preset)
 *
 * SportBot-User wird angelegt falls nicht vorhanden.
 * BOT_USER_ID wird als Umgebungsvariable in .env gespeichert.
 *
 * Usage:
 *   node scripts/create_test_matches.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const path = require('path');
const fs   = require('fs');

const knexConfig = require('../knexfile');
const knex       = require('knex')(knexConfig[process.env.NODE_ENV || 'development']);

const BREMEN_CITY_ID = 11116;
const BOT_EMAIL      = 'sportbot@matchleague.test';
const BOT_USERNAME   = 'sportbot';
const BOT_FIRSTNAME  = 'Sport';
const BOT_LASTNAME   = 'Bot';

// bcrypt hash of "SportBot123!" – pre-hashed so we don't need bcrypt here
// (any valid bcrypt hash works; user won't need to login manually)
const BOT_PW_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGqad6hGQoVmImLv6y';

async function getOrCreateBotUser() {
  let bot = await knex('users').where({ email: BOT_EMAIL }).first();
  if (!bot) {
    console.log('→ Erstelle SportBot-User...');
    const [id] = await knex('users').insert({
      email:         BOT_EMAIL,
      username:      BOT_USERNAME,
      firstname:     BOT_FIRSTNAME,
      lastname:      BOT_LASTNAME,
      password:      BOT_PW_HASH,
      city_id:       BREMEN_CITY_ID,
      is_confirmed:  1,
      open_for_matches: 1,
      country_code:  'DE',
      accept_terms:  1,
      accept_gdpr:   1,
    });
    bot = await knex('users').where({ id }).first();
    console.log(`✓ SportBot angelegt: id=${bot.id}`);
  } else {
    console.log(`✓ SportBot bereits vorhanden: id=${bot.id}`);
  }
  return bot;
}

async function saveBotIdToEnv(botId) {
  const envPath = path.resolve(__dirname, '../.env');
  let content = fs.readFileSync(envPath, 'utf8');
  if (/^BOT_USER_ID=/m.test(content)) {
    content = content.replace(/^BOT_USER_ID=.*/m, `BOT_USER_ID=${botId}`);
  } else {
    content += `\nBOT_USER_ID=${botId}\n`;
  }
  fs.writeFileSync(envPath, content);
  console.log(`✓ BOT_USER_ID=${botId} in .env gespeichert`);
}

async function run() {
  try {
    // 1. Bot-User
    const bot = await getOrCreateBotUser();
    await saveBotIdToEnv(bot.id);

    // 2. Alle top-level publizierten Sportarten
    const sports = await knex('sports')
      .where({ published: 1 })
      .where(function () {
        this.whereNull('parent_id').orWhere('parent_id', 0);
      })
      .orderBy('name');

    console.log(`\n→ ${sports.length} Sportarten gefunden – erzeuge Ligen + Matches...`);

    let created = 0;
    let skipped = 0;

    for (const sport of sports) {
      // Liga-Name: "SportBot Bremen – <Sportname>"
      const leagueName = `SportBot Bremen – ${sport.name}`;

      // Liga schon vorhanden?
      let league = await knex('leagues').where({ name: leagueName, city_id: BREMEN_CITY_ID }).first();

      if (!league) {
        const [lid] = await knex('leagues').insert({
          name:          leagueName,
          city_id:       BREMEN_CITY_ID,
          sport_id:      sport.id,
          level:         'city',
          status:        'active',
          published:     1,
          tournament_mode: 'round_robin',
          organizer_id:  bot.id,
        });
        league = await knex('leagues').where({ id: lid }).first();
      }

      // Bot als Mitglied der Liga eintragen
      const alreadyMember = await knex('user_leagues')
        .where({ user_id: bot.id, league_id: league.id })
        .first();
      if (!alreadyMember) {
        await knex('user_leagues').insert({ user_id: bot.id, league_id: league.id });
      }

      // Match schon vorhanden?
      const existingMatch = await knex('matches')
        .where({ league_id: league.id, home_user_id: bot.id, status: 'open' })
        .first();
      if (existingMatch) {
        skipped++;
        continue;
      }

      // Match erstellen
      const [matchId] = await knex('matches').insert({
        league_id:    league.id,
        home_user_id: bot.id,
        status:       'open',
        created_at:   new Date().toISOString(),
      });

      // System-Message damit Chat sichtbar ist
      await knex('match_messages').insert({
        match_id:       matchId,
        body:           `Match erstellt – ${sport.name} in Bremen`,
        sender_user_id: null,
        created_at:     new Date().toISOString(),
      }).catch(() => {});

      // Verfügbarkeit: nächste 7 Tage, 14:00–20:00
      const today = new Date();
      for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() + d);
        const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD

        const [dayId] = await knex('match_availability_days').insert({
          match_id:   matchId,
          user_id:    bot.id,
          date:       dateStr,
          created_at: new Date().toISOString(),
        });

        await knex('match_availability_windows').insert({
          day_id:     dayId,
          time_start: '14:00',
          time_end:   '20:00',
          preset:     'afternoon',
          created_at: new Date().toISOString(),
        });
      }

      created++;
      if (created % 10 === 0) process.stdout.write(`.`);
    }

    console.log(`\n\n✅ Fertig! ${created} Matches erstellt, ${skipped} bereits vorhanden.`);
    console.log(`   SportBot-ID: ${bot.id}`);
    console.log(`   Starte das Backend neu damit BOT_USER_ID aktiv wird.`);
  } catch (e) {
    console.error('Fehler:', e.message || e);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

run();
