import { describe, it, expect } from 'vitest';
import { BookMetricsCalculator } from './BookMetricsCalculator';
import { ThemeEngine } from './ThemeEngine';
import { TypographyResolver } from './TypographyResolver';
import { LayoutEngine } from './LayoutEngine';
import { ClassicTheme } from '../themes/ClassicTheme';
import { LetterPageLayout } from '../layouts/LetterPageLayout';
import { createBook } from '../models/Book';
import type { Chapter, Section, Heading, Paragraph, Scripture, Image, Table, Footnote, Block } from '../models/Book';
import type { PageLayout } from '../models/PageLayout';

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, id: string, text = 'A Heading'): Heading {
  return { type: 'heading', id, level, text };
}

function paragraph(text: string, id = 'p-1', overrides: Partial<Paragraph> = {}): Paragraph {
  return { type: 'paragraph', id, text, ...overrides };
}

function footnote(id = 'f-1'): Footnote {
  return { type: 'footnote', id, number: 1, content: 'See appendix.' };
}

// Runs a Book through the real ThemeEngine -> TypographyResolver -> LayoutEngine pipeline
// (same order as ExportManuscriptUseCase) so calculateQualityMetrics sees the real
// blockTypography/pages data it depends on, not hand-faked fixtures.
function paginate(chapters: Chapter[], layout: PageLayout = LetterPageLayout) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine().paginate(typeset, layout);
}

function scripture(text: string, id = 's-1'): Scripture {
  return { type: 'scripture', id, text };
}

function image(id = 'img-1'): Image {
  return { type: 'image', id, url: 'https://example.com/a.png' };
}

function table(id = 'tbl-1'): Table {
  return { type: 'table', id, headers: [], rows: [] };
}

function chapter(content: Block[], overrides: Partial<Chapter> = {}): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: 'c-1',
    number: 1,
    title: '',
    content,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function section(content: Block[], overrides: Partial<Section> = {}): Section {
  const now = new Date();
  return {
    type: 'section',
    id: 'sec-1',
    title: '',
    content,
    level: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('BookMetricsCalculator', () => {
  const calculator = new BookMetricsCalculator();

  it('sums word count across headings, paragraphs, quotes, and scripture', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([paragraph('Three words here'), scripture('For God so loved the world')], {
        title: 'Two Words',
      }),
    ]);

    const result = calculator.calculate(book);

    expect(result.wordCount).toBe(11);
  });

  it('derives readingTime from wordCount at 200 words per minute, rounded up', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      section([paragraph(new Array(250).fill('word').join(' '))]),
    ]);

    const result = calculator.calculate(book);

    expect(result.wordCount).toBe(250);
    expect(result.readingTime).toBe(2);
  });

  it('derives pageCount from wordCount at 300 words per page, minimum 1 page if any words exist', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      section([paragraph('Just a few words.')]),
    ]);

    const result = calculator.calculate(book);

    expect(result.wordCount).toBe(4);
    expect(result.pageCount).toBe(1);
  });

  it('does not mutate the input book', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      section([paragraph('Some words.')]),
    ]);

    calculator.calculate(book);

    expect(book.wordCount).toBeUndefined();
  });

  describe('countContent', () => {
    it('counts chapters, images, and tables across the whole tree, including nested sections', () => {
      const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
        chapter([image()], {
          id: 'c-1',
          number: 1,
          sections: [
            section([table()], {
              id: 'sec-1',
              subsections: [section([image(), table()], { id: 'sec-2' })],
            }),
          ],
        }),
        chapter([], { id: 'c-2', number: 2 }),
      ]);

      const stats = calculator.countContent(book);

      expect(stats.chapters).toBe(2);
      expect(stats.images).toBe(2);
      expect(stats.tables).toBe(2);
    });

    it('returns zeros for a book with no chapters, images, or tables', () => {
      const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
        section([paragraph('Just text.')]),
      ]);

      const stats = calculator.countContent(book);

      expect(stats).toEqual({ chapters: 0, images: 0, tables: 0 });
    });
  });

  describe('calculateQualityMetrics', () => {
    it('activates every ADR-0008/Sprint-4 field with real, non-hardcoded-zero values on a fixture with known issues', () => {
      const paginated = paginate([
        chapter([
          heading(1, 'h-empty', ''),
          heading(2, 'h-2', 'Section Two'),
          paragraph('Drop cap opens this paragraph.', 'p-drop', { dropCap: true }),
          paragraph('Explicit spacing overrides the theme default.', 'p-spacing', { spaceBefore: 999 }),
          paragraph('A perfectly ordinary paragraph.', 'p-plain'),
        ]),
      ]);

      const metrics = calculator.calculateQualityMetrics(paginated);

      expect(metrics.headingCount).toBe(2);
      expect(metrics.emptyHeadings).toBe(1);
      expect(metrics.paragraphCount).toBe(3);
      expect(metrics.dropCaps).toBe(1);
      expect(metrics.inconsistentSpacing).toBe(1);
      // Every Heading resolves staysWithNext: true today (TypographyResolver.ts) - the
      // resolver's widow/orphan signal is content-intrinsic, not page-boundary-aware yet.
      expect(metrics.widowsAndOrphans).toBe(2);
      expect(metrics.averageHeadingDepth).toBe((1 + 2) / 2);
      expect(metrics.estimatedPageCount).toBe(paginated.pages.length);
      expect(metrics.paragraphDensity).toBe(metrics.paragraphCount / paginated.pages.length);
      expect(metrics.wordCount).toBeGreaterThan(0);
      expect(metrics.readingTimeMinutes).toBeGreaterThan(0);
      expect(metrics.averageChapterLength).toBe(metrics.wordCount);
    });

    it('counts images, tables, and footnotes', () => {
      const paginated = paginate([chapter([image(), table(), footnote()])]);

      const metrics = calculator.calculateQualityMetrics(paginated);

      expect(metrics.imageCount).toBe(1);
      expect(metrics.tableCount).toBe(1);
      expect(metrics.footnoteCount).toBe(1);
    });

    it('derives paragraphDensity and lineDensity from real pagination once a book spans multiple pages', () => {
      const manyParagraphs = Array.from({ length: 20 }, (_, i) => paragraph('word '.repeat(50), `p-${i}`));
      const smallPageLayout: PageLayout = { ...LetterPageLayout, height: 300 };
      const paginated = paginate([chapter(manyParagraphs)], smallPageLayout);

      const metrics = calculator.calculateQualityMetrics(paginated);

      expect(paginated.pages.length).toBeGreaterThan(1);
      expect(metrics.paragraphDensity).toBe(20 / paginated.pages.length);
      expect(metrics.lineDensity).toBeGreaterThan(1);
    });

    it('returns zeros instead of dividing by zero for a book with no headings, paragraphs, or pages', () => {
      const paginated = paginate([]);

      const metrics = calculator.calculateQualityMetrics(paginated);

      expect(paginated.pages).toHaveLength(0);
      expect(metrics).toMatchObject({
        headingCount: 0,
        paragraphCount: 0,
        averageHeadingDepth: 0,
        paragraphDensity: 0,
        lineDensity: 0,
        averageChapterLength: 0,
        estimatedPageCount: 0,
        dropCaps: 0,
        widowsAndOrphans: 0,
        emptyHeadings: 0,
        inconsistentSpacing: 0,
      });
    });
  });
});
