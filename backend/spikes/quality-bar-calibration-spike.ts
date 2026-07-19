/**
 * Quality-bar calibration data (PUBLICATION_QUALITY_BAR.md §8, CTO feu vert 2026-07-21):
 * measures, on the REAL corpus through the FIXED pipeline, the numbers §8's provisional
 * thresholds must be derived from. Produces data, decides nothing. Run:
 *   npx tsx spikes/quality-bar-calibration-spike.ts
 *
 * Per layout, on faith-alone-styled.docx:
 *  - model pages / renderer pages / unplanned reconciliations
 *  - measured words-per-page (body words / model pages)
 *  - page-fill distribution, split into STRUCTURAL-BOUNDARY short pages (page before a
 *    chapter start, the book's last page) vs NON-BOUNDARY underfill (the defect class)
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
import { getTheme } from '../src/domain/themes/getTheme';
import { countBookWords } from '../src/domain/services/countBookWords';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';
import { A4PageLayout } from '../src/domain/layouts/A4PageLayout';
import { A5PageLayout } from '../src/domain/layouts/A5PageLayout';
import { KDP5x8PageLayout } from '../src/domain/layouts/KDP5x8PageLayout';
import { KDP5_5x8_5PageLayout } from '../src/domain/layouts/KDP5_5x8_5PageLayout';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import type { PageLayout } from '../src/domain/models/PageLayout';
import type { Block, Content, Chapter } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');

const LAYOUTS: Array<[string, PageLayout]> = [
  ['letter', LetterPageLayout],
  ['a4', A4PageLayout],
  ['a5', A5PageLayout],
  ['kdp-5x8', KDP5x8PageLayout],
  ['kdp-5.5x8.5', KDP5_5x8_5PageLayout],
  ['kdp-6x9', KDP6x9PageLayout],
];

async function main() {
  const buffer = readFileSync(FILE);
  const raw = await new MammothParser().parse(buffer);
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' });
  const built = new ASTBuilder().build(normalized);
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const theme = getTheme('classic');
  const styled = new ThemeEngine().applyTheme(book, theme);
  const typeset = new TypographyResolver().resolve(styled);
  const words = countBookWords(book);
  const chapters = book.mainContent.filter((c) => c.type === 'chapter').length;
  console.log(`corpus: faith-alone — ${words.toLocaleString('en-US')} words, ${chapters} chapters\n`);
  console.log(
    'layout        modelPg  realPg  unplanned  words/pg  fill%  <30% total  <30% boundary  <30% NON-boundary'
  );

  for (const [name, layout] of LAYOUTS) {
    const measurer = new PdfKitTextMeasurer();
    const paginated = new LayoutEngine(measurer).paginate(typeset, layout);

    const origWarn = console.warn;
    console.warn = () => {};
    const result = await new PDFRenderer().render(paginated, { language: 'en' });
    console.warn = origWarn;

    // fill per model page, priced with the engine's own measurer (split-aware enough for
    // distribution purposes: split pages are full by construction, so approximate them full)
    const usableWidth = layout.width - layout.marginLeft - layout.marginRight;
    const usableHeight = layout.height - layout.marginTop - layout.marginBottom;
    const blocks = new Map<string, Block>();
    // Structural boundaries: a page is legitimately short when the NEXT page opens a chapter
    // (new-page convention) OR a titled section (title keep-with-next, ADR-0051) — both are
    // planned typographic breaks, not defects. Only chapterless/titleless underfill counts.
    const contentFirstBlocks = new Set<string>();
    // First block IN READING ORDER: a chapter whose text lives entirely under its sections has
    // an empty content[] — its first rendered block is its first section's.
    const firstBlockOf = (c: Content): string | undefined => {
      if (c.content[0]) return c.content[0].id;
      const children =
        c.type === 'chapter' ? ((c as Chapter).sections as unknown as Content[] | undefined) : (c.subsections as unknown as Content[] | undefined);
      for (const child of children ?? []) {
        const found = firstBlockOf(child);
        if (found) return found;
      }
      return undefined;
    };
    const walk = (contents: Content[]): void => {
      for (const c of contents) {
        if (c.title) {
          const first = firstBlockOf(c);
          if (first) contentFirstBlocks.add(first);
        }
        for (const b of c.content) blocks.set(b.id, b);
        if (c.type === 'chapter' && (c as Chapter).sections) walk((c as Chapter).sections as unknown as Content[]);
        else if (c.type === 'section' && c.subsections) walk(c.subsections as unknown as Content[]);
      }
    };
    walk(typeset.book.mainContent);
    const t = typeset as unknown as { blockStyles: Record<string, { fontSize?: number; spaceAfter?: number }> };
    const price = (b: Block): number => {
      const st = t.blockStyles[b.id] ?? {};
      const fontSize = st.fontSize ?? 11;
      const text = 'text' in b ? ((b as { text?: string }).text ?? '') : '';
      return (
        measurer.measureHeight(text, { fontSize, width: usableWidth, theme, heading: b.type === 'heading' }) +
        (st.spaceAfter ?? 8)
      );
    };

    let under30Total = 0;
    let under30Boundary = 0;
    let fillSum = 0;
    const pages = paginated.pages;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      let height = 0;
      if (page.splitAfterLines || page.startsWithContinuation) {
        height = usableHeight; // split pages are packed by construction
      } else {
        for (const id of page.blocks) {
          const b = blocks.get(id);
          if (b) height += price(b);
        }
      }
      const fill = Math.min(1, height / usableHeight);
      fillSum += fill;
      if (fill < 0.3) {
        under30Total++;
        const next = pages[i + 1];
        const isBoundary =
          i === pages.length - 1 || (next !== undefined && next.blocks[0] !== undefined && contentFirstBlocks.has(next.blocks[0]));
        if (isBoundary) under30Boundary++;
        else if (name === 'letter') {
          const nb = next?.blocks[0];
          console.log(
            `   NONBOUNDARY p${page.number} fill ${(100 * fill).toFixed(0)}% blocks=[${page.blocks.join(',')}] split=${page.splitAfterLines ?? '-'} cont=${page.startsWithContinuation ?? false} | next first=${nb} nextCont=${next?.startsWithContinuation ?? false}`
          );
        }
      }
    }

    const modelPg = pages.length;
    const realPg = result.metrics.pageCount ?? 0;
    const unplanned = result.metrics.unplannedPageBreaks ?? 0;
    console.log(
      `${name.padEnd(13)} ${String(modelPg).padStart(6)} ${String(realPg).padStart(7)} ${String(unplanned).padStart(9)} ${String(Math.round(words / modelPg)).padStart(9)} ${String(Math.round((100 * fillSum) / modelPg)).padStart(6)} ${String(under30Total).padStart(10)} ${String(under30Boundary).padStart(14)} ${String(under30Total - under30Boundary).padStart(17)}`
    );
  }
}

main();
