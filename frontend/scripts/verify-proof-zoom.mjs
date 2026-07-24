// INCREMENTAL_RENDER (P1, commit 7) — real-Chromium regression guard for the Proof ZOOM (the founder
// taste-stop regression: fit-width was "static"). It drives the REAL studio layout, because the defect
// only exists there: a zoomed page's width propagated as min-content up the studio's flex chain (the
// max-w-2xl Card, the items-start centre column — neither clips), inflating the scroll box's clientWidth,
// so fit-width recomputed from a stale, INFLATED width. The original harness missed it by wrapping
// PdfProof in a FIXED-width div, which pinned clientWidth — so it never measured the thing that breaks.
// THIS test measures clientWidth STABILITY across zoom and that fit-width returns the page to the true
// fit. It fails on the pre-`contain:inline-size` code and passes after.
//
// Requires both dev servers running (backend :5000, frontend :3000 — override with API/APP env). It
// prefers an EXISTING renderable project (read-only — leaves the store untouched) and only imports the
// corpus book if the library has none. Run:  node scripts/verify-proof-zoom.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.API ?? 'http://localhost:5000';
const APP = process.env.APP ?? 'http://localhost:3000';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'backend', 'verification', 'corpus', 'faith-alone-styled.docx');

let failed = false;
const check = (label, ok) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failed = true; };

async function renderableProjectId() {
  const { projects } = await (await fetch(`${API}/api/projects`)).json();
  // A project the Proof can render: prefer the corpus book, else any with chapters.
  const pick = projects.find((p) => /faith/i.test(p.name)) ?? projects[0];
  if (pick) return { id: pick.id, imported: false };
  // Empty library — import the corpus book (only reached on a throwaway/empty store).
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(CORPUS)], { type: DOCX_MIME }), 'faith-alone-styled.docx');
  const res = await fetch(`${API}/api/manuscripts/import`, { method: 'POST', body: fd });
  const json = await res.json();
  if (!json.projectId) throw new Error(`no renderable project and import failed: ${res.status}`);
  return { id: json.projectId, imported: true };
}

async function main() {
  const { id, imported } = await renderableProjectId();
  console.log(`Using project ${id}${imported ? ' (freshly imported)' : ' (existing, read-only)'}.`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  try {
    await page.goto(`${APP}/projects/${id}`, { waitUntil: 'networkidle' });
    await page.keyboard.press('Control+5'); // -> Proof station (VIEW_ORDER index 4)
    await page.waitForSelector('.pdfProofScroll', { timeout: 20000 });
    await page.getByLabel('Fit width').waitFor({ timeout: 20000 });
    await page.waitForSelector('.pdfPage', { timeout: 20000 });

    const scrollCW = () => page.locator('.pdfProofScroll').evaluate((el) => el.clientWidth);
    const slotW = () => page.locator('.pdfPage').first().evaluate((el) => parseFloat(el.style.width) || el.clientWidth);
    const level = () => page.locator('.pdfProofZoomLevel').textContent();
    const zoomTo = async (label, target) => {
      await page.getByLabel(label).click();
      await page.waitForFunction((t) => document.querySelector('.pdfProofZoomLevel')?.textContent === t, target, { timeout: 8000 });
      await page.waitForTimeout(400); // let the re-render settle the slot width
    };

    await page.getByLabel('Fit width').click();
    await page.waitForTimeout(400);
    const cw0 = await scrollCW();
    const slot0 = await slotW();
    check(`starts fit at 100% (scroll box ${cw0}px, page ${Math.round(slot0)}px)`, (await level()) === '100%');

    await zoomTo('Zoom in', '125%');
    const cw125 = await scrollCW();
    const slot125 = await slotW();
    // THE GUARD: the box must NOT grow with the zoomed page (the pre-fix defect inflated it).
    check(`scroll box STABLE on zoom-in (${cw0}px → ${cw125}px)`, Math.abs(cw125 - cw0) <= 2);
    check(`page grew inside the stable box (${Math.round(slot0)}px → ${Math.round(slot125)}px, scrolls horizontally)`, slot125 > slot0 * 1.1);

    await zoomTo('Zoom in', '150%');
    const cw150 = await scrollCW();
    check(`scroll box STILL stable at 150% (${cw150}px)`, Math.abs(cw150 - cw0) <= 2);

    // Fit-width returns the page to the TRUE fit (the reported "static" symptom is this returning wrong).
    await page.getByLabel('Fit width').click();
    await page.waitForFunction(() => document.querySelector('.pdfProofZoomLevel')?.textContent === '100%', null, { timeout: 8000 });
    await page.waitForTimeout(400);
    const cwFit = await scrollCW();
    const slotFit = await slotW();
    check(`fit-width box unchanged (${cwFit}px == ${cw0}px)`, Math.abs(cwFit - cw0) <= 2);
    check(`fit-width returns the page to the true fit (${Math.round(slotFit)}px ≈ ${Math.round(slot0)}px)`, Math.abs(slotFit - slot0) <= 3);
  } catch (e) {
    console.error('ERROR', e);
    failed = true;
  } finally {
    await browser.close();
  }
  console.log(failed ? '\nPROOF-ZOOM VERIFY FAILED' : '\nPROOF-ZOOM VERIFY GREEN');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
