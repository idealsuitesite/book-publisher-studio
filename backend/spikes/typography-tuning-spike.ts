/**
 * Queue item 4 scope measurement (TYPOGRAAPHY_TUNING) — what does each candidate knob really do
 * to the geometry, on the real corpus manuscript? Read-only, no production code. Run:
 *   npx tsx spikes/typography-tuning-spike.ts
 *
 * For each candidate override on Classic (faith-alone, kdp-6x9): model pages / real pages /
 * unplanned breaks. Two questions at once:
 *  - the AUTHOR meaning of the knob (how much does the book's length move?);
 *  - the R2 story (charged == consumed must hold under overrides BY CONSTRUCTION, because the
 *    measurer and the renderer read the same resolved theme — unplanned staying at base proves it).
 */
import { readFileSync } from 'node:fs';
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
import { ClassicTheme } from '../src/domain/themes/ClassicTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import type { Theme } from '../src/domain/models/Theme';
import type { Book } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');

async function run(label: string, book: Book, theme: Theme) {
  const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
  const origWarn = console.warn;
  console.warn = () => {};
  const result = await new PDFRenderer().render(paginated, { language: 'en' });
  console.warn = origWarn;
  console.log(
    `${label.padEnd(42)} model ${String(paginated.pages.length).padStart(3)}  real ${String(result.metrics.pageCount).padStart(3)}  unplanned ${result.metrics.unplannedPageBreaks}`
  );
  return paginated.pages.length;
}

async function main() {
  const raw = await new MammothParser().parse(readFileSync(FILE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  const book: Book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const base = ClassicTheme;

  console.log('Typography-tuning geometry probe — faith-alone (39,354 words), kdp-6x9, Classic base\n');
  await run('BASE (body 11pt Georgia/Gelasio)', book, base);
  await run('body size 12pt (+1)', book, { ...base, fontSizes: { ...base.fontSizes, body: 12 } });
  await run('body size 13pt (+2)', book, { ...base, fontSizes: { ...base.fontSizes, body: 13 } });
  await run('body size 10pt (-1)', book, { ...base, fontSizes: { ...base.fontSizes, body: 10 } });
  await run('body font -> sans (Inter)', book, { ...base, fonts: { ...base.fonts, body: 'Helvetica' } });
  await run('heading font -> sans (Inter)', book, { ...base, fonts: { ...base.fonts, heading: 'Helvetica' } });
  await run('paragraphSpacing 8 -> 12', book, { ...base, spacing: { ...base.spacing, paragraphSpacing: 12 } });
  await run('paragraphSpacing 8 -> 4', book, { ...base, spacing: { ...base.spacing, paragraphSpacing: 4 } });
}

main();
