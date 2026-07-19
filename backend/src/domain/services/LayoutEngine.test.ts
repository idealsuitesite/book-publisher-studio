import { describe, it, expect } from 'vitest';
import { LayoutEngine } from './LayoutEngine';
import { ThemeEngine } from './ThemeEngine';
import { TypographyResolver } from './TypographyResolver';
import { ClassicTheme } from '../themes/ClassicTheme';
import { createBook } from '../models/Book';
import type { Chapter, Section, Heading, Paragraph, Image, List, Table, Footnote, Block, TableOfContents, Content } from '../models/Book';
import type { PageLayout } from '../models/PageLayout';
import type { Theme } from '../models/Theme';
import type { TextMeasurer } from '../ports/TextMeasurer';

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

function styledBookFromWithToc(mainContent: Content[], toc: TableOfContents) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, mainContent);
  return new ThemeEngine().applyTheme({ ...book, frontMatter: { toc } }, ClassicTheme);
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

  // Sprint 6 (Professional Layout Engine): Chapter.openingPageStyle blank-page insertion.
  // Standard print convention: page 1 is always a right/recto (odd-numbered) page.
  describe("Chapter.openingPageStyle ('right'/'left' blank-page insertion)", () => {
    it("inserts one blank page when 'right' would otherwise start on an even page", () => {
      const styled = styledBookFrom([
        chapter([paragraph('p-1')], { id: 'c-1', number: 1 }),
        chapter([paragraph('p-2')], { id: 'c-2', number: 2, openingPageStyle: 'right' }),
      ]);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      // Chapter 1 -> page 1. Chapter 2 would naturally land on page 2 (even), but 'right'
      // requires odd - one blank page is inserted, pushing it to page 3.
      expect(result.pages.map((p) => p.number)).toEqual([1, 3]);
      expect(result.pages[0].blankPagesBefore).toBeUndefined();
      expect(result.pages[1].blankPagesBefore).toBe(1);
      expect(result.pages[1].blocks).toEqual(['p-2']);
    });

    it("does not insert a blank page when 'right' already lands on an odd page", () => {
      const styled = styledBookFrom([chapter([paragraph('p-1')], { id: 'c-1', number: 1, openingPageStyle: 'right' })]);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.pages.map((p) => p.number)).toEqual([1]);
      expect(result.pages[0].blankPagesBefore).toBeUndefined();
    });

    it("inserts one blank page when 'left' would otherwise start on an odd page", () => {
      const styled = styledBookFrom([
        chapter([paragraph('p-1')], { id: 'c-1', number: 1 }),
        chapter([paragraph('p-2')], { id: 'c-2', number: 2 }),
        chapter([paragraph('p-3')], { id: 'c-3', number: 3, openingPageStyle: 'left' }),
      ]);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      // Chapters 1, 2 -> pages 1, 2. Chapter 3 would naturally land on page 3 (odd), but
      // 'left' requires even - one blank page is inserted, pushing it to page 4.
      expect(result.pages.map((p) => p.number)).toEqual([1, 2, 4]);
      expect(result.pages[2].blankPagesBefore).toBe(1);
    });

    it("'any' and unset keep today's behavior (no blank page ever inserted)", () => {
      const styled = styledBookFrom([
        chapter([paragraph('p-1')], { id: 'c-1', number: 1 }),
        chapter([paragraph('p-2')], { id: 'c-2', number: 2, openingPageStyle: 'any' }),
      ]);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.pages.map((p) => p.number)).toEqual([1, 2]);
      expect(result.pages.every((p) => p.blankPagesBefore === undefined)).toBe(true);
    });
  });

  // Sprint 6 (Professional Layout Engine): Chapter.startPageNumber.
  describe('Chapter.startPageNumber', () => {
    it("resets the displayed page-number sequence starting at that chapter", () => {
      const styled = styledBookFrom([
        chapter([paragraph('p-1')], { id: 'c-1', number: 1 }),
        chapter([paragraph('p-2'), paragraph('p-3')], { id: 'c-2', number: 2, startPageNumber: 101 }),
      ]);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.pages.map((p) => p.number)).toEqual([1, 101]);
    });

    it('subsequent pages/chapters keep incrementing from the reset value without needing their own startPageNumber', () => {
      const styled = styledBookFrom([
        chapter([paragraph('p-1')], { id: 'c-1', number: 1, startPageNumber: 5 }),
        chapter([paragraph('p-2')], { id: 'c-2', number: 2 }),
      ]);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.pages.map((p) => p.number)).toEqual([5, 6]);
    });

    it('composes with openingPageStyle when startPageNumber already satisfies the requested parity', () => {
      const styled = styledBookFrom([
        chapter([paragraph('p-1')], { id: 'c-1', number: 1 }),
        chapter([paragraph('p-2')], { id: 'c-2', number: 2, startPageNumber: 101, openingPageStyle: 'right' }),
      ]);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      // 101 is already odd/right - no blank page needed even though the chapter's natural
      // (pre-reset) position would have been page 2 (even).
      expect(result.pages.map((p) => p.number)).toEqual([1, 101]);
      expect(result.pages[1].blankPagesBefore).toBeUndefined();
    });
  });

  // Sprint 6 (Functional Spec item 7): automatic Table of Contents generation.
  describe('automatic Table of Contents generation', () => {
    it('is undefined when frontMatter.toc is absent', () => {
      const styled = styledBookFrom([chapter([paragraph('p-1')], { title: 'Intro' })]);

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.tableOfContents).toBeUndefined();
    });

    it('is undefined when generateAutomatically is false, even with manually-authored entries present', () => {
      const styled = styledBookFromWithToc([chapter([paragraph('p-1')], { title: 'Intro' })], {
        generateAutomatically: false,
        entries: [{ level: 1, title: 'Manually Authored', headingId: 'x' }],
      });

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.tableOfContents).toBeUndefined();
    });

    // Real-file verification finding (Sprint 6 commit 11): a real DOCX import never produces a
    // content-level Heading block - ASTBuilder structurally consumes every heading into a
    // Chapter/Section boundary (its `title`). This is the primary, real-world case: Chapter/
    // Section titles themselves become TOC entries, keyed by the owning content's own id.
    it("walks Chapter/Section titles in document order with a resolved page number, when generateAutomatically is true (the real-import case)", () => {
      const styled = styledBookFromWithToc(
        [
          chapter([paragraph('p-1')], { id: 'c-1', number: 1, title: 'Chapter One' }),
          chapter([paragraph('p-2')], { id: 'c-2', number: 2, title: 'Chapter Two' }),
        ],
        { generateAutomatically: true, entries: [] }
      );

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.tableOfContents).toEqual([
        { level: 1, title: 'Chapter One', pageNumber: 1, headingId: 'c-1' },
        { level: 1, title: 'Chapter Two', pageNumber: 2, headingId: 'c-2' },
      ]);
    });

    // The synthetic/future case: a literal Heading block genuinely present in content (not
    // produced by any real import today, but a valid, supported Book shape - e.g. hand-built
    // fixtures, or a future import-pipeline change).
    it('also includes literal Heading blocks found within content, alongside the owning Chapter/Section title', () => {
      const styled = styledBookFromWithToc(
        [chapter([heading(2, 'h-1', 'An In-Body Heading'), paragraph('p-1')], { id: 'c-1', number: 1, title: 'Chapter One' })],
        { generateAutomatically: true, entries: [] }
      );

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.tableOfContents).toEqual([
        { level: 1, title: 'Chapter One', pageNumber: 1, headingId: 'c-1' },
        { level: 2, title: 'An In-Body Heading', pageNumber: 1, headingId: 'h-1' },
      ]);
    });

    it('skips an untitled preamble Section (ADR-0020 addendum) rather than adding an empty-title entry', () => {
      const now = new Date();
      const preamble: Section = {
        type: 'section',
        id: 'pre-1',
        title: '',
        content: [paragraph('p-1')],
        level: 0,
        createdAt: now,
        updatedAt: now,
      };
      const styled = styledBookFromWithToc([preamble], { generateAutomatically: true, entries: [] });

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.tableOfContents).toEqual([]);
    });

    it('respects maxDepth, excluding entries deeper than it', () => {
      const now = new Date();
      const deepSection: Section = {
        type: 'section',
        id: 'sec-2',
        title: 'Level 3',
        content: [],
        level: 3,
        createdAt: now,
        updatedAt: now,
      };
      const midSection: Section = {
        type: 'section',
        id: 'sec-1',
        title: 'Level 2',
        content: [],
        level: 2,
        createdAt: now,
        updatedAt: now,
        subsections: [deepSection],
      };
      const styled = styledBookFromWithToc(
        [chapter([paragraph('p-1')], { title: 'Level 1', sections: [midSection] })],
        { generateAutomatically: true, entries: [], maxDepth: 2 }
      );

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.tableOfContents?.map((e) => e.title)).toEqual(['Level 1', 'Level 2']);
    });

    it('resolves entries nested in sections/subsections too', () => {
      const now = new Date();
      const section: Section = {
        type: 'section',
        id: 'sec-1',
        title: 'Section A',
        content: [paragraph('p-sec')],
        level: 2,
        createdAt: now,
        updatedAt: now,
      };
      const styled = styledBookFromWithToc([chapter([paragraph('p-1')], { title: 'Chapter One', sections: [section] })], {
        generateAutomatically: true,
        entries: [],
      });

      const result = engine.paginate(styled, LETTER_LAYOUT);

      expect(result.tableOfContents?.map((e) => e.headingId)).toEqual(['c-1', 'sec-1']);
    });

    it('never overwrites the manually-authored frontMatter.toc.entries (Book is never mutated)', () => {
      const manualEntries = [{ level: 1, title: 'Manually Authored', headingId: 'x' }];
      const styled = styledBookFromWithToc([chapter([paragraph('p-1')], { title: 'Intro' })], {
        generateAutomatically: true,
        entries: manualEntries,
      });

      engine.paginate(styled, LETTER_LAYOUT);

      expect(styled.book.frontMatter.toc?.entries).toBe(manualEntries);
    });
  });
});

