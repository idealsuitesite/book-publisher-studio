/**
 * Generates the commit-4 Word-verification artifact (MINI_DR_DROP_CAPS §6 commit 4, §7
 * trusted instruments): REAL faith-alone through the REAL pipeline under the proof theme
 * (scope chapterOpening, scale 2.5) → spikes/output/faith-alone-dropcap.docx, to be read back
 * by Word's own object model via COM (DropCap.Position / LinesToDrop — never Range.Information,
 * the §7 exclusion).
 *
 * Run: npx tsx backend/spikes/dropcap-triformat-word-output.ts
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
import { resolveTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { DOCXRenderer } from '../src/infrastructure/renderers/DOCXRenderer';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import type { Theme } from '../src/domain/models/Theme';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAITH_ALONE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');
const OUT = join(__dirname, 'output', 'faith-alone-dropcap.docx');

async function run(): Promise<void> {
  const raw = await new MammothParser().parse(readFileSync(FAITH_ALONE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };

  const theme: Theme = {
    ...resolveTheme('classic'),
    name: 'dropcap-proof',
    presentation: { dropCap: { scope: 'chapterOpening', scale: 2.5 } },
  };
  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(orderByRole(book), theme));
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);

  const expectedOpenings = book.mainContent.filter(
    (c) => c.type === 'chapter' && c.content[0]?.type === 'paragraph' && c.content[0].text.trim().length > 0
  ).length;

  const docx = await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginated, { language: 'en' });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, docx.output);
  console.log(`written ${OUT}`);
  console.log(`expected openings (§5 rule on the real book): ${expectedOpenings}`);
}
void run();
