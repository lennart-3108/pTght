#!/usr/bin/env node

/**
 * League Rollout Manager
 * 
 * Manages phased rollout of leagues across cities based on tier
 * Usage:
 *   node backend/scripts/rollout-leagues.js --phase 1  # Activate tier 1 cities (>100k)
 *   node backend/scripts/rollout-leagues.js --phase 2  # Activate tier 2 cities (>50k)
 *   node backend/scripts/rollout-leagues.js --cleanup   # Remove inactive leagues
 *   node backend/scripts/rollout-leagues.js --stats    # Show rollout statistics
 */

const db = require('../db');

const TIER_CONFIG = {
  1: { name: 'Major Cities', minPopulation: 100000, description: 'Cities > 100k' },
  2: { name: 'Large Cities', minPopulation: 50000, description: 'Cities > 50k' },
  3: { name: 'Medium Cities', minPopulation: 10000, description: 'Cities > 10k' },
  4: { name: 'Small Cities', minPopulation: 1000, description: 'Cities > 1k' },
  5: { name: 'Villages', minPopulation: 0, description: 'All remaining' }
};

async function calculateCityTiers() {
  console.log('🏙️  Calculating city tiers based on population...\n');
  
  // For now, use a simple heuristic based on city name/type
  // In production, you'd import real population data
  
  const cities = await db('cities').select('*');
  
  for (const city of cities) {
    let tier = 4; // default
    let estimatedPop = 5000;
    
    // Heuristic: Major cities (you should replace with real data)
    const majorCities = ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 
                         'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden',
                         'Hannover', 'Nürnberg', 'Duisburg', 'Bochum', 'Wuppertal'];
    
    if (majorCities.includes(city.name)) {
      tier = 1;
      estimatedPop = 500000;
    } else if (city.name.includes('stadt') || city.name.length < 5) {
      tier = 5;
      estimatedPop = 2000;
    } else {
      tier = 3;
      estimatedPop = 20000;
    }
    
    await db('cities')
      .where('id', city.id)
      .update({ 
        tier, 
        population: estimatedPop,
        leagues_enabled: tier === 1 // Enable tier 1 by default
      });
  }
  
  const stats = await db('cities')
    .select('tier')
    .count('* as count')
    .groupBy('tier')
    .orderBy('tier');
  
  console.log('City Tiers:');
  stats.forEach(s => {
    const config = TIER_CONFIG[s.tier] || { name: 'Unknown', description: '' };
    console.log(`  Tier ${s.tier} (${config.name}): ${s.count} cities`);
  });
  
  return stats;
}

async function activatePhase(phase) {
  console.log(`\n🚀 Activating Phase ${phase}...\n`);
  
  const tier = parseInt(phase);
  if (!TIER_CONFIG[tier]) {
    console.error('❌ Invalid phase. Use 1-5');
    return;
  }
  
  // Enable leagues for this tier
  const updated = await db('cities')
    .where('tier', tier)
    .update({ leagues_enabled: true });
  
  console.log(`✅ Enabled leagues for ${updated} cities in tier ${tier}`);
  
  // Show which cities were activated
  const cities = await db('cities')
    .where('tier', tier)
    .select('id', 'name', 'population')
    .orderBy('population', 'desc')
    .limit(20);
  
  console.log(`\nTop cities activated (showing max 20):`);
  cities.forEach(c => {
    console.log(`  - ${c.name} (pop: ${c.population?.toLocaleString() || 'N/A'})`);
  });
  
  // Count potential leagues
  const sports = await db('sports').count('* as count');
  const potentialLeagues = updated * sports[0].count;
  
  console.log(`\n📊 Stats:`);
  console.log(`  Cities: ${updated}`);
  console.log(`  Sports: ${sports[0].count}`);
  console.log(`  Potential leagues: ${potentialLeagues.toLocaleString()}`);
  console.log(`\n⚠️  Leagues will be created on-demand when users join`);
}

