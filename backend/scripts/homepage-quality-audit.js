#!/usr/bin/env node
const puppeteer = require('puppeteer');

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const TIMEOUT = parseInt(process.env.TIMEOUT || '15000', 10);

const ROUTES = [
  { path: '/', label: 'Homepage', expects: [/match\s*league/i] },
  { path: '/login', label: 'Login', expects: [/login/i] },
  { path: '/register', label: 'Register', expects: [/registrieren|register/i] },
  { path: '/leagues', label: 'Leagues', expects: [/ligen|league/i] },
  { path: '/impressum', label: 'Impressum', expects: [/impressum/i] },
  { path: '/datenschutz', label: 'Datenschutz', expects: [/datenschutz/i] },
  { path: '/agb', label: 'AGB', expects: [/nutzungsbedingungen|agb/i] },
  { path: '/meldung-rechtswidriger-inhalte', label: 'Report', expects: [/meldung|rechtswidrig/i] },
];

function colorize(color, text) {
  const map = {
    red: `\x1b[31m${text}\x1b[0m`,
    green: `\x1b[32m${text}\x1b[0m`,
    yellow: `\x1b[33m${text}\x1b[0m`,
    cyan: `\x1b[36m${text}\x1b[0m`,
  };
  return map[color] || text;
}

async function evaluateRoute(page, route) {
  const url = `${BASE_URL.replace(/\/$/, '')}${route.path}`;
  const result = {
    route: route.path,
    label: route.label,
    ok: true,
    status: null,
    checks: [],
    errors: [],
    warnings: [],
  };

  try {
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    result.status = response ? response.status() : null;
    if (!response || !response.ok()) {
      result.ok = false;
      result.errors.push(`HTTP status ${result.status}`);
    }

    await page.waitForSelector('#root', { timeout: 4000 });

    const dom = await page.evaluate(() => {
      const root = document.querySelector('#root');
      const h1 = document.querySelector('h1');
      return {
        rootHasContent: !!(root && root.textContent && root.textContent.trim().length > 20),
        text: (document.body?.innerText || '').slice(0, 5000),
        hasH1: !!h1,
        h1Text: h1 ? h1.textContent : '',
      };
    });

    if (!dom.rootHasContent) {
      result.ok = false;
      result.errors.push('React root has no meaningful content');
    } else {
      result.checks.push('Root content rendered');
    }

    if (!dom.hasH1) {
      result.warnings.push('No H1 found');
    } else {
      result.checks.push(`H1 found: ${String(dom.h1Text || '').trim().slice(0, 80)}`);
    }

    const matchesExpected = (route.expects || []).some((regex) => regex.test(dom.text || ''));
    if (!matchesExpected) {
      result.ok = false;
      result.errors.push('Expected page content not detected');
    } else {
      result.checks.push('Expected content detected');
    }

    if (route.path === '/meldung-rechtswidriger-inhalte') {
      const reportChecks = await page.evaluate(() => {
        const form = document.querySelector('form');
        const requiredSubject = document.querySelector('input[placeholder*="Betreff"]');
        const requiredMessage = document.querySelector('textarea[required]');
        const requiredUserId = document.querySelector('input[type="number"][required]');
        return {
          hasForm: !!form,
          hasRequiredSubject: !!requiredSubject,
          hasRequiredMessage: !!requiredMessage,
          hasRequiredUserId: !!requiredUserId,
        };
      });

      if (!reportChecks.hasForm || !reportChecks.hasRequiredSubject || !reportChecks.hasRequiredMessage || !reportChecks.hasRequiredUserId) {
        result.ok = false;
        result.errors.push('Report form is incomplete (required fields missing)');
      } else {
        result.checks.push('Report form has required subject/message/reported-user-id fields');
      }
    }
  } catch (err) {
    result.ok = false;
    result.errors.push(err && err.message ? err.message : String(err));
  }

  return result;
}

async function run() {
  console.log(colorize('cyan', '\n=== Homepage Quality Audit ==='));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timeout: ${TIMEOUT}ms\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const consoleIssues = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error') {
      consoleIssues.push({ type, text: msg.text() });
    }
  });

  page.on('pageerror', (error) => {
    consoleIssues.push({ type: 'pageerror', text: error.message || String(error) });
  });

  const routeResults = [];
  for (const route of ROUTES) {
    const result = await evaluateRoute(page, route);
    routeResults.push(result);
    const marker = result.ok ? colorize('green', '✓') : colorize('red', '✗');
    console.log(`${marker} ${route.label} (${route.path}) ${result.status ? `HTTP ${result.status}` : ''}`);
  }

  await browser.close();

  const failedRoutes = routeResults.filter((r) => !r.ok);
  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalRoutes: routeResults.length,
    failedRoutes: failedRoutes.length,
    consoleErrors: consoleIssues.length,
    routes: routeResults,
    consoleIssues,
  };

  console.log('\n--- Quality Summary ---');
  console.log(JSON.stringify({
    totalRoutes: summary.totalRoutes,
    failedRoutes: summary.failedRoutes,
    consoleErrors: summary.consoleErrors,
  }, null, 2));

  if (failedRoutes.length) {
    console.log(colorize('red', '\nFailed routes:'));
    failedRoutes.forEach((route) => {
      console.log(colorize('red', `- ${route.route}: ${route.errors.join('; ')}`));
    });
  }

  if (consoleIssues.length) {
    console.log(colorize('yellow', '\nConsole issues detected:'));
    consoleIssues.slice(0, 10).forEach((issue) => {
      console.log(colorize('yellow', `- [${issue.type}] ${issue.text}`));
    });
  }

  if (failedRoutes.length || consoleIssues.length) {
    process.exit(1);
  }

  console.log(colorize('green', '\n✓ Homepage quality audit passed'));
  process.exit(0);
}

run().catch((err) => {
  console.error(colorize('red', `Fatal audit error: ${err && err.message ? err.message : String(err)}`));
  process.exit(2);
});
