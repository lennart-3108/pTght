#!/usr/bin/env node
// Dry-run: migrate user_leagues -> one-person teams + team_members for team sports where teams are empty

const knexCfg = require('../knexfile');
const cfg = knexCfg[process.env.NODE_ENV || 'development'] || knexCfg;
const knex = require('knex')(cfg);

async function main(){
  const dbFile = knex.client.config.connection.filename;
  console.log('DB:', dbFile);

  // get team sports
  const sports = await knex('sports').select('id','name','team_size','sport_type','type').catch(()=>[]);
  const teamSportIds = sports.filter(s => (s.type && s.type.toLowerCase()==='team') || (s.sport_type && s.sport_type.toLowerCase()==='team') || (s.team_size && s.team_size>1)).map(s=>s.id);
  console.log('Team sports ids:', teamSportIds.join(','));

  const leagues = await knex('leagues').select('id','name','sport_id').whereIn('sport_id', teamSportIds).orderBy('id');

  let totalCreatedTeams = 0;
  for(const l of leagues){
    const teamCount = await knex('teams').where('league_id', l.id).count('* as c').then(r=>r[0].c).catch(()=>0);
    if(Number(teamCount) > 0) continue; // league already has teams

  // be defensive: some DBs use different column names
  const ulCols = await knex.raw("PRAGMA table_info('user_leagues')").catch(()=>null);
  const ulColsList = [];
  try{ if(ulCols && Array.isArray(ulCols[0])) ulCols[0].forEach(c=>ulColsList.push(c.name)); }catch(e){}
  const pick = ['id','user_id'];
  if(ulColsList.includes('created_at')) pick.push('created_at');
  const members = await knex('user_leagues').where('league_id', l.id).select(pick);
    if(!members || members.length===0) continue; // nothing to migrate

    console.log(`League ${l.id} (${l.name}) - will create ${members.length} one-person teams`);
    for(const m of members){
      const teamName = `user_${m.user_id}_league_${l.id}`;
      const createTeamSql = `INSERT INTO teams (name, sport_id, league_id, created_at, updated_at) VALUES (${escapeSql(teamName)}, ${l.sport_id}, ${l.id}, datetime('now'), datetime('now'))`;
      console.log('  ', createTeamSql);
      const insertMemberSql = `INSERT INTO team_members (team_id, user_id, role, created_at) -- team_id unknown until team created; after creation use the created team's id
         VALUES (<team_id>, ${m.user_id}, 'member', datetime('now'));`;
      console.log('  ', insertMemberSql);
      totalCreatedTeams++;
    }
  }
  console.log('Total one-person teams to create (dry-run):', totalCreatedTeams);
  await knex.destroy();
}

function escapeSql(s){ return "'"+String(s).replace(/'/g,"''")+"'" }

main().catch(e=>{ console.error(e); process.exit(1) });
