#!/usr/bin/env node
// Dry-run enumeration of delete & reseed operations for leagues
// Usage: node dry-delete-reseed.js

const path = require('path');
const knexCfg = require('../knexfile');

async function main(){
  const env = process.env.NODE_ENV || 'development';
  const cfg = knexCfg[env] || knexCfg;
  const knex = require('knex')(cfg);

  const dbFile = (knex && knex.client && knex.client.config && knex.client.config.connection && knex.client.config.connection.filename) || '<unknown>';
  console.log('Using DB file:', dbFile);

  // Defensive column selection: detect available columns on leagues
  const pragma = await knex.raw("PRAGMA table_info('leagues')").catch(()=>null);
  let cols = [];
  try {
    // knex sqlite3 can return different shapes; attempt to normalize
    if(!pragma) cols = [];
    else if(Array.isArray(pragma)){
      // sometimes [rows]
      const first = pragma[0];
      if(Array.isArray(first)) cols = first.map(c=>c.name);
      else if(first && Array.isArray(first.rows)) cols = first.rows.map(c=>c.name);
      else cols = pragma.map(c=>c.name).filter(Boolean);
    } else if(pragma && Array.isArray(pragma.rows)){
      cols = pragma.rows.map(c=>c.name);
    } else if(pragma && Array.isArray(pragma[0])){
      cols = pragma[0].map(c=>c.name);
    } else {
      // fallback: attempt to inspect and extract any 'name' fields
      const flat = JSON.stringify(pragma);
      const m = flat.match(/"name":"([^"]+)"/g) || [];
      cols = m.map(x=>x.replace(/\"name\":\"|\"/g,''));
    }
  } catch(e){ cols = []; }
  const hasCity = cols.includes('city');
  const hasCreatedBy = cols.includes('created_by');
  const hasPublicState = cols.includes('public_state');

  console.log('Leagues columns detected:', cols.join(','));

  const selectCols = ['id','name'];
  if(hasCity) selectCols.push('city');
  if(hasCreatedBy) selectCols.push('created_by');
  if(hasPublicState) selectCols.push('public_state');

  const leagues = await knex('leagues').select(selectCols).orderBy('id');
  console.log('Total leagues found:', leagues.length);

  const communityCandidates = leagues.filter(l => {
    const lname = (l.name||'').toLowerCase();
    return lname.includes('community') || (hasPublicState && (l.public_state||'').toLowerCase().includes('public')) || (hasCreatedBy && !l.created_by) || !hasCreatedBy;
  });

  console.log('Community-like leagues (will be reseeded):', communityCandidates.length);
  communityCandidates.slice(0,50).forEach(l => console.log(`  ${l.id}: ${l.name}${hasCity?` (city=${l.city})`:''}${hasCreatedBy?` created_by=${l.created_by}`:''}${hasPublicState?` public_state=${l.public_state}`:''}`));

  const nonCommunity = leagues.filter(l => !communityCandidates.includes(l));
  console.log('Leagues NOT considered community (would be deleted):', nonCommunity.length);
  nonCommunity.slice(0,50).forEach(l => console.log(`  ${l.id}: ${l.name}${hasCity?` (city=${l.city})`:''}`));

  // For reseed plan: for each sport and city pair used by communityCandidates or by the sports table, list community leagues we'd create
  const sports = await knex('sports').select('id','name','team_size','sport_type').catch(()=>[]);
  const cities = hasCity ? await knex('leagues').distinct('city').whereNotNull('city').orderBy('city').limit(200).pluck('city') : [];

  console.log('Sports:', sports.map(s=>`${s.id}:${s.name}[${s.sport_type || s.type || 'unknown'}/${s.team_size||'?'}]`).join(', '));

  const planned = [];
  for(const city of cities){
    for(const s of sports){
      planned.push({ city, sport: s.name, sport_id: s.id, team_size: s.team_size });
    }
  }
  console.log('Planned community leagues to ensure (sample 100):', planned.length);
  planned.slice(0,100).forEach(p => console.log(`  ${p.city} - ${p.sport} (team_size=${p.team_size})`));

  await knex.destroy();
}

main().catch(err=>{ console.error(err); process.exit(1); });
