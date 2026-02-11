#!/usr/bin/env node
/**
 * Frontend Runtime Check
 * Lädt die Frontend-Seite in einem headless Browser und prüft:
 * - Ob die Seite lädt (keine Network-Fehler)
 * - Ob JavaScript ohne Fehler ausführt
 * - Ob React rendert (root div hat Inhalt)
 * - Ob Console-Errors auftreten
 */

const puppeteer = require('puppeteer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const TIMEOUT = parseInt(process.env.TIMEOUT || '10000', 10);

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

async function checkFrontend() {
  console.log(`\n=== Frontend Runtime Check ===`);
  console.log(`URL: ${FRONTEND_URL}`);
  console.log(`Timeout: ${TIMEOUT}ms\n`);

  const errors = [];
  const warnings = [];
  let browser;

  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Collect console messages
    const consoleLogs = [];
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleLogs.push({ type, text });
      
      if (type === 'error') {
        console.log(colors.red(`  ✗ Console Error: ${text}`));
        errors.push(`Console Error: ${text}`);
      } else if (type === 'warning') {
        console.log(colors.yellow(`  ⚠ Console Warning: ${text}`));
        warnings.push(`Console Warning: ${text}`);
      }
    });

    // Collect page errors
    page.on('pageerror', (error) => {
      console.log(colors.red(`  ✗ Page Error: ${error.message}`));
      errors.push(`Page Error: ${error.message}`);
    });

    // Collect request failures
    page.on('requestfailed', (request) => {
      const failure = `${request.failure().errorText} (${request.url()})`;
      console.log(colors.red(`  ✗ Request Failed: ${failure}`));
      errors.push(`Request Failed: ${failure}`);
    });

    // Navigate to frontend
    console.log(`Loading ${FRONTEND_URL}...`);
    const response = await page.goto(FRONTEND_URL, {
      waitUntil: 'networkidle0',
      timeout: TIMEOUT,
    });

    // Check response status
    if (!response.ok()) {
      errors.push(`HTTP ${response.status()} ${response.statusText()}`);
      console.log(colors.red(`  ✗ HTTP Status: ${response.status()}`));
    } else {
      console.log(colors.green(`  ✓ Page loaded (HTTP ${response.status()})`));
    }

    // Wait a bit for React to render
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if root div exists
    const rootExists = await page.$('#root');
    if (!rootExists) {
      errors.push('Missing <div id="root">');
      console.log(colors.red(`  ✗ Missing <div id="root">`));
    } else {
      console.log(colors.green(`  ✓ Found <div id="root">`));

      // Check if root has content
      const rootContent = await page.evaluate(() => {
        const root = document.getElementById('root');
        return {
          hasChildren: root && root.children.length > 0,
          innerHTML: root ? root.innerHTML.substring(0, 200) : '',
          textContent: root ? root.textContent.substring(0, 100) : '',
        };
      });

      if (!rootContent.hasChildren) {
        errors.push('Root div is empty - React did not render!');
        console.log(colors.red(`  ✗ Root div is empty - React did not render!`));
      } else {
        console.log(colors.green(`  ✓ Root div has content (React rendered)`));
        console.log(`    Preview: ${rootContent.textContent.substring(0, 80).trim()}...`);
      }

      // Check if page is just white (no visible text)
      const hasVisibleText = await page.evaluate(() => {
        return document.body.innerText.trim().length > 0;
      });

      if (!hasVisibleText) {
        warnings.push('Page appears blank (no visible text)');
        console.log(colors.yellow(`  ⚠ Page appears blank (no visible text)`));
      } else {
        console.log(colors.green(`  ✓ Page has visible text`));
      }

      // Check if CSS is applied (check body background color)
      const bodyStyles = await page.evaluate(() => {
        const computed = window.getComputedStyle(document.body);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          fontSize: computed.fontSize,
        };
      });

      console.log(`    Body styles: bg=${bodyStyles.backgroundColor}, color=${bodyStyles.color}`);
      
      // Check if background is white/transparent (could indicate no CSS)
      if (bodyStyles.backgroundColor === 'rgba(0, 0, 0, 0)' || 
          bodyStyles.backgroundColor === 'rgb(255, 255, 255)' ||
          bodyStyles.backgroundColor === 'white') {
        console.log(colors.yellow(`  ⚠ Body background is white/transparent - CSS might not be loaded`));
        warnings.push('Body background is white - CSS might not be fully loaded');
      } else {
        console.log(colors.green(`  ✓ Body has custom background color (CSS applied)`));
      }
    }

    // Summary
    console.log(`\n=== Summary ===`);
    console.log(`Console logs: ${consoleLogs.length}`);
    console.log(`  Errors: ${consoleLogs.filter(l => l.type === 'error').length}`);
    console.log(`  Warnings: ${consoleLogs.filter(l => l.type === 'warning').length}`);

    if (errors.length === 0 && warnings.length === 0) {
      console.log(colors.green(`\n✓ All checks passed - Frontend is working!`));
      process.exit(0);
    } else if (errors.length === 0) {
      console.log(colors.yellow(`\n⚠ No critical errors, but ${warnings.length} warning(s)`));
      process.exit(0);
    } else {
      console.log(colors.red(`\n✗ Found ${errors.length} error(s):`));
      errors.forEach((err, i) => console.log(colors.red(`  ${i + 1}. ${err}`)));
      process.exit(1);
    }

  } catch (error) {
    console.log(colors.red(`\n✗ Fatal Error: ${error.message}`));
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

checkFrontend().catch((error) => {
  console.error(colors.red(`Unhandled error: ${error.message}`));
  process.exit(1);
});
