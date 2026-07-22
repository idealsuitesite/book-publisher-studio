/**
 * Follow-up: capture the renderer's own unplanned-break warnings for faith-alone at kdp-6x9,
 * per theme — does Modern's extra reconciliation land at the "In Summary:" boundary (model
 * p39/p40)? Run: npx tsx spikes/typography-quality-probe3.ts
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
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import { getTheme } from '../src/domain/themes/getTheme';
import type { Book } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');

async function main() {
  const raw = await new MammothParser().parse(readFileSync(FILE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  const book: Book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  for (const name of ['classic', 'modern', 'novel'] as const) {
    const theme = getTheme(name);
    const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
    const typeset = new TypographyResolver().resolve(styled);
    const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (...a: unknown[]) => { warns.push(a.map(String).join(' ')); };
    const result = await new PDFRenderer().render(paginated, { language: 'en' });
    console.warn = orig;
    console.log(`${name}: unplanned ${result.metrics.unplannedPageBreaks}`);
    for (const w of warns) console.log(`  WARN: ${w.slice(0, 220)}`);
  }
}

main();
