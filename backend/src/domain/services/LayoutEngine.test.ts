import { describe, it, expect } from 'vitest';
import { LayoutEngine } from './LayoutEngine';
import { ThemeEngine } from './ThemeEngine';
import { TypographyResolver } from './TypographyResolver';
import { ClassicTheme } from '../themes/ClassicTheme';
import { createBook } from '../models/Book';
import type { Chapter, Section, Heading, Paragraph, Image, List, Table, Footnote, Block } from '../models/Book';
import type { PageLayout } from '../models/PageLayout';
import type { Theme } from '../models/Theme';

const LETTER_LAYOUT: PageLayout = {
  pageSize: 'letter',
  width: 612,
  height: 792,
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
};

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, id: string, text = 'A Heading'): Heading {
  return { type: 'heading', id, level, text };
}

function paragraph(id: string, text = 'Some body text.'): Paragraph {
  return { type: 'paragraph', id, text };
}

function image(id: string, height?: number): Image {
  return { type: 'image', id, url: 'https://example.com/a.png', height };
}

function list(id: string, items: string[]): List {
  return { type: 'list', id, ordered: false, items };
}

function table(id: string, rows: string[][]): Table {
  return { type: 'table', id, headers: ['A'], rows };
}

function footnote(id: string): Footnote {
  return { type: 'footnote', id, number: 1, content: 'See appendix.' };
}

function chapter(content: Block[], overrides: Partial<Chapter> = {}): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: overrides.id ?? 'c-1',
    number: overrides.number ?? 1,
    title: 'Chapter',
    content,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function styledBookFrom(chapters: Chapter[]) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  return new ThemeEngine().applyTheme(book, ClassicTheme);
}

function styledBookFromWithTheme(chapters: Chapter[], theme: Theme) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  return new ThemeEngine().applyTheme(book, theme);
}

// Chains TypographyResolver after ThemeEngine, so blockTypography (and its
// staysWithNext flag on headings) is actually populated - styledBookFrom() above
// deliberately does not do this, to keep the existing pre-TypographyResolver test
// cases exercising LayoutEngine with blockTypography absent, exactly as
// ExportManuscriptUseCase's pipeline behaved before commit 4.
function typesetBookFrom(chapters: Chapter[]) {
  return new TypographyResolver().resolve(styledBookFrom(chapters));
}

