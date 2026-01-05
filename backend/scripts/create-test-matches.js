#!/usr/bin/env node

// Create additional test matches via API
const API_BASE = 'http://localhost:5001/api';

async function createMatch(data) {
  const token = process.env.TOKEN || '';
  const resp = await fetch(`${API_BASE}/open-matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!resp.ok) {
    const error = await resp.json().catch(() => ({}));
    throw new Error(`Failed: ${error.error || resp.statusText}`);
  }
  
  return resp.json();
}

async function main() {
  // Get Tennis Einzel ID (16) and Bremen city ID
  const sportsResp = await fetch(`${API_BASE}/sports/list`);
  const sports = await sportsResp.json();
  const tennisEinzel = sports.find(s => s.name === 'Tennis Einzel');
  
  const citiesResp = await fetch(`${API_BASE}/cities/list`);
  const cities = await citiesResp.json();
  const bremen = cities.find(c => c.name === 'Bremen');
  
  if (!tennisEinzel || !bremen) {
    console.log('Tennis Einzel or Bremen not found');
    return;
  }
  
  console.log(`Creating matches for Tennis Einzel (${tennisEinzel.id}) in Bremen (${bremen.id})`);
  
  const now = new Date();
  
  // Additional test matches
  const matches = [
    // 3 days range
    {
      sportId: tennisEinzel.id,
      cityId: bremen.id,
      when_type: 'range',
      range_days: 3,
      kickoff_at: now.toISOString(),
      kickoff_end_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    // 14 days range
    {
      sportId: tennisEinzel.id,
      cityId: bremen.id,
      when_type: 'range',
      range_days: 14,
      kickoff_at: now.toISOString(),
      kickoff_end_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
    },
    // Fixed: 10.02 - 15.03
    {
      sportId: tennisEinzel.id,
      cityId: bremen.id,
      when_type: 'fixed',
      kickoff_at: new Date('2026-02-10T14:00:00').toISOString(),
      kickoff_end_at: new Date('2026-03-15T18:00:00').toISOString()
    },
    // Exact: Tomorrow 15:00
    {
      sportId: tennisEinzel.id,
      cityId: bremen.id,
      when_type: 'exact',
      kickoff_at: new Date(now.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000).toISOString()
    }
  ];
  
  for (const match of matches) {
    try {
      const result = await createMatch(match);
      console.log(`✓ Created match ${result.id}`);
    } catch (e) {
      console.error(`✗ Failed:`, e.message);
    }
  }
}

main().catch(console.error);
