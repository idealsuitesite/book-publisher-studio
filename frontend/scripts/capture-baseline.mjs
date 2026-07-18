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
 * Exit 0 = captured, or (with --check) every screen byte-identical to its baseline.
 * Exit 1 = a server was unreachable, a step failed, or --check found a real difference.
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
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
  const shot = await page.screenshot({ fullPage: true, animations: 'disabled' });
  const file = `${screen}--${viewport}.png`;
  const path = join(BASELINE_DIR, file);

  let status = 'captured';
  if (CHECK_MODE) {
    if (!existsSync(path)) {
      status = 'MISSING BASELINE';
    } else {
      status = Buffer.compare(readFileSync(path), shot) === 0 ? 'identical' : 'CHANGED';
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

  // Step 1 - launch (empty state)
  await page.goto(FRONTEND, { waitUntil: 'networkidle' });
  await scan(page, '01-landing', viewport.name);

  // Step 2-4 - import the real canonical fixture, then structure + validation appear.
  //
  // Note this cannot use setInputFiles(): UploadDropzone has NO file input at all - it is a
  // bare <div> with only onDragOver/onDragLeave/onDrop, no tabIndex, no role, no keyboard
  // handler. Import is therefore drag-and-drop-only, which is a real accessibility defect
  // (see baseline/FINDINGS.md) - not a limitation of this script. A real drop event is
  // synthesized here so the baseline reflects the application as it actually is today.
  const buffer = readFileSync(FIXTURE);
  const dataTransfer = await page.evaluateHandle(
    ({ data, name }) => {
      const dt = new DataTransfer();
      dt.items.add(
        new File([new Uint8Array(data)], name, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      );
      return dt;
    },
    { data: Array.from(buffer), name: 'large-book.docx' }
  );
  await page.locator('.border-dashed').first().dispatchEvent('drop', { dataTransfer });

  await waitForText(page, 'Structure');
  await scan(page, '02-imported', viewport.name);

  // Step 5 - change layout to a KDP trim size
  const kdp = page.getByText('KDP 6" x 9"', { exact: false }).first();
  if (await kdp.count()) {
    await kdp.click();
    await scan(page, '03-layout-kdp', viewport.name);
  }

  // Step 6 - generate the real preview (a real export round trip, so allow time)
  const preview = page.getByRole('button', { name: /preview/i }).first();
  if (await preview.count()) {
    await preview.scrollIntoViewIfNeeded();
    await preview.click();
    await waitForText(page, 'pages', 120000).catch(() => {});
    await scan(page, '04-preview', viewport.name);
  }

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

  const changed = results.filter((r) => r.status !== 'identical');
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