async function cleanup() {
  console.log('\n🧹 Cleaning up inactive leagues...\n');
  
  // Find leagues with no members
  const emptyLeagues = await db('leagues as l')
    .leftJoin('user_leagues as ul', 'ul.league_id', 'l.id')
    .whereNull('ul.user_id')
    .where('l.status', '!=', 'archived')
    .select('l.id')
    .groupBy('l.id');
  
  console.log(`Found ${emptyLeagues.length} leagues with no members`);
  
  if (emptyLeagues.length > 0) {
    // Mark as archived in batches (SQLite limit: ~999 variables)
    const BATCH_SIZE = 500;
    let archived = 0;
    
    for (let i = 0; i < emptyLeagues.length; i += BATCH_SIZE) {
      const batch = emptyLeagues.slice(i, i + BATCH_SIZE).map(l => l.id);
      const updated = await db('leagues')
        .whereIn('id', batch)
        .update({ status: 'archived' });
      
      archived += updated;
      console.log(`  Archived batch ${Math.floor(i / BATCH_SIZE) + 1}: ${updated} leagues`);
    }
    
    console.log(`✅ Archived ${archived} empty leagues`);
  }
  
  // Delete very old archived leagues (older than 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const deleted = await db('leagues')
    .where('status', 'archived')
    .where(function() {
      this.whereNull('activated_at')
        .orWhere('activated_at', '<', ninetyDaysAgo);
    })
    .delete();
  
  if (deleted > 0) {
    console.log(`🗑️  Deleted ${deleted} old archived leagues`);
  }
}

async function showStats() {
  console.log('\n📊 League Rollout Statistics\n');
  console.log('═'.repeat(60));
  
  // City stats by tier
  const cityStats = await db('cities')
    .select('tier', 'leagues_enabled')
    .count('* as count')
    .groupBy('tier', 'leagues_enabled')
    .orderBy('tier');
  
  console.log('\n🏙️  Cities by Tier:');
  for (let tier = 1; tier <= 5; tier++) {
    const config = TIER_CONFIG[tier];
    const enabled = cityStats.find(s => s.tier === tier && s.leagues_enabled) || { count: 0 };
    const disabled = cityStats.find(s => s.tier === tier && !s.leagues_enabled) || { count: 0 };
    const total = enabled.count + disabled.count;
    
    if (total > 0) {
      console.log(`  Tier ${tier} - ${config.name.padEnd(20)} ${enabled.count}/${total} enabled`);
    }
  }
  
  // League stats
  const leagueStats = await db('leagues')
    .select('status')
    .count('* as count')
    .groupBy('status');
  
  console.log('\n⚽ Leagues by Status:');
  leagueStats.forEach(s => {
    console.log(`  ${s.status.padEnd(15)} ${s.count.toLocaleString()}`);
  });
  
  // Active leagues by city tier
  const activeByTier = await db('leagues as l')
    .join('cities as c', 'c.id', 'l.city_id')
    .where('l.status', 'active')
    .select('c.tier')
    .count('* as count')
    .groupBy('c.tier')
    .orderBy('c.tier');
  
  if (activeByTier.length > 0) {
    console.log('\n🎯 Active Leagues by City Tier:');
    activeByTier.forEach(s => {
      const config = TIER_CONFIG[s.tier];
      console.log(`  Tier ${s.tier} (${config.name}): ${s.count.toLocaleString()}`);
    });
  }
  
  // Total members
  const members = await db('user_leagues').countDistinct('user_id as count');
  console.log(`\n👥 Total Active Members: ${members[0].count}`);
  
  console.log('\n' + '═'.repeat(60));
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
League Rollout Manager

Usage:
  node backend/scripts/rollout-leagues.js [command]

Commands:
  --calculate     Calculate and assign city tiers
  --phase <1-5>   Activate leagues for specific tier
  --cleanup       Archive empty leagues and delete old ones
  --stats         Show rollout statistics
  
Tier System:
  Tier 1: Major cities (>100k) - Launch immediately
  Tier 2: Large cities (>50k)
  Tier 3: Medium cities (>10k)
  Tier 4: Small cities (>1k)
  Tier 5: Villages and small communities

Examples:
  node backend/scripts/rollout-leagues.js --calculate
  node backend/scripts/rollout-leagues.js --phase 1
  node backend/scripts/rollout-leagues.js --stats
    `);
    process.exit(0);
  }
  
  try {
    if (args[0] === '--calculate') {
      await calculateCityTiers();
    } else if (args[0] === '--phase') {
      const phase = args[1];
      if (!phase) {
        console.error('❌ Please specify phase number (1-5)');
        process.exit(1);
      }
      await activatePhase(phase);
    } else if (args[0] === '--cleanup') {
      await cleanup();
    } else if (args[0] === '--stats') {
      await showStats();
    } else {
      console.error('❌ Unknown command:', args[0]);
      process.exit(1);
    }
    
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
