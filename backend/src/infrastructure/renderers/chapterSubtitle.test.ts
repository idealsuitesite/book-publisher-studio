import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { PDFRenderer } from './PDFRenderer';
import { DOCXRenderer } from './DOCXRenderer';
import { EPUBRenderer } from './EPUBRenderer';
import { BookEditingService } from '../../domain/services/BookEditingService';
import { getTheme } from '../../domain/themes/getTheme';
import { CHAPTER_SUBTITLE_RATIO } from '../../domain/services/titleMetrics';
import { extractPdfText } from '../../test-utils/extractPdfText';
import { KDP5x8PageLayout } from '../../domain/layouts/KDP5x8PageLayout';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { createBook } from '../../domain/models/Book';
import type { Book, Chapter, Paragraph } from '../../domain/models/Book';
import type { PageLayout } from '../../domain/models/PageLayout';
import type { Theme } from '../../domain/models/Theme';

const CORPUS = join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');

/**
 * MINI_DR_SUBTITLE_FIELD §4/§6 (commit 2) — the rendered subtitle, priced in lock-step.
 * One ratio (titleMetrics), read by the model and all three renderers; population is
 * gesture-only, so the fresh-import corpus stays byte-identical (the parity suites hold that
 * side); here the GESTURED book is the subject, on synthetic shapes and on real faith-alone.
 */
const SENTENCE = 'Real prose follows the subtitle and carries the same measured words each run. ';

function chapterWith(subtitle: string | undefined, blocks: Paragraph[]): Chapter {
  const now = new Date();
  return {
    type: 'chapter', id: 'c1', number: 1, title: 'Chapter One', content: blocks, createdAt: now, updatedAt: now,
    ...(subtitle !== undefined ? { subtitle } : {}),
  };
}

function paginateWith(theme: Theme, book: Book, layout: PageLayout) {
  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, theme));
  return { typeset, paginated: new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, layout) };
}

function paragraphs(count: number): Paragraph[] {
  return Array.from({ length: count }, (_, i) => ({ type: 'paragraph' as const, id: `p${i}`, text: SENTENCE.repeat(3).trim() }));
}

