#!/usr/bin/env node

const { spawn } = require('child_process');

const intervalMs = Number(process.env.AGENT_INTERVAL_MS || 5 * 60 * 1000);
const maxRuns = Number(process.env.AGENT_MAX_RUNS || 0);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/ai-test-agent.js'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      resolve(Number.isFinite(code) ? code : 1);
    });
  });
}

async function main() {
  console.log(`[agent-daemon] started, interval=${intervalMs}ms`);
  let run = 0;

  while (true) {
    run += 1;
    const started = Date.now();
    console.log(`\n[agent-daemon] cycle ${run} started`);
    const code = await runOnce();
    const duration = Date.now() - started;
    console.log(`[agent-daemon] cycle ${run} finished code=${code} duration=${duration}ms`);

    if (maxRuns > 0 && run >= maxRuns) {
      console.log(`[agent-daemon] AGENT_MAX_RUNS reached (${maxRuns}), exiting.`);
      process.exit(code === 0 ? 0 : 1);
    }

    await sleep(intervalMs);
  }
}

main().catch((err) => {
  console.error('[agent-daemon] fatal:', err && (err.stack || err.message || err));
  process.exit(1);
});
