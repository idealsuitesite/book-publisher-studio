/**
 * The MANDATORY commit-3 screenshot-stop artifact (MINI_DR_SUBTITLE_FIELD, CTO-required): real
 * faith-alone, the opening subtitle-line of its first chapter GESTURED into `Chapter.subtitle`
 * via the real op, rendered under NOVEL on US Letter — the page that exposed the
 * subtitle-drop-cap limitation, now showing the subtitle rendered under the title and the drop
 * cap on the first PROSE paragraph. 0.6/italic lock only after the CTO's look at this page.
 *
 * Run: npx tsx backend/spikes/subtitle-novel-proof.ts
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
import { getTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';
import type { Chapter, Paragraph } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAITH_ALONE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');
const OUT = join(__dirname, 'output', 'subtitle-novel.pdf');

async function run(): Promise<void> {
  const raw = await new MammothParser().parse(readFileSync(FAITH_ALONE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };

  const chapter = book.mainContent.find((c) => c.type === 'chapter' && c.content[0]?.type === 'paragraph')! as Chapter;
  const subtitleLine = (chapter.content[0] as Paragraph).text;
  const gestured = new BookEditingService().markAsSubtitle(book, chapter.content[0].id);
  console.log(`gestured: "${subtitleLine.slice(0, 60)}…" -> ${chapter.title}'s subtitle`);

  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(orderByRole(gestured), getTheme('novel')));
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);
  const plannedPage = paginated.pages.find((p) => p.blocks.includes(chapter.id) || p.blocks.includes(gestured.mainContent.find((c) => c.id === chapter.id)!.content[0]?.id))?.number;
  const rendered = await new PDFRenderer().render(paginated, { language: 'en' });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, rendered.output);
  console.log(
    `${OUT} — chapter opens on PLANNED page ${plannedPage} (front matter adds 2 physical pages); ` +
      `pages=${rendered.metrics.pageCount}, unplanned=${rendered.metrics.unplannedPageBreaks}, degraded=${rendered.metrics.degradedDropCaps}`
  );
}
void run();
