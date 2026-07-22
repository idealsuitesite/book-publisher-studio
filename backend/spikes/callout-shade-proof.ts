/**
 * The SHADE-STOP artifact generator (MINI_DR_CALLOUTS §6 commit 2, §7 risk 1): real faith-alone,
 * one REAL paragraph marked via the real BookEditingService op, rendered under Classic
 * (rule-only, D4) and Modern (accent tint, D3) — the pages the CTO looks at BEFORE
 * CALLOUT_TINT_TOWARD_PAPER locks. Writes both PDFs + reports the planned page carrying the
 * callout so the raster step knows where to look.
 *
 * Run: npx tsx backend/spikes/callout-shade-proof.ts
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
import { BookEditingService } from '../src/domain/services/BookEditingService';
import { resolveTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAITH_ALONE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');
const OUT_DIR = join(__dirname, 'output');

async function run(): Promise<void> {
  const raw = await new MammothParser().parse(readFileSync(FAITH_ALONE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };

  // A real mid-chapter paragraph (not the opener): the shape an author would actually set off.
  const chapterOne = book.mainContent.find((c) => c.type === 'chapter')!;
  const target = chapterOne.content.filter((b) => b.type === 'paragraph')[1] ?? chapterOne.content[0];
  const marked = new BookEditingService().setCallout(book, target.id, true);
  console.log(`marked paragraph ${target.id}: "${(target as { text: string }).text.slice(0, 60)}…"`);

  mkdirSync(OUT_DIR, { recursive: true });
  for (const themeName of ['classic', 'modern'] as const) {
    const theme = resolveTheme(themeName);
    const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(orderByRole(marked), theme));
    const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);
    const plannedPage = paginated.pages.find((p) => p.blocks.includes(target.id))?.number;
    const rendered = await new PDFRenderer().render(paginated, { language: 'en' });
    const file = join(OUT_DIR, `callout-shade-${themeName}.pdf`);
    writeFileSync(file, rendered.output);
    console.log(
      `${themeName}: ${file} — callout on PLANNED page ${plannedPage} (front matter adds 2 physical pages); ` +
        `pages=${rendered.metrics.pageCount}, unplanned=${rendered.metrics.unplannedPageBreaks}`
    );
  }
}
void run();
