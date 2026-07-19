/**
 * The CTO's calibration set (VISUAL_LANGUAGE §9): Home + Book dashboard + Ready for Print,
 * light AND dark, unmasked — the CTO calibrates by naming feelings on these images.
 * Writes to docs/demo/screenshots/atelier/. Not part of the baseline; run on demand.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const OUT = join(ROOT, 'docs', 'demo', 'screenshots', 'atelier');
mkdirSync(OUT, { recursive: true });
const FIXTURE = join(ROOT, 'backend', 'verification', 'large-book.docx');

const browser = await chromium.launch();

for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: scheme,
  });
  const page = await context.newPage();
  await fetch('http://localhost:5000/api/dev/reset-projects', { method: 'POST' });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.getByText('Your studio').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: join(OUT, `home-${scheme}.png`), animations: 'disabled' });

  await page.setInputFiles('input[type="file"]', FIXTURE);
  await page.waitForURL(/\/projects\//, { timeout: 60000 });
  await page.getByText('Progression').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, `dashboard-${scheme}.png`), animations: 'disabled' });

  await page.getByRole('button', { name: /^Ready for Print/ }).click();
  await page.getByText('Professional Score').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `ready-for-print-${scheme}.png`), animations: 'disabled' });

  await context.close();
  console.log(`${scheme}: 3 shots`);
}
await browser.close();
console.log('calibration set written to docs/demo/screenshots/atelier/');
