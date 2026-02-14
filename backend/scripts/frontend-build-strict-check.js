#!/usr/bin/env node

const { spawn } = require('child_process');

const child = spawn('npm', ['--prefix', '../frontend', 'run', 'build'], {
  shell: true,
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let combined = '';

child.stdout.on('data', (buf) => {
  const text = String(buf || '');
  combined += text;
  process.stdout.write(text);
});

child.stderr.on('data', (buf) => {
  const text = String(buf || '');
  combined += text;
  process.stderr.write(text);
});

child.on('close', (code) => {
  const output = combined.toLowerCase();
  const hasWarnings = output.includes('compiled with warnings') || output.includes('[eslint]');

  if (Number(code) !== 0) {
    process.exit(Number(code) || 1);
    return;
  }

  if (hasWarnings) {
    console.error('\n[strict-check] Frontend build finished with warnings -> treating as failure.');
    process.exit(2);
    return;
  }

  console.log('\n[strict-check] Frontend build is clean (no warnings).');
  process.exit(0);
});
