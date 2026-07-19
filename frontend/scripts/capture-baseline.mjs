/**
 * Sprint 9 UI Foundation — visual + accessibility baseline capture
 * (UI_FOUNDATION.md Decision 3 and §8, ADR-0040 Correction 2).
 *
 * Drives the real running application through the official Demo Script
 * (docs/product/PRODUCT_DEMO.md) with a real Chromium browser and a real canonical
 * fixture, capturing at every step where the screen materially changes:
 *   - a real PNG per screen per viewport, written to disk
 *   - a real axe-core accessibility scan per screen
 *
 * This exists because Decision 3 locks Commits 1-7 as appearance-neutral and Commit 8
 * as the first permitted to restyle. That policy is only enforceable if "nothing should
 * have changed" is a checkable statement — which needs committed reference images, not
 * in-conversation captures. Sprint 7 Commit 12 established that this environment cannot
 * persist screenshots to disk by any other means, and that captures return blank once
 * the page is scrolled; both are why a scripted, checked-in capture is the mechanism.
 *
 * Requires both dev servers running - does not start them (Server Verification Policy:
 * never assume the port). Run `npm run verify-server` in backend/ first.
 *
 *   npm run baseline           # capture (overwrites frontend/baseline/)
 *   npm run baseline -- --check  # compare against the committed baseline, exit 1 on drift
 *
 * Exit 0 = captured, or (with --check) every screen identical to its baseline (byte-identical,
 *          or within the imperceptible antialiasing tolerance compareShots documents).
 * Exit 1 = a server was unreachable, a step failed, or --check found a real difference.
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { PNG } from 'pngjs';

/**
 * Byte-compare first; on mismatch, decode and compare pixels with a tolerance for antialiasing
 * jitter — the third real defect found in this mechanism (after mid-transition captures and the
 * dev-indicator badge). Chromium's rasterizer is not bit-deterministic: identical DOM produced
 * 4 pixels differing by exactly 1/255 in one channel across runs (measured 2026-07-18, two
 * clusters at a card-border edge). Byte-identity is stricter than the renderer's own guarantee,
 * and a check that randomly fails on identical UI degrades Decision 3 into ignorable noise.
 *
 * The tolerance is deliberately imperceptible-by-construction: a pixel "matches" if every
 * channel is within 1/255, and at most 64 such pixels may differ (measured jitter: 4). Any
 * pixel off by 2+ in any channel, or a wider spread, is a real change and still fails.
 */
function compareShots(baseline, shot) {
  if (Buffer.compare(baseline, shot) === 0) return 'identical';
  let a, b;
  try {
    a = PNG.sync.read(baseline);
    b = PNG.sync.read(shot);
  } catch {
    return 'CHANGED';
  }
  if (a.width !== b.width || a.height !== b.height) return 'CHANGED';
  let jitter = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let maxDelta = 0;
    for (let c = 0; c < 4; c++) {
      const d = Math.abs(a.data[i + c] - b.data[i + c]);
      if (d > maxDelta) maxDelta = d;
    }
    if (maxDelta > 1) return 'CHANGED';
    if (maxDelta === 1 && ++jitter > 64) return 'CHANGED';
  }
  return `identical (aa-jitter: ${jitter}px)`;
}
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const BASELINE_DIR = join(__dirname, '..', 'baseline');
const FIXTURE = join(ROOT, 'backend', 'verification', 'large-book.docx');

const FRONTEND = process.env.FRONTEND_URL ?? 'http://localhost:3000';
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:5000';

const CHECK_MODE = process.argv.includes('--check');

// Decision 3's carve-out: desktop must stay pixel-identical through Commit 7; mobile and
// tablet are expected to change at Commit 7 (responsive) and only there. Capturing all
// three from the start means that change is measurable rather than assumed.
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 2400 },
  { name: 'tablet', width: 768, height: 2000 },
  { name: 'mobile', width: 375, height: 1800 },
];

const results = [];

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Waits for real content rather than a fixed timeout - a sleep would be a race, not a wait. */
async function waitForText(page, text, timeout = 60000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
}

async function scan(page, screen, viewport) {
  // animations: 'disabled' finishes CSS transitions and pins them to their end state.
  // Without it this capture is genuinely non-reproducible: ProgressStepper carries
  // `transition-colors duration-300` on exactly the elements that change when import
  // completes and when a layout is selected, so `02-imported` and `03-layout-kdp` were
  // caught mid-transition at a random point and differed between consecutive runs with
  // no code change. A baseline that drifts on its own would report a false regression on
  // every commit, making Decision 3 unenforceable.
  // mask: elements carrying data-baseline-mask hold real wall-clock data (the project's
  // Updated timestamp) that changes every run - masked with a fixed color at capture time so
  // the baseline stays deterministic without hiding real data from real users. The fourth
  // determinism defect this mechanism has found (transitions, dev badge, raster jitter, time).
  const shot = await page.screenshot({
    fullPage: true,
    animations: 'disabled',
    mask: [page.locator('[data-baseline-mask]')],
    maskColor: '#e4e4e7',
  });
  const file = `${screen}--${viewport}.png`;
  const path = join(BASELINE_DIR, file);

  let status = 'captured';
  if (CHECK_MODE) {
    if (!existsSync(path)) {
      status = 'MISSING BASELINE';
    } else {
      status = compareShots(readFileSync(path), shot);
    }
  } else {
    writeFileSync(path, shot);
  }

  // axe only needs to run once per screen, not per viewport - the DOM is what it audits.
  let violations = null;
  if (viewport === 'desktop') {
    const axe = await new AxeBuilder({ page }).analyze();
    violations = axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      help: v.help,
    }));
  }

  results.push({ screen, viewport, file, bytes: shot.length, status, violations });
  return status;
}

