/**
 * INCREMENTAL_RENDER (P1) — the CADRAGE probe (read-only; stops at the constats). CTO directive
 * 2026-07-23 (AUTHOR_EXPERIENCE Axis-7, P1). The living Proof re-renders the WHOLE book on every
 * change; criterion A (fluidity) needs incremental rendering. The FORM is NOT presumed — three
 * candidates are weighed against the REAL pipeline, measure first:
 *
 *   (1) visible-page-only  — render only the page(s) on screen, not all N.
 *   (2) progressive first-page-first — paint page 1 immediately, stream the rest.
 *   (3) partial repagination — repaginate only the changed region, reuse the rest's geometry.
 *
 * A candidate's leverage is exactly the stage it removes, so the cadrage decomposes the whole-book
 * render into its stages AND asks whether the PDF render is per-page or a fixed floor:
 *   theme+order · typography · paginate (cached by md5(book), a content change MISSES) · PDF render.
 * Measured on THREE real books to avoid generalising from one shape (#7): a well-structured corpus
 * book, the founder book 3 fresh import (under-structured worst case), and his edited stored state.
 *
 * Read-only: committed corpus + fresh import of book 3 from its stored bytes. Never writes the store.
 * Run: npx tsx spikes/incremental-render-cadrage.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { resolveTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import type { Book } from '../src/domain/models/Book';
import type { PaginatedBook } from '../src/domain/models/PaginatedBook';

const BOOK3 = '1784812181217-cy7m12l0w';
const ms = (t: bigint) => Number(t) / 1e6;

async function importFrom(buffer: Buffer): Promise<Book> {
  const raw = await new MammothParser().parse(buffer);
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'book3.docx' }));
}

const themeEngine = new ThemeEngine();
const typo = new TypographyResolver();
const layout = new LayoutEngine(new PdfKitTextMeasurer());
const renderer = new PDFRenderer();
const theme = resolveTheme('classic', undefined, undefined);

async function timeRender(paginated: PaginatedBook, lang: string | undefined): Promise<number> {
  const t = process.hrtime.bigint();
  await renderer.render(paginated, { language: lang });
  return ms(process.hrtime.bigint() - t);
}
const medRender = async (p: PaginatedBook, lang: string | undefined): Promise<number> =>
  [await timeRender(p, lang), await timeRender(p, lang), await timeRender(p, lang)].sort((a, b) => a - b)[1];

async function decompose(log: (...a: unknown[]) => void, label: string, book: Book): Promise<void> {
  const lang = book.metadata.language;
  const t0 = process.hrtime.bigint();
  const styled = themeEngine.applyTheme(orderByRole(book), theme);
  const tTheme = ms(process.hrtime.bigint() - t0);
  const t1 = process.hrtime.bigint();
  const typeset = typo.resolve(styled);
  const tTypo = ms(process.hrtime.bigint() - t1);
  const t2 = process.hrtime.bigint();
  const paginated = layout.paginate(typeset, KDP6x9PageLayout);
  const tPaginate = ms(process.hrtime.bigint() - t2);

  const pageCount = paginated.pages.length;
  const tRenderFull = await medRender(paginated, lang);
  const total = tTheme + tTypo + tPaginate + tRenderFull;
  const pct = (x: number) => `${((x / total) * 100).toFixed(0)}%`;

  log(`\n===== ${label} — ${pageCount} pages, ${book.mainContent.length} top-level entries =====`);
  log(`  theme+order : ${tTheme.toFixed(1)} ms  (${pct(tTheme)})`);
  log(`  typography  : ${tTypo.toFixed(1)} ms  (${pct(tTypo)})`);
  log(`  paginate    : ${tPaginate.toFixed(1)} ms  (${pct(tPaginate)})  <- cached by md5(book); a CONTENT change MISSES`);
  log(`  PDF render  : ${tRenderFull.toFixed(1)} ms  (${pct(tRenderFull)})`);
  log(`  TOTAL       : ${total.toFixed(1)} ms`);
  log('  render cost vs page count (is render per-page, or a fixed floor?):');
  for (const k of [1, 2, 5, pageCount].filter((k, i, a) => k <= pageCount && a.indexOf(k) === i)) {
    const t = await medRender({ ...paginated, pages: paginated.pages.slice(0, k) }, lang);
    log(`    first ${String(k).padStart(3)} of ${pageCount} pages -> ${t.toFixed(1)} ms`);
  }
}

async function main() {
  const origLog = console.log.bind(console);
  const log = origLog;
  console.warn = () => {};
  console.error = () => {};
  // the renderer prints an ADR-0051 notice per reconciliation page on the under-structured book — noise here
  console.log = (...a: unknown[]) => { if (typeof a[0] === 'string' && a[0].startsWith('[PDFRenderer]')) return; origLog(...(a as [])); };

  log('# INCREMENTAL_RENDER (P1) — is pagination or render dominant, and is render per-page or a fixed floor?');

  const faithPath = join(process.cwd(), 'verification', 'corpus', 'faith-alone-styled.docx');
  if (existsSync(faithPath)) {
    await decompose(log, 'STRUCTURED — faith-alone (17 ch, committed corpus)', await importFrom(readFileSync(faithPath)));
  }

  const storePath = join(process.cwd(), 'data', 'studio.db');
  if (existsSync(storePath)) {
    const db = new DatabaseSync(storePath, { readOnly: true });
    const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(BOOK3) as { bytes: Buffer | Uint8Array } | undefined;
    const rec = db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(BOOK3) as { aggregate: string } | undefined;
    db.close();
    if (blob) {
      await decompose(log, 'UNDER-STRUCTURED — founder book 3 fresh import (1 section, ~46k words)', await importFrom(Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes)));
    }
    if (rec) {
      try {
        const stored = JSON.parse(rec.aggregate).book as Book;
        await decompose(log, 'FOUNDER-EDITED — book 3 stored aggregate (his structured state)', stored);
      } catch { /* ignore a shape mismatch */ }
    }
  }

  log('\n(read-only; the founder store was never written.)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
