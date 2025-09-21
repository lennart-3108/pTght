#!/usr/bin/env node
// Migrate user_leagues -> one-person teams + team_members, and remove user_leagues rows
// Destructive: modifies DB. Runs transactionally per-league.

// Force server DB file explicitly to avoid knexfile ambiguity
process.env.SQLITE_FILE = process.env.SQLITE_FILE || require('path').join(__dirname, '..', 'sportplattform.db');
const knexCfg = require('../knexfile');
const cfg = knexCfg[process.env.NODE_ENV || 'development'] || knexCfg;
const knex = require('knex')(cfg);

async function main(){
  const dbFile = knex.client.config.connection.filename;
  console.log('DB:', dbFile);

  const sports = await knex('sports').select('id','name','team_size','sport_type','type').catch(()=>[]);
  const teamSportIds = sports.filter(s => (s.type && s.type.toLowerCase()==='team') || (s.sport_type && s.sport_type.toLowerCase()==='team') || (s.team_size && s.team_size>1)).map(s=>s.id);
  console.log('Team sports ids:', teamSportIds.join(','));

  const leagues = await knex('leagues').select('id','name','sport_id').whereIn('sport_id', teamSportIds).orderBy('id');

  for(const l of leagues){
    const teamCount = await knex('teams').where('league_id', l.id).count('* as c').then(r=>r[0].c).catch(()=>0);
    if(Number(teamCount) > 0) continue; // skip if teams exist

  // some schemas don't have id on user_leagues; select available columns
  const ulPragma = await knex.raw("PRAGMA table_info('user_leagues')").catch(()=>null);
  const ulCols = [];
  try{ if(ulPragma && Array.isArray(ulPragma[0])) ulPragma[0].forEach(c=>ulCols.push(c.name)); }catch(e){}
  const pick = ['user_id'];
  if(ulCols.includes('joined_at')) pick.push('joined_at');
  const members = await knex('user_leagues').where('league_id', l.id).select(pick);
    if(!members || members.length===0) continue;

    console.log(`Migrating league ${l.id} (${l.name}) - ${members.length} members -> creating one-person teams`);

    // transaction per league
    await knex.transaction(async trx => {
      // detect team_members columns
      const tmi = await trx.raw("PRAGMA table_info('team_members')").catch(()=>null);
      const tmcols = [];
      try{ if(tmi && Array.isArray(tmi[0])) tmi[0].forEach(c=>tmcols.push(c.name)); }catch(e){}
      const hasRole = tmcols.includes('role');

      for(const m of members){
        const teamName = `user_${m.user_id}_league_${l.id}`;
        await trx('teams').insert({ name: teamName, sport_id: l.sport_id, league_id: l.id, created_at: knex.raw("datetime('now')"), updated_at: knex.raw("datetime('now')") });
        const res = await trx.raw('select last_insert_rowid() as id');
        let actualTeamId = null;
        try{ actualTeamId = (Array.isArray(res) && res[0] && res[0].id) ? res[0].id : (res && res.id ? res.id : null); }catch(e){}
        if(!actualTeamId){
          // fallback: select max(id)
          const r2 = await trx('teams').max('id as id');
          actualTeamId = r2 && r2[0] && r2[0].id;
        }
        console.log(`  Created team id=${actualTeamId} for user_id=${m.user_id}`);
        const memberInsert = hasRole ? { team_id: actualTeamId, user_id: m.user_id, role: 'member', created_at: knex.raw("datetime('now')") } : { team_id: actualTeamId, user_id: m.user_id, created_at: knex.raw("datetime('now')") };
        await trx('team_members').insert(memberInsert);
  // remove user_leagues row (by user_id & league_id)
  await trx('user_leagues').where({ user_id: m.user_id, league_id: l.id }).del();
      }
    });

    console.log(`  Completed migration for league ${l.id}`);
  }

  console.log('Migration finished');
  await knex.destroy();
}

main().catch(e=>{ console.error('Migration failed', e); process.exit(1); });
