/**
 * INCREMENTAL_RENDER (P1) — the RENDER-FLOOR DECOMPOSITION probe (read-only; stops at constats).
 * CTO verdict V2 (2026-07-23). Decompose the ~350 ms PDF render into font-embed/subset vs doc-setup
 * vs content-draw vs flush, AND arbitrate the two prior instruments that cannot both be true:
 *
 *   - PERFORMANCE_SCOPE Option 3 (`render-decomposition-spike.ts`): "~75% is doc.text()" — from
 *     prototype-wrapping self-time.
 *   - INCREMENTAL_RENDER cadrage: "render is a FIXED FLOOR, 1 page ≈ 352 pages" — from slicing
 *     `book.pages` and re-rendering.
 *
 * The arbitration is STRUCTURAL, found by reading the renderer: `PDFRenderer.renderContents` draws
 * `content.content` (EVERY block of the book) and consults `book.pages` only for page-break
 * placement and headers/footers. So **slicing `book.pages` never reduces the text drawn** — the
 * cadrage's flat curve measured page-METADATA, not content, and proves nothing about per-page cost.
 * The liar is the page-slice. This probe re-measures the HONEST way: truncate the BOOK CONTENT (K
 * chapters), paginate and render each, and split content-draw vs finalize (doc.end = font subset +
 * zlib). Read-only, committed corpus. Run: npx tsx spikes/render-floor-decomposition.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import PDFDocument from 'pdfkit';
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
import type { Book } from '../src/domain/models/Book';
import type { PaginatedBook } from '../src/domain/models/PaginatedBook';

const FILE = join(process.cwd(), 'verification', 'corpus', 'faith-alone-styled.docx');
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const themeEngine = new ThemeEngine();
const typo = new TypographyResolver();
const layout = new LayoutEngine(new PdfKitTextMeasurer());
const theme = getTheme('classic');

async function loadBook(): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(FILE));
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
}

/** Truncate to the first K top-level entries — the HONEST "render less" (fewer blocks drawn). */
function firstK(book: Book, k: number): Book {
  return { ...book, mainContent: book.mainContent.slice(0, k) };
}

function paginate(book: Book): PaginatedBook {
  const styled = themeEngine.applyTheme(orderByRole(book), theme);
  return layout.paginate(typo.resolve(styled), KDP6x9PageLayout);
}

/**
 * One render, split into content-draw vs finalize by wrapping `doc.end` self-time (font subset +
 * zlib run synchronously inside end). content = total − finalize. Also counts doc.text calls.
 */
async function renderSplit(paginated: PaginatedBook, lang: string | undefined): Promise<{ total: number; finalize: number; content: number; textCalls: number }> {
  const proto = PDFDocument.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const origEnd = proto.end;
  const origText = proto.text;
  let finalize = 0;
  let textCalls = 0;
  proto.end = function (this: unknown, ...a: unknown[]) { const t = performance.now(); const r = origEnd.apply(this, a); finalize += performance.now() - t; return r; };
  proto.text = function (this: unknown, ...a: unknown[]) { textCalls += 1; return origText.apply(this, a); };
  const t0 = performance.now();
  await new PDFRenderer().render(paginated, { language: lang });
  const total = performance.now() - t0;
  proto.end = origEnd;
  proto.text = origText;
  return { total, finalize, content: total - finalize, textCalls };
}

async function main() {
  const warn = console.warn; const err = console.error; const origLog = console.log.bind(console);
  console.warn = () => {}; console.error = () => {};
  console.log = (...a: unknown[]) => { if (typeof a[0] === 'string' && a[0].startsWith('[PDFRenderer]')) return; origLog(...(a as [])); };
  const log = origLog;

  const book = await loadBook();
  const lang = book.metadata.language;
  const nCh = book.mainContent.length;

  log('# RENDER-FLOOR DECOMPOSITION (P1 / V2) — faith-alone, kdp-6x9, classic');
  log('# The HONEST render-vs-content curve: truncate BOOK CONTENT (not book.pages), split content-draw vs finalize.\n');
  log('  K chapters | pages | total ms | content-draw ms | finalize ms (font subset+zlib) | doc.text calls');

  const levels = [1, 2, 4, 8, nCh].filter((k, i, a) => k <= nCh && a.indexOf(k) === i);
  const rows: { k: number; pages: number; total: number; content: number; finalize: number; calls: number }[] = [];
  for (const k of levels) {
    const paginated = paginate(firstK(book, k));
    // warm once, then median of 3
    await renderSplit(paginated, lang);
    const runs = [await renderSplit(paginated, lang), await renderSplit(paginated, lang), await renderSplit(paginated, lang)];
    const total = median(runs.map((r) => r.total));
    const content = median(runs.map((r) => r.content));
    const finalize = median(runs.map((r) => r.finalize));
    rows.push({ k, pages: paginated.pages.length, total, content, finalize, calls: runs[0].textCalls });
    log(`  ${String(k).padStart(10)} | ${String(paginated.pages.length).padStart(5)} | ${total.toFixed(1).padStart(8)} | ${content.toFixed(1).padStart(15)} | ${finalize.toFixed(1).padStart(30)} | ${String(runs[0].textCalls).padStart(6)}`);
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  log('\n## Arbitration of the two instruments');
  log(`  - The page-slice cadrage LIED: PDFRenderer draws content.content (every block), consulting book.pages only`);
  log(`    for page breaks + headers. Slicing book.pages left ALL text drawn → the flat curve was page-metadata, not content.`);
  log(`  - The honest curve (above): content-draw scales with content (${first.content.toFixed(0)}ms @ ${first.k}ch → ${last.content.toFixed(0)}ms @ ${last.k}ch),`);
  log(`    doc.text calls scale (${first.calls} → ${last.calls}). Option 3's "doc.text dominates" is the surviving truth.`);
  log(`  - finalize (font subset + zlib, doc.end): ${first.finalize.toFixed(0)}ms @ ${first.k}ch → ${last.finalize.toFixed(0)}ms @ ${last.k}ch — the FIXED-vs-scaling split of the floor.`);
  log('\n## Reading (for the constats, not a decision)');
  const contentShare = ((last.content / last.total) * 100).toFixed(0);
  const finalizeShare = ((last.finalize / last.total) * 100).toFixed(0);
  log(`  - At full book: content-draw ${contentShare}%, finalize ${finalizeShare}%. Whichever dominates is the term a`);
  log(`    "render only the visible region" (fewer blocks) would actually cut — the page-slice could not test this.`);
  log('\n(read-only; committed corpus only.)');
}

main().catch((e) => { console.error(e); process.exit(1); });