describe('LayoutEngine', () => {
  const engine = new LayoutEngine();

  it('places a small book entirely on one page', () => {
    const styled = styledBookFrom([chapter([heading(1, 'h-1'), paragraph('p-1')])]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].blocks).toEqual(['h-1', 'p-1']);
    expect(result.styledBook).toBe(styled);
  });

  it('returns no pages for an empty book', () => {
    const styled = styledBookFrom([]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(0);
  });

  it('breaks to a new page when content exceeds the usable page height', () => {
    const manyParagraphs = Array.from({ length: 200 }, (_, i) => paragraph(`p-${i}`, 'word '.repeat(50)));
    const styled = styledBookFrom([chapter(manyParagraphs)]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages.length).toBeGreaterThan(1);
    const allBlocks = result.pages.flatMap((p) => p.blocks);
    expect(allBlocks).toEqual(manyParagraphs.map((p) => p.id));
  });

  it('starts a new page at the beginning of each chapter after the first', () => {
    const styled = styledBookFrom([
      chapter([paragraph('p-1')], { id: 'c-1', number: 1 }),
      chapter([paragraph('p-2')], { id: 'c-2', number: 2 }),
    ]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].blocks).toEqual(['p-1']);
    expect(result.pages[1].blocks).toEqual(['p-2']);
  });

  it('uses an image block height directly rather than estimating from text', () => {
    const styled = styledBookFrom([chapter([image('img-1', 400)])]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].blocks).toEqual(['img-1']);
  });

  it('numbers pages sequentially starting at 1', () => {
    const manyParagraphs = Array.from({ length: 200 }, (_, i) => paragraph(`p-${i}`, 'word '.repeat(50)));
    const styled = styledBookFrom([chapter(manyParagraphs)]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages.map((p) => p.number)).toEqual(result.pages.map((_, i) => i + 1));
  });

  it('estimates height for list, table, and footnote blocks without throwing', () => {
    const styled = styledBookFrom([
      chapter([list('l-1', ['One', 'Two', 'Three']), table('t-1', [['1']]), footnote('f-1')]),
    ]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages[0].blocks).toEqual(['l-1', 't-1', 'f-1']);
  });

  it('paginates blocks nested in sections and subsections, in document order', () => {
    const now = new Date();
    const section: Section = {
      type: 'section',
      id: 'sec-1',
      title: 'Section A',
      content: [paragraph('p-sec')],
      level: 2,
      createdAt: now,
      updatedAt: now,
      subsections: [
        {
          type: 'section',
          id: 'sec-2',
          title: 'Section B',
          content: [paragraph('p-subsec')],
          level: 3,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
    const styled = styledBookFrom([chapter([paragraph('p-1')], { sections: [section] })]);

    const result = engine.paginate(styled, LETTER_LAYOUT);
    const allBlocks = result.pages.flatMap((p) => p.blocks);

    expect(allBlocks).toEqual(['p-1', 'p-sec', 'p-subsec']);
  });

  it('carries a heading onto the next page instead of stranding it when the following block does not fit', () => {
    const fillers = Array.from({ length: 39 }, (_, i) => paragraph(`f-${i}`, 'Filler.'));
    const styled = typesetBookFrom([chapter([...fillers, heading(1, 'h-1'), paragraph('p-big', 'word '.repeat(50))])]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].blocks).toEqual(fillers.map((f) => f.id));
    expect(result.pages[1].blocks).toEqual(['h-1', 'p-big']);
  });

  it('strands the heading alone when blockTypography is absent (documents the pre-commit-4 behavior this feature changes)', () => {
    const fillers = Array.from({ length: 39 }, (_, i) => paragraph(`f-${i}`, 'Filler.'));
    const styled = styledBookFrom([chapter([...fillers, heading(1, 'h-1'), paragraph('p-big', 'word '.repeat(50))])]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].blocks).toEqual([...fillers.map((f) => f.id), 'h-1']);
    expect(result.pages[1].blocks).toEqual(['p-big']);
  });

  // Sprint 6 (Professional Layout Engine): per-page running-head title resolution.
  describe('headerFooterTitle resolution (Theme.runningHead)', () => {
    it("resolves every page's title to the book's title when content is 'bookTitle' (ClassicTheme's default)", () => {
      const styled = styledBookFrom([
        chapter([paragraph('p-1')], { id: 'c-1', number: 1, title: 'Chapter One' }),
        chapter([paragraph('p-2')], { id: 'c-2', number: 2, title: 'Chapter Two' }),
      ]);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.pages.map((p) => p.headerFooterTitle)).toEqual(['T', 'T']);
    });

    it("resolves each page's title to its own chapter's title when content is 'chapterTitle'", () => {
      const theme: Theme = { ...ClassicTheme, runningHead: { ...ClassicTheme.runningHead!, content: 'chapterTitle' } };
      const styled = styledBookFromWithTheme(
        [
          chapter([paragraph('p-1')], { id: 'c-1', number: 1, title: 'Chapter One' }),
          chapter([paragraph('p-2')], { id: 'c-2', number: 2, title: 'Chapter Two' }),
        ],
        theme
      );

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.pages.map((p) => p.headerFooterTitle)).toEqual(['Chapter One', 'Chapter Two']);
    });

    it('leaves headerFooterTitle undefined when the theme has no runningHead at all', () => {
      const theme: Theme = { ...ClassicTheme, runningHead: undefined };
      const styled = styledBookFromWithTheme([chapter([paragraph('p-1')])], theme);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.pages[0].headerFooterTitle).toBeUndefined();
    });

    it('leaves headerFooterTitle undefined when runningHead.show is false', () => {
      const theme: Theme = { ...ClassicTheme, runningHead: { ...ClassicTheme.runningHead!, show: false } };
      const styled = styledBookFromWithTheme([chapter([paragraph('p-1')])], theme);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.pages[0].headerFooterTitle).toBeUndefined();
    });
  });
});
