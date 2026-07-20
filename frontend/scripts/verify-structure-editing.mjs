/**
 * verify-structure-editing — the real-gesture proof for manual structure editing Phase 3
 * (STRUCTURE_EDITING_PHASE3.md commit 8, Q5). Repeatable, unlike a one-time manual capture.
 *
 * jsdom cannot drive @dnd-kit's coordinate pipeline and the headless Browser pane's synthetic drag
 * doesn't stream faithful pointer events (§3bis). Playwright's real mouse DOES — so this is where the
 * drag GESTURE (not just the handler logic) is proven: it imports the real 17-chapter corpus book,
 * drags a chapter to the top through the actual UI, and asserts the order changed, persisted a
 * version, survived a reload, and reached the backend. It also runs axe on the editor.
 *
 * Requires both dev servers running (Server Verification Policy — never assume the port):
 *   backend on :5000, frontend on :3000. Then:  node scripts/verify-structure-editing.mjs
 * Exit 0 = every assertion held. Exit 1 = a server was unreachable or an assertion failed.
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'http://localhost:5000';
const APP = 'http://localhost:3000';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'backend', 'verification', 'corpus', 'faith-alone-styled.docx');

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function seedProject() {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(CORPUS)], { type: DOCX_MIME }), 'faith-alone-styled.docx');
  const res = await fetch(`${API}/api/manuscripts/import`, { method: 'POST', body: fd });
  const json = await res.json();
  if (!json.projectId) throw new Error(`import failed: ${res.status}`);
  return json.projectId;
}

const orderOf = async (id) => (await (await fetch(`${API}/api/projects/${id}`)).json()).book.mainContent.map((c) => c.title);

async function main() {
  const projectId = await seedProject();
  console.log(`Seeded project ${projectId} from the real corpus.`);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext(); // AxeBuilder requires a page from an explicit context
    const page = await context.newPage();
    await page.goto(`${APP}/projects/${projectId}`, { waitUntil: 'networkidle' });
    await page.keyboard.press('Control+2'); // -> Structure station
    await page.waitForSelector('button[aria-label^="Reorder "]');

    // Source of truth for order is the backend book (the DOM renumbers the "Chapter N:" prefix on
    // reorder, so titles — not labels — are the stable identity).
    const before = await orderOf(projectId);
    const movedTitle = before[2]; // the 3rd item (index 0 is the leading Untitled section)
    console.log('  before[0..3]:', before.slice(0, 4).map((t) => t || '«untitled»').join(' | '));

    // Grab the 3rd row's handle and drag it up over the rows above it — a real streamed gesture.
    const src = page.locator('button[aria-label^="Reorder "]').nth(2);
    const dst = page.locator('button[aria-label^="Reorder "]').nth(0);
    const sb = await src.boundingBox();
    const db = await dst.boundingBox();
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(80); // let dnd-kit register the press
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2 - 10, { steps: 5 }); // lift
    await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2, { steps: 25 }); // travel up
    await page.waitForTimeout(100);
    await page.mouse.up();

    // The reorder is server-authoritative: poll the backend until the order actually changes.
    let after = before;
    for (let i = 0; i < 40 && after.join('||') === before.join('||'); i++) {
      await page.waitForTimeout(150);
      after = await orderOf(projectId);
    }
    console.log('  after[0..3]: ', after.slice(0, 4).map((t) => t || '«untitled»').join(' | '));

    assert(after.join('||') !== before.join('||'), 'the real drag changed the stored chapter order');
    assert(after.indexOf(movedTitle) < before.indexOf(movedTitle), `the dragged chapter ("${movedTitle}") moved earlier`);
    assert(after.indexOf(movedTitle) < after.indexOf('INTRODUCTION'), 'it now precedes the chapter it was dragged above');

    const proj = await (await fetch(`${API}/api/projects/${projectId}`)).json();
    assert(proj.versions.length === 1, 'exactly one snapshot was taken (the pre-edit version, for undo)');

    // Survives a reload — proves it is the stored book, not local state.
    await page.reload({ waitUntil: 'networkidle' });
    await page.keyboard.press('Control+2');
    await page.waitForSelector('button[aria-label^="Reorder "]');
    const domTitles = await page.$$eval('span.font-medium button[aria-label^="Rename "]', (els) => els.map((e) => e.textContent));
    assert(domTitles.includes(movedTitle) && domTitles.indexOf(movedTitle) < domTitles.indexOf('INTRODUCTION'),
      'the reordered book renders in the new order after a reload');

    // Accessibility of the editor.
    const axe = await new AxeBuilder({ page }).include('section[aria-label="Structure"]').analyze();
    const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    assert(serious.length === 0, `no serious/critical axe violations on the editor (found ${serious.length}: ${serious.map((v) => v.id).join(', ')})`);

    console.log('\nPASS — the real drag gesture reorders, persists across reload, snapshots for undo, and is accessible.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`\nFAIL — ${err.message}`);
  process.exit(1);
});
