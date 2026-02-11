#!/usr/bin/env node
/**
 * Init script for Match League backend
 * Ensures dependencies are installed before starting the server
 * This file is require'd before anything else
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backend_dir = __dirname;
const modules_dir = path.join(backend_dir, 'node_modules');
const package_file = path.join(backend_dir, 'package.json');

console.log('[init] Match League Backend initialization...');
console.log('[init] Backend directory:', backend_dir);

// Check if node_modules exists
if (!fs.existsSync(modules_dir)) {
  console.log('[init] node_modules not found, installing dependencies...');
  try {
    execSync('npm install --production', {
      cwd: backend_dir,
      stdio: 'inherit'
    });
    console.log('[init] Dependencies installed successfully');
  } catch (err) {
    console.error('[init] ERROR: Failed to install dependencies');
    console.error(err.message);
    process.exit(1);
  }
}

// Check if package.json exists
if (!fs.existsSync(package_file)) {
  console.error('[init] ERROR: package.json not found in', backend_dir);
  process.exit(1);
}

console.log('[init] Initialization complete, starting server...');