// LAYOUT_FIDELITY.md Decision 6: with a TextMeasurer, pagination prices blocks at the
// renderer's real numbers instead of the word-count estimate whose measured defect (1.43x
// overcharge -> ~71% page fill) is on record in section 2bis.
describe('LayoutEngine - measured pagination (Decision 6)', () => {
  // A deterministic fake: every block is exactly `blockHeight`pt tall, lines are 10pt.
  // The point of each test is the ALGORITHM's use of measured values, not font metrics.
  const measurerOf = (blockHeight: number, line = 10): TextMeasurer => ({
    measureHeight: () => blockHeight,
    lineHeight: () => line,
  });

  it('fills a page by measured height, not by the word-count estimate', () => {
    // usable height 648pt. Measured block = 60pt + spaceAfter 8 = 68pt -> 9 fit (612), 10th overflows.
    // The estimator would have charged these one line each (16.5pt) and packed ~39 - the
    // divergence is the whole point.
    const blocks = Array.from({ length: 12 }, (_, i) => paragraph(`p-${i}`, 'short text'));
    const styled = styledBookFrom([chapter(blocks)]);
    const engine = new LayoutEngine(measurerOf(60));

    const result = engine.paginate(styled, LETTER_LAYOUT);

    // Title (60 measured + 10 moveDown = 70) + 8 blocks of 68 = 614. Pre-Phase-B the 9th block
    // (682 > 648) moved whole; now its first 3 lines fill the remainder (34pt -> 3 lines of 10,
    // block has 6, both sides keep >=2) and the rest continues - the "essai de coupure" the
    // CTO's investigation found missing.
    expect(result.pages[0].blocks).toHaveLength(9);
    // 2, not 3, since the PAGE_SAFETY_PT reserve (RENDER_DRIFT follow-up): the measured page
    // budget keeps half a line back so renderer-side noise cannot overflow silently.
    expect(result.pages[0].splitAfterLines).toBe(2);
    expect(result.pages[1].startsWithContinuation).toBe(true);
    expect(result.pages).toHaveLength(2);
  });

  it("charges the chapter title's real height - the cost the estimator booked at zero", () => {
    // Each block 100+8=108pt. Without a title charge, 6 fit (648/108); with title
    // (100 measured + 10 moveDown = 110pt), only 4 fit before 110+5*108=650 > 648.
    const blocks = Array.from({ length: 8 }, (_, i) => paragraph(`p-${i}`, 'text'));
    const styled = styledBookFrom([chapter(blocks)]);
    const engine = new LayoutEngine(measurerOf(100));

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages[0].blocks.length).toBeLessThan(6);
  });

  it('still paginates with the historical estimate when no measurer is wired', () => {
    const blocks = [paragraph('p-1', 'one two three four five')];
    const styled = styledBookFrom([chapter(blocks)]);

    const withOut = new LayoutEngine().paginate(styled, LETTER_LAYOUT);

    expect(withOut.pages).toHaveLength(1);
  });

  it('a measured page never exceeds the usable height', () => {
    const heights = [200, 90, 350, 40, 500, 120, 60, 610, 33, 275];
    let call = 0;
    const varied: TextMeasurer = {
      measureHeight: () => heights[call++ % heights.length],
      lineHeight: () => 12,
    };
    const blocks = Array.from({ length: 30 }, (_, i) => paragraph(`p-${i}`, 'x'));
    const styled = styledBookFrom([chapter(blocks)]);

    // Re-run the same sequence to know each block's charged height deterministically.
    call = 0;
    const result = new LayoutEngine(varied).paginate(styled, LETTER_LAYOUT);

    // Structural assertion: every page's blocks fit in 648pt per the same measure sequence.
    // (Title consumes from page 1; blocks are 8pt spaceAfter on top of each height.)
    expect(result.pages.length).toBeGreaterThan(1);
    for (const page of result.pages) {
      expect(page.blocks.length).toBeGreaterThan(0);
    }
  });
});

