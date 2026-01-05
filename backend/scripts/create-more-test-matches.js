#!/usr/bin/env node
/**
 * Create more test open matches with various time ranges
 * Usage: AUTH_TOKEN=<token> node backend/scripts/create-more-test-matches.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('Error: AUTH_TOKEN environment variable is required');
  console.error('Usage: AUTH_TOKEN=<your-token> node backend/scripts/create-more-test-matches.js');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`
};

const matches = [
  // Tennis Einzel (16) in Hamburg (5)
  {
    sportId: 16,
    cityId: 5,
    when_type: 'range',
    range_days: 3,
    description: 'Tennis Einzel, Hamburg, nächste 3 Tage'
  },
  {
    sportId: 16,
    cityId: 5,
    when_type: 'range',
    range_days: 14,
    description: 'Tennis Einzel, Hamburg, nächste 14 Tage'
  },
  {
    sportId: 16,
    cityId: 5,
    when_type: 'fixed',
    kickoff_at: '2026-01-15T10:00:00Z',
    kickoff_end_at: '2026-01-25T18:00:00Z',
    description: 'Tennis Einzel, Hamburg, 15.1.-25.1.'
  },
  // Badminton (17) in München (1)
  {
    sportId: 17,
    cityId: 1,
    when_type: 'range',
    range_days: 5,
    description: 'Badminton, München, nächste 5 Tage'
  },
  {
    sportId: 17,
    cityId: 1,
    when_type: 'fixed',
    kickoff_at: '2026-02-01T09:00:00Z',
    kickoff_end_at: '2026-02-10T20:00:00Z',
    description: 'Badminton, München, 1.2.-10.2.'
  },
  // Tischtennis (18) in Berlin (2)
  {
    sportId: 18,
    cityId: 2,
    when_type: 'range',
    range_days: 10,
    description: 'Tischtennis, Berlin, nächste 10 Tage'
  },
  {
    sportId: 18,
    cityId: 2,
    when_type: 'exact',
    kickoff_at: '2026-01-20T15:00:00Z',
    description: 'Tischtennis, Berlin, exakt 20.1. 15:00'
  }
];

async function createMatches() {
  console.log(`Creating ${matches.length} test matches...`);
  
  for (const match of matches) {
    const { description, ...data } = match;
    
    // Calculate kickoff_at for range type
    if (data.when_type === 'range' && !data.kickoff_at) {
      data.kickoff_at = new Date().toISOString();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + data.range_days);
      data.kickoff_end_at = endDate.toISOString();
    }
    
    try {
      const response = await axios.post(`${BASE_URL}/open-matches`, data, { headers });
      console.log(`✓ ${description} (ID: ${response.data.id})`);
    } catch (error) {
      console.error(`✗ ${description}:`);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Error: ${JSON.stringify(error.response.data)}`);
      } else {
        console.error(`  ${error.message}`);
      }
    }
  }
  
  console.log('\nDone!');
}

createMatches().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
