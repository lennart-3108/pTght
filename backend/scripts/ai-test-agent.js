#!/usr/bin/env node
/*
  AI Test Agent (MVP)
  - Runs configured test/check commands
  - Detects failed runs
  - Creates bug tasks in /api/tasks
  - Optional LLM summary via OpenAI API
*/

const { spawn } = require('child_process');

const DEFAULT_COMMANDS = [
  'npm run check:all',
  'npm run check:homepage-quality',
  'npm --prefix ../frontend run test -- --watchAll=false --passWithNoTests',
  'npm --prefix ../frontend run build',
];

const API_BASE = process.env.AGENT_API_BASE || 'http://127.0.0.1:5001/api';
const TASKS_ENDPOINT = `${API_BASE.replace(/\/$/, '')}/tasks`;
const TOKEN = process.env.AGENT_TOKEN || '';
const DRY_RUN = String(process.env.AGENT_DRY_RUN || '').trim() === '1';
const MAX_OUTPUT_CHARS = Number(process.env.AGENT_MAX_OUTPUT || 6000) || 6000;
const COMMAND_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 12 * 60 * 1000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function parseCommands() {
  const raw = (process.env.AGENT_COMMANDS || '').trim();
  if (!raw) return DEFAULT_COMMANDS;
  return raw
    .split(';')
    .map((cmd) => cmd.trim())
    .filter(Boolean);
}

function limitText(text, max = MAX_OUTPUT_CHARS) {
  const str = String(text || '');
  if (str.length <= max) return str;
  return `${str.slice(0, max)}\n... [truncated ${str.length - max} chars]`;
}

function runCommand(command, timeoutMs = COMMAND_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGTERM'); } catch {}
    }, timeoutMs);

    child.stdout.on('data', (buf) => {
      stdout += buf.toString();
    });

    child.stderr.on('data', (buf) => {
      stderr += buf.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        command,
        code: Number.isFinite(code) ? code : (timedOut ? 124 : 1),
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });
  });
}

function makeBugFingerprint(result) {
  const basis = `${result.command}::${result.code}::${(result.stderr || result.stdout || '').slice(0, 200)}`;
  let hash = 0;
  for (let i = 0; i < basis.length; i += 1) {
    hash = ((hash << 5) - hash) + basis.charCodeAt(i);
    hash |= 0;
  }
  return `autotest-${Math.abs(hash)}`;
}

function buildFallbackTask(result, fingerprint) {
  const mergedOutput = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  const excerpt = limitText(mergedOutput, 2200);
  const title = `[AutoTest] ${result.command} failed (${result.code})`;
  const description = [
    `Fingerprint: ${fingerprint}`,
    `Source: ai-test-agent`,
    `Command: ${result.command}`,
    `Exit code: ${result.code}`,
    `Timed out: ${result.timedOut ? 'yes' : 'no'}`,
    `Duration: ${result.durationMs} ms`,
    '',
    'Observed output:',
    excerpt || '[no output]',
    '',
    'Suggested next step:',
    'Re-run command locally and inspect first failing stack trace / lint error.',
  ].join('\n');

  return {
    title: title.slice(0, 255),
    description,
    type: 'bug',
    status: 'to-do',
  };
}

async function aiSummarizeBug(result, fingerprint) {
  if (!OPENAI_API_KEY || typeof fetch !== 'function') return null;

  const mergedOutput = limitText(`${result.stdout || ''}\n${result.stderr || ''}`, 3500);

  const prompt = [
    'You are a QA triage assistant.',
    'Create a concise bug card from a failed command output.',
    'Return strict JSON with keys: title, description, severity.',
    'title <= 120 chars, description <= 1200 chars, language: German.',
    '',
    `Fingerprint: ${fingerprint}`,
    `Command: ${result.command}`,
    `ExitCode: ${result.code}`,
    `TimedOut: ${result.timedOut}`,
    `DurationMs: ${result.durationMs}`,
    'Output:',
    mergedOutput,
  ].join('\n');

  const body = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'You output only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    if (!parsed?.title || !parsed?.description) return null;

    return {
      title: String(parsed.title).slice(0, 255),
      description: `${String(parsed.description)}\n\nFingerprint: ${fingerprint}`.slice(0, 12000),
      type: 'bug',
      status: 'to-do',
      assignee: null,
    };
  } catch {
    return null;
  }
}

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  return headers;
}

async function fetchExistingBugTitles() {
  if (typeof fetch !== 'function') return [];
  try {
    const res = await fetch(`${TASKS_ENDPOINT}?type=bug`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r) => ({
        title: String(r?.title || ''),
        description: String(r?.description || ''),
      }));
  } catch {
    return [];
  }
}

function alreadyExists(existing, taskPayload, fingerprint) {
  return existing.some((entry) => {
    if (!entry) return false;
    if (entry.title === taskPayload.title) return true;
    return entry.description.includes(fingerprint);
  });
}

async function createTask(taskPayload) {
  if (DRY_RUN) {
    console.log('[DRY_RUN] would create task:', taskPayload.title);
    return { dryRun: true };
  }

  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available in this Node runtime.');
  }

  const res = await fetch(TASKS_ENDPOINT, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(taskPayload),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Task create failed (${res.status}): ${msg}`);
  }

  return res.json();
}

async function main() {
  const commands = parseCommands();
  if (!commands.length) {
    console.log('No commands configured. Set AGENT_COMMANDS="cmd1;cmd2"');
    process.exit(0);
  }

  console.log(`[agent] starting with ${commands.length} command(s)`);
  console.log(`[agent] tasks endpoint: ${TASKS_ENDPOINT}`);
  if (DRY_RUN) console.log('[agent] DRY_RUN enabled');

  const existing = await fetchExistingBugTitles();
  const created = [];

  for (const command of commands) {
    console.log(`\n[agent] run: ${command}`);
    const result = await runCommand(command);
    const summary = `[agent] exit=${result.code} timeout=${result.timedOut} duration=${result.durationMs}ms`;
    console.log(summary);

    if (result.code === 0) continue;

    const fingerprint = makeBugFingerprint(result);
    const fallback = buildFallbackTask(result, fingerprint);
    const aiTask = await aiSummarizeBug(result, fingerprint);
    const taskPayload = aiTask || fallback;

    if (alreadyExists(existing, taskPayload, fingerprint)) {
      console.log(`[agent] skip duplicate bug: ${taskPayload.title}`);
      continue;
    }

    try {
      const task = await createTask(taskPayload);
      created.push(task || taskPayload);
      existing.push({ title: taskPayload.title, description: taskPayload.description || '' });
      console.log(`[agent] bug task created: ${taskPayload.title}`);
    } catch (err) {
      console.error('[agent] failed to create bug task:', err.message || err);
    }
  }

  console.log(`\n[agent] done. created=${created.length}`);
}

main().catch((err) => {
  console.error('[agent] fatal:', err && (err.stack || err.message || err));
  process.exit(1);
});