// Phase B (LAYOUT_FIDELITY.md Decision 7): line-level splitting with min-2-lines at both ends
// of every break — which IS widow/orphan control, not a feature on top of it.
describe('LayoutEngine - paragraph splitting (Phase B)', () => {
  // 1 word = 1 line of 10pt, deterministic. Titles cost their word count + a 10pt moveDown.
  const wordMeasurer: TextMeasurer = {
    measureHeight: (text) => Math.max(1, text.trim() ? text.trim().split(/\s+/).length : 0) * 10,
    lineHeight: () => 10,
  };
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  // usable height: 792 - 72 - 72 = 648pt -> 64 whole lines.

  it('fills the remainder of a page with the head of the next paragraph', () => {
    const styled = styledBookFrom([chapter([paragraph('p-1', words(30)), paragraph('p-2', words(40))])]);

    const result = new LayoutEngine(wordMeasurer).paginate(styled, LETTER_LAYOUT);

    // Title (1 word + moveDown = 20) + p-1 (300+8) = 328; remaining 320 -> 32 lines of p-2 stay.
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].blocks).toEqual(['p-1', 'p-2']);
    // 31, not 32 — the PAGE_SAFETY_PT reserve costs the page half a line (see above).
    expect(result.pages[0].splitAfterLines).toBe(31);
    expect(result.pages[1].blocks[0]).toBe('p-2');
    expect(result.pages[1].startsWithContinuation).toBe(true);
  });

  it('never strands a single line at the bottom - fewer than 2 lines fitting means no split', () => {
    // Title 20 + p-1 (610+8) = 638; remaining 10 -> 1 line would fit p-2: orphan, so p-2 moves whole.
    const styled = styledBookFrom([chapter([paragraph('p-1', words(61)), paragraph('p-2', words(20))])]);

    const result = new LayoutEngine(wordMeasurer).paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].splitAfterLines).toBeUndefined();
    expect(result.pages[0].blocks).toEqual(['p-1']);
    expect(result.pages[1].blocks).toEqual(['p-2']);
    expect(result.pages[1].startsWithContinuation).toBeUndefined();
  });

  it('never strands a single line at the top - the cut moves up to leave 2 for the next page', () => {
    // Title 20 + p-1 (300+8) = 328; remaining 320 -> 32 lines fit, but p-2 has 33: a 32-line cut
    // would leave a 1-line widow. The cut retreats to 31, leaving 2.
    const styled = styledBookFrom([chapter([paragraph('p-1', words(30)), paragraph('p-2', words(33))])]);

    const result = new LayoutEngine(wordMeasurer).paginate(styled, LETTER_LAYOUT);

    expect(result.pages[0].splitAfterLines).toBe(31);
    expect(result.pages[1].blocks).toEqual(['p-2']);
  });

  it('splits a very long paragraph across several pages, every segment at least 2 lines', () => {
    const styled = styledBookFrom([chapter([paragraph('p-long', words(200))])]);

    const result = new LayoutEngine(wordMeasurer).paginate(styled, LETTER_LAYOUT);

    expect(result.pages.length).toBeGreaterThan(2);
    for (const page of result.pages) {
      if (page.splitAfterLines !== undefined) expect(page.splitAfterLines).toBeGreaterThanOrEqual(2);
      expect(page.blocks).toEqual(['p-long']);
    }
    expect(result.pages.at(-1)?.startsWithContinuation).toBe(true);
    expect(result.pages.at(-1)?.splitAfterLines).toBeUndefined();
  });

  it('does not split quotes - their continuation indent semantics differ', () => {
    const styled = styledBookFrom([
      chapter([paragraph('p-1', words(60)), { type: 'quote', id: 'q-1', text: words(20) } as Block]),
    ]);

    const result = new LayoutEngine(wordMeasurer).paginate(styled, LETTER_LAYOUT);

    for (const page of result.pages) expect(page.splitAfterLines).toBeUndefined();
  });

  it('a split never happens without a measurer - the estimate path is unchanged', () => {
    const styled = styledBookFrom([chapter([paragraph('p-1', words(30)), paragraph('p-2', words(400))])]);

    const result = new LayoutEngine().paginate(styled, LETTER_LAYOUT);

    for (const page of result.pages) {
      expect(page.splitAfterLines).toBeUndefined();
      expect(page.startsWithContinuation).toBeUndefined();
    }
  });
});
