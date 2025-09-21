#!/usr/bin/env node
// Detailed dry-run report for delete & reseed operations (read-only)
// Prints exact rows and SQL statements that would be run. No changes.

const knexCfg = require('../knexfile');
const env = process.env.NODE_ENV || 'development';
const cfg = knexCfg[env] || knexCfg;
const knex = require('knex')(cfg);

async function tableExists(k, t){ return await k.schema.hasTable(t); }

async function dumpRows(k, table, where){
  const q = k(table).select('*').modify(q => { if(where) q.where(where); });
  return await q;
}

async function main(){
  const dbFile = (knex && knex.client && knex.client.config && knex.client.config.connection && knex.client.config.connection.filename) || '<unknown>';
  console.log('DB file:', dbFile);

  // Tables of interest
  const tables = ['leagues','teams','team_members','user_leagues','user_seasons','matches','games'];
  const existing = {};
  for(const t of tables) existing[t] = await tableExists(knex, t);
  console.log('Tables present:', Object.entries(existing).filter(([k,v])=>v).map(x=>x[0]).join(', '));

  // Leagues
  if(existing['leagues']){
    // detect columns on leagues
    const li = await knex.raw("PRAGMA table_info('leagues')").catch(()=>null);
    const lcols = [];
    try{ if(li && Array.isArray(li[0])) li[0].forEach(c=>lcols.push(c.name)); }catch(e){}
    const pick = ['id','name'];
    if(lcols.includes('city_id')) pick.push('city_id');
    if(lcols.includes('sport_id')) pick.push('sport_id');
    if(lcols.includes('start_date')) pick.push('start_date');
    if(lcols.includes('end_date')) pick.push('end_date');
    if(lcols.includes('max_participants')) pick.push('max_participants');
    const leagues = await knex('leagues').select(pick);
    console.log('Total leagues:', leagues.length);
    leagues.forEach(l=>console.log(`LEAGUE ${l.id}: ${l.name} city_id=${l.city_id} sport_id=${l.sport_id} start=${l.start_date} end=${l.end_date} max=${l.max_participants}`));

    // classify community vs not
  const community = leagues.filter(l => /community/i.test(l.name) || (!('city_id' in l) || !l.city_id));
    const nonCommunity = leagues.filter(l => !community.includes(l));
    console.log('Community-like leagues:', community.length); // these would be reseeded/ensured
    console.log('Non-community leagues (would be deleted):', nonCommunity.length);
    nonCommunity.slice(0,200).forEach(l=>console.log(`  DELETE LEAGUE ${l.id} -- ${l.name}`));
  }

  // Teams and members referencing leagues
  if(existing['teams']){
    // be defensive about which columns exist
    let teams = [];
    try{
      const ti = await knex.raw("PRAGMA table_info('teams')").catch(()=>null);
      const tcols = [];
      try{ if(ti && Array.isArray(ti[0])) ti[0].forEach(c=>tcols.push(c.name)); }catch(e){}
      const pick = ['id','name'];
      if(tcols.includes('league_id')) pick.push('league_id');
      if(tcols.includes('sport_id')) pick.push('sport_id');
      teams = await knex('teams').select(pick);
      console.log('Total teams:', teams.length);
      const orphanTeams = teams.filter(t=> !('league_id' in t) || !t.league_id);
      console.log('Orphan teams (no league_id):', orphanTeams.length);
      orphanTeams.slice(0,200).forEach(t=>console.log(`  ORPHAN TEAM ${t.id} ${t.name}`));
    }catch(e){ console.log('Error reading teams:', e.message); }
  }

  if(existing['team_members']){
    try{ const members = await knex('team_members').select('*').limit(200); console.log('Team members sample (up to 200):', members.length); }catch(e){ console.log('Error reading team_members:', e.message); }
  }

  // user_leagues / user_seasons
  if(existing['user_leagues']){
    try{ const ul = await knex('user_leagues').select('*').limit(200); console.log('user_leagues sample (<=200):', ul.length); ul.slice(0,200).forEach(r=>console.log(`  user_league id=${r.id} user_id=${r.user_id} league_id=${r.league_id}`)); }catch(e){ console.log('Error reading user_leagues:', e.message); }
  }
  if(existing['user_seasons']){
    try{ const us = await knex('user_seasons').select('*').limit(200); console.log('user_seasons sample (<=200):', us.length); }catch(e){ console.log('Error reading user_seasons:', e.message); }
  }

  // Matches/Games: propose season assignment if seasons exist
  const hasMatches = existing['matches'];
  const hasGames = existing['games'];
  const hasSeasons = await tableExists(knex, 'seasons');
  console.log('Has matches:', hasMatches, 'Has games:', hasGames, 'Has seasons:', hasSeasons);

  if(hasMatches){
    try{
      const matches = await knex('matches').select('id','league_id','scheduled_at','season_id').limit(500);
      console.log('Matches sample:', matches.length);
      for(const m of matches){
        if(!m.season_id && hasSeasons){
          // attempt to find season by league_id and date
          const seasons = await knex('seasons').where('league_id', m.league_id).orderBy('start_date','desc').limit(5).catch(()=>[]);
          if(seasons && seasons.length){
            console.log(`  MATCH ${m.id} league=${m.league_id} scheduled=${m.scheduled_at} -> candidate season ${seasons[0].id} (${seasons[0].name})`);
            console.log(`    SQL: UPDATE matches SET season_id=${seasons[0].id} WHERE id=${m.id};`);
          } else {
            console.log(`  MATCH ${m.id} league=${m.league_id} scheduled=${m.scheduled_at} -> NO SEASON FOUND`);
          }
        }
      }
    }catch(e){ console.log('Error reading matches:', e.message); }
  }

  if(hasGames){
    const games = await knex('games').select('id','league_id','scheduled_at').limit(500);
    console.log('Games sample:', games.length);
  }

  // Cleanup SQL suggestions (orphaned team_members)
  if(existing['team_members']){
    try{
      const orphanMembers = await knex.raw("SELECT tm.* FROM team_members tm LEFT JOIN teams t ON tm.team_id = t.id WHERE t.id IS NULL");
      const rows = (Array.isArray(orphanMembers) && orphanMembers[0]) ? orphanMembers[0] : orphanMembers;
      console.log('Orphan team_members rows detected:', (rows && rows.length) ? rows.length : 0);
      if(rows && rows.length){
        rows.slice(0,200).forEach(r=>console.log(`  DELETE FROM team_members WHERE id=${r.id}; -- user_id=${r.user_id} team_id=${r.team_id}`));
      }
    }catch(e){ console.log('Error checking orphan team_members:', e.message); }
  }

  await knex.destroy();
}

main().catch(err=>{ console.error(err); process.exit(1); });
