/**
 * The Novel screenshot-loop artifact generator (THIRD_THEME_NOVEL §5 commit 3): real faith-alone
 * under the Novel theme, US Letter — the pages the CTO judges before the accent shade (and any
 * rhythm value) locks. The chapter opening shows the LIT drop cap, the warm accent title, the
 * generous 22/10 title rhythm and the chapterTitle running head.
 *
 * Run: npx tsx backend/spikes/novel-shade-proof.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
import { getTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAITH_ALONE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');
const OUT = join(__dirname, 'output', 'novel-shade.pdf');

async function run(): Promise<void> {
  const raw = await new MammothParser().parse(readFileSync(FAITH_ALONE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };

  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(orderByRole(book), getTheme('novel')));
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);
  const rendered = await new PDFRenderer().render(paginated, { language: 'en' });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, rendered.output);
  console.log(`${OUT} — pages=${rendered.metrics.pageCount}, unplanned=${rendered.metrics.unplannedPageBreaks}, degraded=${rendered.metrics.degradedDropCaps}`);
}
void run();
