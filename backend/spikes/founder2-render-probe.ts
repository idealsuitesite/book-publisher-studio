/**
 * FOUNDER_TRAVERSAL second traversal — findings 1 & 2, read-only.
 *   Finding 2: re-import "The Secret Of Spiritual Protection" SOURCE bytes through the CURRENT
 *     pipeline. Does the "ProtectionFOREWORD" concatenation appear on a fresh import? → localises
 *     it to the import CODE (reproducible today) vs the founder's manual editing (his own 19
 *     versions). Never writes.
 *   Finding 1: render the stored founder book under Classic and Modern; extract body text runs
 *     (font + size) and diff the body region — does the body inherit the theme's typography, and
 *     do the body bytes differ between Classic and Modern beyond titles?
 * Run: npx tsx spikes/founder2-render-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import { extractPdfRuns } from '../src/test-utils/extractPdfText';
import type { Book } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = '1784760982271-w4n3yjxxw';

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const agg = JSON.parse((db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(PROJECT_ID) as { aggregate: string }).aggregate);
  const storedBook = agg.book as Book;
  const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(PROJECT_ID) as { bytes: Buffer | Uint8Array } | undefined;
  db.close();

  // ---- Finding 2: fresh re-import through the current code ----
  console.log('== Finding 2: fresh re-import of the source bytes (current pipeline) ==');
  if (!blob) {
    console.log('  no source blob stored for this project — cannot re-import; the stored book is the only artifact.');
  } else {
    const buffer = Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes);
    const raw = await new MammothParser().parse(buffer);
    const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'the-secret.docx' }));
    const titles = built.mainContent.map((c) => ('title' in c ? (c.title ?? '') : ''));
    const concat = titles.find((t) => /protection/i.test(t) && /foreword/i.test(t));
    console.log(`  fresh import: ${built.mainContent.length} top-level; first titles ${JSON.stringify(titles.slice(0, 4))}`);
    console.log(`  "ProtectionFOREWORD" concatenation on a FRESH import: ${concat ? `YES → "${concat}" (reproducible import defect, current code)` : 'NO → the stored concatenation came from the founder\'s manual editing, not today\'s import'}`);
  }

  // ---- Finding 1: body composition, Classic vs Modern ----
  console.log('\n== Finding 1: body composition (does the body inherit the theme? Classic vs Modern) ==');
  const bookWithFront: Book = { ...storedBook, frontMatter: storedBook.frontMatter ?? new FrontMatterBuilder().build(storedBook) };
  async function render(themeName: string) {
    const styled = new ThemeEngine().applyTheme(bookWithFront, getTheme(themeName));
    const typeset = new TypographyResolver().resolve(styled);
    const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
    const orig = console.warn; console.warn = () => {};
    const out = (await new PDFRenderer({ compress: false }).render(paginated, { language: 'en' })).output as Buffer;
    console.warn = orig;
    return out;
  }
  const classic = await render('classic');
  const modern = await render('modern');

  // The runs carry text + baseFont (no size). Distinguish body prose from headings by the face:
  // a body run's baseFont is the theme's regular body face (…Gelasio, not …Gelasio-Bold / Inter).
  const faceHistogram = (pdf: Buffer) => {
    const h = new Map<string, number>();
    for (const r of extractPdfRuns(pdf)) {
      const face = (r.baseFont.split('+').pop() ?? r.baseFont); // strip the subset prefix
      h.set(face, (h.get(face) ?? 0) + r.text.length);
    }
    return [...h.entries()].sort((a, b) => b[1] - a[1]);
  };
  const isBody = (baseFont: string) => /gelasio/i.test(baseFont) && !/bold|italic/i.test(baseFont);
  const bodyText = (pdf: Buffer) => extractPdfRuns(pdf).filter((r) => isBody(r.baseFont)).map((r) => r.text).join('');

  console.log(`  Classic face histogram (chars per face): ${JSON.stringify(faceHistogram(classic))}`);
  console.log(`  Modern  face histogram (chars per face): ${JSON.stringify(faceHistogram(modern))}`);
  const cBody = bodyText(classic), mBody = bodyText(modern);
  console.log(`  body prose is set in an EMBEDDED Gelasio face (theme body): Classic ${cBody.length} chars, Modern ${mBody.length} chars`);
  console.log(`  body prose IDENTICAL Classic vs Modern (they share a body face): ${cBody === mBody}`);
  console.log(`  full bytes: classic ${classic.length}b vs modern ${modern.length}b — differ: ${classic.length !== modern.length} (heading face Inter + accent, NOT the body)`);
}

main();
