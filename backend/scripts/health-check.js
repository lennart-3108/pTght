#!/usr/bin/env node
/**
 * Health Check & Smoke Test
 * Tests all critical endpoints and pages
 */

const http = require('http');
const https = require('https');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testRequest(url, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'User-Agent': 'HealthCheck/1.0',
        ...headers
      },
      timeout: 10000
    };

    const lib = urlObj.protocol === 'https:' ? https : http;
    
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 400,
          statusCode: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testEndpoint(name, url, expectedStatus = 200, headers = {}) {
  const startTime = Date.now();
  const result = await testRequest(url, 'GET', headers);
  const duration = Date.now() - startTime;

  if (result.success && (expectedStatus === null || result.statusCode === expectedStatus)) {
    results.passed.push({ name, url, duration });
    log(`  ✓ ${name} (${duration}ms)`, 'green');
    return true;
  } else {
    results.failed.push({ name, url, error: result.error || `Status ${result.statusCode}`, duration });
    log(`  ✗ ${name} - ${result.error || `Expected ${expectedStatus}, got ${result.statusCode}`} (${duration}ms)`, 'red');
    return false;
  }
}

async function runTests() {
  log('\n🔍 Starting Health Check & Smoke Tests\n', 'blue');
  log(`Backend:  ${BACKEND_URL}`, 'gray');
  log(`Frontend: ${FRONTEND_URL}\n`, 'gray');

  // ========== BACKEND TESTS ==========
  log('📡 Backend API Tests:', 'yellow');
  
  await testEndpoint('Health Check', `${BACKEND_URL}/healthz`);
  
  // Admin route test - should return 401 or redirect, but endpoint exists
  const adminTest = await testRequest(`${BACKEND_URL}/admin/stats`, 'GET', { 
    Authorization: 'Bearer invalid-token-for-test' 
  });
  if (adminTest.statusCode === 401 || adminTest.statusCode === 403 || adminTest.statusCode === 200) {
    results.passed.push({ name: 'Admin Endpoint Available', url: `${BACKEND_URL}/admin/stats`, duration: 0 });
    log(`  ✓ Admin Endpoint Available`, 'green');
  } else {
    results.failed.push({ name: 'Admin Endpoint Available', url: `${BACKEND_URL}/admin/stats`, error: `Status ${adminTest.statusCode}` });
    log(`  ✗ Admin Endpoint Available - Status ${adminTest.statusCode}`, 'red');
  }
  
  await testEndpoint('Sports Categories', `${BACKEND_URL}/api/sports/categories`);
  await testEndpoint('Leagues List', `${BACKEND_URL}/api/leagues`);
  await testEndpoint('Locations List', `${BACKEND_URL}/api/locations`);
  
  // ========== FRONTEND TESTS ==========
  log('\n🌐 Frontend Page Tests:', 'yellow');
  
  await testEndpoint('Home Page', `${FRONTEND_URL}/`);
  
  // React Router - check if React app responds (dev server might be different)
  const reactTest = await testRequest(`${FRONTEND_URL}/login`);
  if (reactTest.success || reactTest.statusCode === 404) {
    // 404 is OK in dev mode with React Router, index.html still served
    results.passed.push({ name: 'Frontend Server Running', url: FRONTEND_URL, duration: 0 });
    log(`  ✓ Frontend Server Running`, 'green');
  } else {
    results.failed.push({ name: 'Frontend Server Running', url: FRONTEND_URL, error: reactTest.error });
    log(`  ✗ Frontend Server Running - ${reactTest.error}`, 'red');
  }
  
  // Static Assets - React creates these in build
  log('\n📦 Static Assets Tests:', 'yellow');
  const homeResponse = await testRequest(`${FRONTEND_URL}/`);
  if (homeResponse.data && homeResponse.data.includes('root')) {
    results.passed.push({ name: 'React App Loaded', url: FRONTEND_URL, duration: 0 });
    log(`  ✓ React App Loaded`, 'green');
  } else {
    results.failed.push({ name: 'React App Loaded', url: FRONTEND_URL, error: 'No React root found' });
    log(`  ✗ React App Loaded - No React root found`, 'red');
  }

  // ========== RESULTS SUMMARY ==========
  log('\n' + '='.repeat(60), 'blue');
  log('📊 Test Summary\n', 'blue');
  
  if (results.passed.length > 0) {
    log(`✓ Passed: ${results.passed.length}`, 'green');
    const avgDuration = Math.round(results.passed.reduce((sum, r) => sum + r.duration, 0) / results.passed.length);
    log(`  Average response time: ${avgDuration}ms\n`, 'gray');
  }

  if (results.failed.length > 0) {
    log(`✗ Failed: ${results.failed.length}`, 'red');
    results.failed.forEach(f => {
      log(`  - ${f.name}: ${f.error}`, 'red');
    });
    log('');
  }

  if (results.warnings.length > 0) {
    log(`⚠ Warnings: ${results.warnings.length}`, 'yellow');
    results.warnings.forEach(w => {
      log(`  - ${w.name}: ${w.message}`, 'yellow');
    });
    log('');
  }

  const totalTests = results.passed.length + results.failed.length;
  const successRate = Math.round((results.passed.length / totalTests) * 100);
  
  log('='.repeat(60), 'blue');
  log(`Success Rate: ${successRate}%\n`, successRate === 100 ? 'green' : 'yellow');

  // Check critical failures
  const criticalEndpoints = ['Health Check', 'Home Page', 'Sports List'];
  const criticalFailures = results.failed.filter(f => criticalEndpoints.includes(f.name));
  
  if (criticalFailures.length > 0) {
    log('⚠️  CRITICAL: Essential endpoints are failing!', 'red');
    process.exit(1);
  }

  if (results.failed.length > 0) {
    log('⚠️  Some tests failed, but system is operational', 'yellow');
    process.exit(0);
  }

  log('✅ All tests passed!', 'green');
  process.exit(0);
}

// Run tests
runTests().catch(err => {
  log(`\n❌ Test runner crashed: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