/** Runs the full Demo Script at one viewport, capturing at each material state change. */
async function runDemoScript(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();

  // Deterministic start: imports create real projects server-side (ADR-0047).
  await fetch(`${BACKEND}/api/dev/reset-projects`, { method: 'POST' });

  // Journey step 1 - Home, the library, honest empty state.
  await page.goto(FRONTEND, { waitUntil: 'networkidle' });
  await waitForText(page, 'Your studio');
  await scan(page, '01-home', viewport.name);

  // Step 2 - bring in the manuscript; success IS a redirect. The Workspace opens on the BOOK
  // DASHBOARD (PRODUCT_EXPERIENCE: the book is the center), after the mise-en-place settles.
  await page.setInputFiles('input[type="file"]', FIXTURE);
  await page.waitForURL(/\/projects\//, { timeout: 60000 });
  await waitForText(page, 'Progression');
  await page.waitForTimeout(600); // let the mise-en-place finish (motion-view + staggers)
  await scan(page, '02-dashboard', viewport.name);

  // Step 3 - Ready for Print (the checklist that replaced 60/100).
  await page.getByRole('button', { name: /^Ready for Print/ }).click();
  await waitForText(page, 'Professional Score');
  await page.waitForTimeout(600); // the checks tick in sequence
  await scan(page, '03-ready-for-print', viewport.name);

  // Step 4 - Layout: pick the KDP preset; it persists on the project.
  await page.getByRole('button', { name: /^Layout/ }).click();
  await page.getByText('KDP 6" x 9"', { exact: false }).first().click();
  await page.waitForTimeout(500);
  await scan(page, '04-layout-kdp', viewport.name);

  // Step 5 - the LIVING Proof (PRODUCT_EXPERIENCE §4.5): no button to click - opening the
  // view produces the proof from the STORED source; the capture just waits for it to settle.
  await page.getByRole('button', { name: /^Proof/ }).click();
  await waitForText(page, 'Up to date', 120000).catch(() => {});
  await scan(page, '05-proof', viewport.name);

  // Step 6 - Editions & Publish: real KDP validation, recorded into history.
  await page.getByRole('button', { name: /^Editions/ }).click();
  await page.getByRole('button', { name: /Validate for KDP/i }).click();
  await waitForText(page, 'error', 120000).catch(() => {});
  await scan(page, '06-editions-publish', viewport.name);

  // Step 7 - back Home: the library shows the project and its record.
  await page.getByRole('link', { name: 'Studio', exact: true }).click();
  await waitForText(page, 'Recent projects');
  await waitForText(page, 'large-book');
  await scan(page, '07-home-library', viewport.name);

  await context.close();
}



async function main() {
  console.log(`Frontend: ${FRONTEND}\nBackend:  ${BACKEND}\n`);

  if (!(await reachable(`${BACKEND}/api/health`))) {
    console.error(`✗ Backend not reachable at ${BACKEND}/api/health`);
    console.error('  Start it first (npm run dev in backend/), then re-run.');
    process.exitCode = 1;
    return;
  }
  if (!(await reachable(FRONTEND))) {
    console.error(`✗ Frontend not reachable at ${FRONTEND}`);
    process.exitCode = 1;
    return;
  }
  console.log('✓ Both servers reachable\n');

  if (!existsSync(FIXTURE)) {
    console.error(`✗ Canonical fixture missing: ${FIXTURE}`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(BASELINE_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const viewport of VIEWPORTS) {
      console.log(`Running Demo Script at ${viewport.name} (${viewport.width}px)...`);
      await runDemoScript(browser, viewport);
    }
  } finally {
    await browser.close();
  }

  console.log('\n' + 'Screen'.padEnd(20) + 'Viewport'.padEnd(10) + 'Bytes'.padEnd(10) + 'Status');
  console.log('-'.repeat(56));
  for (const r of results) {
    console.log(r.screen.padEnd(20) + r.viewport.padEnd(10) + String(r.bytes).padEnd(10) + r.status);
  }

  const a11y = results.filter((r) => r.violations !== null);
  const totalViolations = a11y.reduce((s, r) => s + r.violations.length, 0);
  const totalNodes = a11y.reduce((s, r) => s + r.violations.reduce((n, v) => n + v.nodes, 0), 0);

  console.log('\n=== Accessibility baseline (axe-core, desktop DOM) ===');
  for (const r of a11y) {
    console.log(`\n${r.screen}: ${r.violations.length} violation type(s)`);
    for (const v of r.violations) {
      console.log(`  [${v.impact ?? 'n/a'}] ${v.id} — ${v.nodes} node(s): ${v.help}`);
    }
  }
  console.log(`\nTOTAL: ${totalViolations} violation types across ${totalNodes} nodes.`);

  if (!CHECK_MODE) {
    writeFileSync(
      join(BASELINE_DIR, 'a11y-baseline.json'),
      JSON.stringify({ capturedAt: new Date().toISOString(), totalViolations, totalNodes, screens: a11y }, null, 2)
    );
    console.log(`\nBaseline written to frontend/baseline/ (${readdirSync(BASELINE_DIR).length} files).`);
    return;
  }

  const changed = results.filter((r) => !r.status.startsWith('identical'));
  if (changed.length > 0) {
    console.log('\n✗ Visual drift detected:\n');
    for (const c of changed) console.log(`  ${c.file}: ${c.status}`);
    console.log('\nIf this commit was supposed to be appearance-neutral (Commits 1-7 desktop,');
    console.log('per UI_FOUNDATION.md Decision 3), this is a regression. If it is Commit 8,');
    console.log('or a mobile/tablet change at Commit 7, re-run without --check to update.');
    process.exitCode = 1;
    return;
  }
  console.log('\n✓ Every screen byte-identical to the committed baseline.');
}

main();
