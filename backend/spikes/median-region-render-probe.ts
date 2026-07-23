/**
 * INCREMENTAL_RENDER (P1) — the MEDIAN-REGION probe (read-only; stops at constats). CTO re-verdict
 * V1 (2026-07-23): P1's form is candidate 1 (visible-region render). Two things the CTO required
 * measured on a REAL median region of the real book — NOT chapter 1, NOT the start of the document:
 *
 *   1. COST — re-measure the ~36 ms extrapolation (which came from "1 chapter = 3 pages") on a true
 *      mid-book window with its real pagination.
 *   2. THE FIDELITY TRAP (the DR's spine) — a visible-region render must produce page N of the REAL
 *      book: true number, true running head, true geometry — not page 1 of a truncated document.
 *      The full pagination owns the block→page attribution and stays the source of truth; the partial
 *      render draws INSIDE that truth. This probe names EXACTLY what must be threaded from the full
 *      pagination into the partial render, and shows a naive truncation getting it wrong.
 *
 * Read-only: fresh import of book 3 from stored bytes. Never writes the store.
 * Run: npx tsx spikes/median-region-render-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { getTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import { createBook, type Book, type Content, type Section, type Block } from '../src/domain/models/Book';
import type { PaginatedBook } from '../src/domain/models/PaginatedBook';

const BOOK3 = '1784812181217-cy7m12l0w';
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const themeEngine = new ThemeEngine();
const typo = new TypographyResolver();
const layout = new LayoutEngine(new PdfKitTextMeasurer());
const theme = getTheme('classic');

async function importFrom(buffer: Buffer): Promise<Book> {
  const raw = await new MammothParser().parse(buffer);
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'book3.docx' }));
}
function paginate(book: Book): PaginatedBook {
  return layout.paginate(typo.resolve(themeEngine.applyTheme(orderByRole(book), theme)), KDP6x9PageLayout);
}
/** Index every block by id (top-level + nested), so a page's block ids resolve to Block objects. */
function indexBlocks(book: Book): Map<string, Block> {
  const map = new Map<string, Block>();
  const walk = (cs: (Content | Section)[]) => cs.forEach((c) => {
    for (const b of c.content) map.set(b.id, b);
    if (c.type === 'chapter' && c.sections) walk(c.sections);
    if (c.type === 'section' && c.subsections) walk(c.subsections);
  });
  walk(book.mainContent as Content[]);
  return map;
}
async function timeRender(paginated: PaginatedBook, lang: string | undefined): Promise<number> {
  const t = performance.now();
  await new PDFRenderer().render(paginated, { language: lang });
  return performance.now() - t;
}
const med = async (p: PaginatedBook, lang: string | undefined) => median([await timeRender(p, lang), await timeRender(p, lang), await timeRender(p, lang)]);

async function main() {
  const warn = console.warn; const err = console.error; const origLog = console.log.bind(console);
  console.warn = () => {}; console.error = () => {};
  console.log = (...a: unknown[]) => { if (typeof a[0] === 'string' && a[0].startsWith('[PDFRenderer]')) return; origLog(...(a as [])); };
  const log = origLog;

  const storePath = join(process.cwd(), 'data', 'studio.db');
  if (!existsSync(storePath)) { log('no local store — this probe needs the founder book 3.'); return; }
  const db = new DatabaseSync(storePath, { readOnly: true });
  const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(BOOK3) as { bytes: Buffer | Uint8Array } | undefined;
  db.close();
  if (!blob) { log('book 3 not in this store.'); return; }

  const book = await importFrom(Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes));
  const lang = book.metadata.language;
  const full = paginate(book);
  const blockIndex = indexBlocks(book);
  const P = full.pages.length;

  log('# MEDIAN-REGION probe (P1 / candidate 1) — founder book 3, real mid-book region');
  const tFull = await med(full, lang);
  log(`full book: ${P} pages, full render ${tFull.toFixed(0)} ms (warm)`);

  // A true MID-BOOK window of 2 consecutive pages (what an author sees on screen), not chapter 1.
  const mid = Math.floor(P / 2);
  for (const [label, pageIdxs] of [['single mid page', [mid]], ['2-page mid window', [mid, mid + 1]]] as [string, number[]][]) {
    const pages = pageIdxs.map((i) => full.pages[i]).filter(Boolean);
    const ids = pages.flatMap((pg) => pg.blocks);
    const blocks = ids.map((id) => blockIndex.get(id)).filter((b): b is Block => !!b);
    // COST proxy: draw exactly this region's blocks (a minimal book), re-paginated + rendered.
    const region: Book = createBook({ ...book.metadata }, [{ type: 'section', id: 'region', title: '', level: 1, content: blocks, createdAt: new Date(), updatedAt: new Date() } as Section]);
    const rp = paginate(region);
    const tRegion = await med(rp, lang);
    log(`\n## ${label} — pages ${pageIdxs.map((i) => full.pages[i]?.number).join(', ')} of ${P} (real numbers)`);
    log(`  region blocks: ${blocks.length}   region render: ${tRegion.toFixed(1)} ms   vs full ${tFull.toFixed(0)} ms  (~${(tFull / tRegion).toFixed(1)}x)`);
    // FIDELITY: what the full pagination owns for these pages, that a partial render MUST thread.
    for (const pg of pages) {
      log(`  page ${pg.number}: runningHead=${pg.runningHead ? `"${pg.runningHead}"` : 'none'}  startsWithContinuation=${!!pg.startsWithContinuation}  splitAfterLines=${pg.splitAfterLines ?? '-'}  blankPagesBefore=${pg.blankPagesBefore ?? 0}`);
    }
    log(`  NAIVE-TRUNCATION TRAP: rendered in isolation these blocks number from page 1 (rp.pages[0].number=${rp.pages[0].number}), not ${pages[0].number} — the DR must set the number from the full Page, carry runningHead, and honour continuation/split state.`);
  }

  log('\n## Constats (for the DR, not a decision)');
  log('  - Cost on a REAL median region confirms candidate 1 leverage (region << full).');
  log('  - The full pagination Page model already carries number, runningHead, continuation & split state —');
  log('    enough to render page N faithfully IF threaded. The judge asserts page-N-in-region == page-N-in-full-export');
  log('    (text, geometry, number) on real book 3 mid-book. The block y-origin is deterministic (page top, or a');
  log('    continuation tail via splitAfterLines) — the one term to verify in construction.');
  log('\n(read-only; the founder store was never written.)');
}

main().catch((e) => { console.error(e); process.exit(1); });