describe('chapter subtitle — rendered and priced in lock-step (MINI_DR_SUBTITLE_FIELD commit 2)', () => {
  it('charged == consumed with subtitles live: 30 subtitled chapters, unplanned 0, pageCount == plan', async () => {
    const now = new Date();
    const chapters = Array.from({ length: 30 }, (_, i): Chapter => ({
      type: 'chapter', id: `ch${i}`, number: i + 1, title: `Chapter ${i + 1}`,
      subtitle: 'A subordinate line under the title, long enough to wrap once on a narrow page.',
      content: [{ type: 'paragraph', id: `ch${i}-p`, text: SENTENCE.repeat(4).trim() }],
      createdAt: now, updatedAt: now,
    }));
    const book = createBook({ title: 'S', author: 'T', language: 'en' }, chapters);
    const { paginated } = paginateWith(getTheme('classic'), book, KDP5x8PageLayout);
    const rendered = await new PDFRenderer().render(paginated, { language: 'en' });

    expect(rendered.metrics.unplannedPageBreaks).toBe(0);
    expect(rendered.metrics.pageCount).toBe(paginated.pages.length);
  });

  it('the subtitle is charged: a subtitled chapter prices its first page lower in capacity than the same chapter bare', () => {
    // Direct comparison of the plan: same blocks, with vs without subtitle — the subtitled
    // chapter's first page holds fewer blocks (the subtitle's measured height is real charge).
    const blocks = paragraphs(30);
    const bare = paginateWith(getTheme('classic'), createBook({ title: 'S', author: 'T', language: 'en' }, [chapterWith(undefined, blocks)]), KDP5x8PageLayout).paginated;
    // The subtitle is deliberately TALLER than a page's leftover slack (it wraps ~5 lines on
    // kdp-5x8), so its charge MUST displace at least one block off page 1 — deterministic,
    // never a slack-absorbed coin flip.
    const subtitled = paginateWith(
      getTheme('classic'),
      createBook({ title: 'S', author: 'T', language: 'en' }, [chapterWith(SENTENCE.repeat(4).trim(), blocks)]),
      KDP5x8PageLayout
    ).paginated;

    expect(subtitled.pages[0].blocks.length).toBeLessThan(bare.pages[0].blocks.length);
  });

  it('tri-format: PDF renders the text; DOCX carries a REAL Subtitle-styled paragraph; EPUB the classed element + ratio CSS', async () => {
    const book = createBook({ title: 'S', author: 'T', language: 'en' }, [
      chapterWith('A structural marker under the title', paragraphs(2)),
    ]);
    const { paginated } = paginateWith(getTheme('classic'), book, LetterPageLayout);

    const pdf = await new PDFRenderer({ compress: false }).render(paginated, { language: 'en' });
    expect(extractPdfText(pdf.output)).toContain('structural marker under the title'); // ligature-free on purpose: the italic face's fi/fl ligatures defeat naive glyph extraction

    const docx = await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginated, { language: 'en' });
    const zip = await JSZip.loadAsync(docx.output);
    const documentXml = await zip.file('word/document.xml')!.async('string');
    const stylesXml = await zip.file('word/styles.xml')!.async('string');
    expect(documentXml).toContain('<w:pStyle w:val="Subtitle"/>');
    expect(documentXml).toContain('A structural marker under the title');
    expect(stylesXml).toContain('w:styleId="Subtitle"');
    expect(stylesXml).toContain(`w:val="${Math.round(getTheme('classic').fontSizes.h1 * CHAPTER_SUBTITLE_RATIO * 2)}"`);

    const epub = await new EPUBRenderer().render(paginated, { language: 'en' });
    const ez = await JSZip.loadAsync(epub.output);
    const texts = await Promise.all(Object.values(ez.files).filter((f) => !f.dir).map((f) => f.async('string')));
    const all = texts.join('\n');
    expect(all).toContain('<p class="chapter-subtitle">A structural marker under the title</p>');
    expect(all).toContain(`.chapter-subtitle { font-style: italic; font-size: ${getTheme('classic').fontSizes.h1 * CHAPTER_SUBTITLE_RATIO}pt`);
  });

  it('a bare book emits no Subtitle paragraph and no classed element (lit-but-empty leak guard)', async () => {
    const book = createBook({ title: 'S', author: 'T', language: 'en' }, [chapterWith(undefined, paragraphs(2))]);
    const { paginated } = paginateWith(getTheme('classic'), book, LetterPageLayout);
    const docx = await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginated, { language: 'en' });
    const documentXml = await (await JSZip.loadAsync(docx.output)).file('word/document.xml')!.async('string');
    expect(documentXml).not.toContain('<w:pStyle w:val="Subtitle"/>');
    const epub = await new EPUBRenderer().render(paginated, { language: 'en' });
    const texts = await Promise.all(Object.values((await JSZip.loadAsync(epub.output)).files).filter((f) => !f.dir).map((f) => f.async('string')));
    expect(texts.join('\n')).not.toContain('class="chapter-subtitle"');
  });

  it('REAL faith-alone, gestured, under NOVEL: the subtitle leaves the flow and the drop cap lands on the PROSE — the consigned limitation retired', async () => {
    const raw = await new MammothParser().parse(readFileSync(CORPUS));
    const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));

    const chapter = built.mainContent.find((c) => c.type === 'chapter' && c.content[0]?.type === 'paragraph')! as Chapter;
    const subtitleLine = (chapter.content[0] as Paragraph).text;
    const proseLine = chapter.content[1] as Paragraph;
    const gestured = new BookEditingService().markAsSubtitle(built, chapter.content[0].id);

    const { typeset, paginated } = paginateWith(getTheme('novel'), gestured, LetterPageLayout);

    // The trigger, UNTOUCHED, now fires on the prose paragraph — position did the rest.
    expect(typeset.blockTypography?.[proseLine.id]?.dropCap).toBe(true);

    // Charged == consumed holds on the real gestured book under the lit theme.
    const rendered = await new PDFRenderer().render(paginated, { language: 'en' });
    expect(rendered.metrics.unplannedPageBreaks).toBeLessThanOrEqual(2);
    expect(rendered.metrics.degradedDropCaps).toBe(0);

    // And the DOCX carries the line as a REAL Subtitle-styled paragraph, once, out of the flow.
    const docx = await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginated, { language: 'en' });
    const documentXml = await (await JSZip.loadAsync(docx.output)).file('word/document.xml')!.async('string');
    const subtitleParas = documentXml.match(/<w:pStyle w:val="Subtitle"\/>/g) ?? [];
    expect(subtitleParas).toHaveLength(1);
    expect(documentXml).toContain(subtitleLine.slice(0, 40));
  }, 60_000);
});
