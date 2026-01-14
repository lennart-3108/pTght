// Test Comment API
const API_BASE = 'http://localhost:5001/api';
const gameId = 1;

console.log('Testing Comment API...');

// Test 1: GET comments
fetch(`${API_BASE}/matches/${gameId}/comments`)
  .then(r => r.json())
  .then(data => console.log('GET comments:', data))
  .catch(err => console.error('GET comments error:', err));

// Test 2: GET likes
fetch(`${API_BASE}/matches/${gameId}/likes`)
  .then(r => r.json())
  .then(data => console.log('GET likes:', data))
  .catch(err => console.error('GET likes error:', err));

console.log('Tests gestartet - prüfe Console für Ergebnisse');
