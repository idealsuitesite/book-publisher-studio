/**
 * FOUNDER_TRAVERSAL lot 1 — defect 6 (theme choice takes "several seconds"). Read-only: loads
 * the founder's STORED book from the aggregate and times the proof hot path (theme change =
 * cache MISS → paginate → render) stage by stage, on his real (small) book, under classic and
 * novel. Isolates where the seconds are: parse is off the hot path (ADR-0052 renders the stored
 * book), so this measures paginate + render only — the backend half of a theme switch.
 * Run: npx tsx spikes/founder-theme-timing-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { getTheme } from '../src/domain/themes/getTheme';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';
import type { Book } from '../src/domain/models/Book';

const FOUNDER_ID = '1784744671298-h9o6o9tn2';

async function timeOnce(book: Book, themeName: string, measurer: PdfKitTextMeasurer) {
  const t0 = performance.now();
  const styled = new ThemeEngine().applyTheme(book, getTheme(themeName));
  const typeset = new TypographyResolver().resolve(styled);
  const t1 = performance.now();
  const paginated = new LayoutEngine(measurer).paginate(typeset, LetterPageLayout);
  const t2 = performance.now();
  const orig = console.warn; console.warn = () => {};
  const result = await new PDFRenderer().render(paginated, { language: 'en' });
  console.warn = orig;
  const t3 = performance.now();
  return {
    theme: (t1 - t0), paginate: (t2 - t1), render: (t3 - t2), total: (t3 - t0),
    pages: result.metrics.pageCount, bytes: (result.output as Buffer).length,
  };
}

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const row = db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(FOUNDER_ID) as { aggregate: string };
  const book = JSON.parse(row.aggregate).book as Book;
  db.close();

  const words = JSON.stringify(book.mainContent).split(/\s+/).length;
  console.log(`founder book: ${book.mainContent.length} top-level, ~${words} tokens, current theme = novel\n`);

  const measurer = new PdfKitTextMeasurer();
  // Warm the fonts once (the first call embeds glyphs — a fixed one-time cost, not per switch).
  await timeOnce(book, 'classic', measurer);
  console.log('after warm-up (steady-state per theme switch):');
  for (const theme of ['classic', 'modern', 'novel', 'classic', 'novel']) {
    const r = await timeOnce(book, theme, measurer);
    console.log(
      `  ${theme.padEnd(8)} theme ${r.theme.toFixed(1).padStart(6)}ms  paginate ${r.paginate.toFixed(1).padStart(6)}ms  ` +
      `render ${r.render.toFixed(1).padStart(6)}ms  = ${r.total.toFixed(1).padStart(6)}ms total  (${r.pages}p, ${r.bytes}b)`
    );
  }
  console.log('\nNote: this is the BACKEND render only. A UI switch adds the HTTP round-trip, the');
  console.log('pagination-cache lookup (theme change = a legitimate MISS, must re-paginate), the PDF');
  console.log('bytes over the wire, and the browser PDF re-render — measured separately in the report.');
}

main();
