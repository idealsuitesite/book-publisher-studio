import { describe, it, expect } from 'vitest';
import { ASTBuilder } from './ASTBuilder';
import type {
  NormalizedDocument,
  AnyNormalizedNode,
  HeadingNode,
  ParagraphNode,
  ImageNode,
  TableNode,
  ScriptureNode,
  QuoteNode,
  ListNode,
  FootnoteNode,
  InlineNode,
} from '../models/Normalized';
import type { Chapter, Section } from '../models/Book';

let autoIndex = 0;
function nextIndex(): number {
  autoIndex += 1;
  return autoIndex;
}

function heading(level: number, text: string): HeadingNode {
  return {
    id: `n-${nextIndex()}`,
    type: 'heading',
    level,
    text,
    source: { originalIndex: nextIndex() },
  };
}

function paragraph(text: string): ParagraphNode {
  return {
    id: `n-${nextIndex()}`,
    type: 'paragraph',
    inlines: [{ type: 'text', text }],
    source: { originalIndex: nextIndex() },
  };
}

function image(overrides: Partial<ImageNode['image']> = {}): ImageNode {
  return {
    id: `n-${nextIndex()}`,
    type: 'image',
    image: { url: 'https://example.com/cover.png', ...overrides },
    source: { originalIndex: nextIndex() },
  };
}

function table(rows: TableNode['rows']): TableNode {
  return {
    id: `n-${nextIndex()}`,
    type: 'table',
    rows,
    source: { originalIndex: nextIndex() },
  };
}

function scripture(text: string, reference?: string): ScriptureNode {
  return {
    id: `n-${nextIndex()}`,
    type: 'scripture',
    text,
    reference,
    source: { originalIndex: nextIndex() },
  };
}

function quote(text: string, attribution?: string): QuoteNode {
  return {
    id: `n-${nextIndex()}`,
    type: 'quote',
    inlines: [{ type: 'text', text }],
    attribution,
    source: { originalIndex: nextIndex() },
  };
}

function list(items: string[], ordered = false): ListNode {
  return {
    id: `n-${nextIndex()}`,
    type: 'list',
    ordered,
    items,
    source: { originalIndex: nextIndex() },
  };
}

function footnote(content: string): FootnoteNode {
  return {
    id: `n-${nextIndex()}`,
    type: 'footnote',
    content,
    source: { originalIndex: nextIndex() },
  };
}

function paragraphWithInlines(inlines: InlineNode[]): ParagraphNode {
  return {
    id: `n-${nextIndex()}`,
    type: 'paragraph',
    inlines,
    source: { originalIndex: nextIndex() },
  };
}

function buildDocument(nodes: AnyNormalizedNode[]): NormalizedDocument {
  return {
    metadata: {
      fileName: 'manuscript.docx',
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    },
    nodes,
  };
}

function isChapter(content: unknown): content is Chapter {
  return (content as Chapter).type === 'chapter';
}

function isSection(content: unknown): content is Section {
  return (content as Section).type === 'section';
}

describe('ASTBuilder', () => {
  describe('Chapter grouping', () => {
    it('creates a single chapter from one level-1 heading', () => {
      const doc = buildDocument([heading(1, 'Chapter One')]);
      const book = new ASTBuilder().build(doc);

      expect(book.mainContent).toHaveLength(1);
      expect(isChapter(book.mainContent[0])).toBe(true);
      expect((book.mainContent[0] as Chapter).title).toBe('Chapter One');
      expect((book.mainContent[0] as Chapter).number).toBe(1);
    });

    it('groups paragraphs following a heading into that chapter content', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        paragraph('First paragraph.'),
        paragraph('Second paragraph.'),
      ]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;

      expect(chapter.content).toHaveLength(2);
      expect(chapter.content[0].type).toBe('paragraph');
      // Cast au type Paragraph pour accéder à .text
      expect((chapter.content[0] as any).text).toBe('First paragraph.');
    });

    it('numbers multiple chapters sequentially', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        paragraph('Intro.'),
        heading(1, 'Chapter Two'),
        paragraph('More.'),
      ]);
      const book = new ASTBuilder().build(doc);

      expect(book.mainContent).toHaveLength(2);
      expect((book.mainContent[0] as Chapter).number).toBe(1);
      expect((book.mainContent[1] as Chapter).number).toBe(2);
    });

    it('produces an empty-content chapter when immediately followed by another heading', () => {
      const doc = buildDocument([heading(1, 'Chapter One'), heading(1, 'Chapter Two')]);
      const book = new ASTBuilder().build(doc);

      expect((book.mainContent[0] as Chapter).content).toHaveLength(0);
    });

    it('wraps leading content before any chapter heading into an untitled top-level section', () => {
      const doc = buildDocument([
        paragraph('Opening line before any chapter.'),
        heading(1, 'Chapter One'),
      ]);
      const book = new ASTBuilder().build(doc);

      expect(book.mainContent).toHaveLength(2);
      expect(isSection(book.mainContent[0])).toBe(true);
      expect((book.mainContent[0] as Section).title).toBe('');
      expect((book.mainContent[0] as Section).content).toHaveLength(1);
    });
  });

  describe('Section grouping', () => {
    it('creates a section from a level-2 heading nested under the current chapter', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        heading(2, 'Section A'),
        paragraph('Body.'),
      ]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;

      expect(chapter.sections).toHaveLength(1);
      expect(chapter.sections?.[0].title).toBe('Section A');
      expect(chapter.sections?.[0].content).toHaveLength(1);
    });

    it('nests a level-3 heading as a subsection under the current level-2 section', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        heading(2, 'Section A'),
        heading(3, 'Subsection A.1'),
        paragraph('Deep body.'),
      ]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;
      const section = chapter.sections?.[0] as Section;

      expect(section.subsections).toHaveLength(1);
      expect(section.subsections?.[0].title).toBe('Subsection A.1');
      expect(section.subsections?.[0].content).toHaveLength(1);
    });

    it('resets section nesting when a new chapter starts', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        heading(2, 'Section A'),
        heading(1, 'Chapter Two'),
        heading(2, 'Section B'),
      ]);
      const book = new ASTBuilder().build(doc);
      const chapterTwo = book.mainContent[1] as Chapter;

      expect(chapterTwo.sections).toHaveLength(1);
      expect(chapterTwo.sections?.[0].title).toBe('Section B');
    });

    it('creates a top-level section when a level-2 heading appears before any chapter', () => {
      const doc = buildDocument([heading(2, 'Standalone Section'), paragraph('Body.')]);
      const book = new ASTBuilder().build(doc);

      expect(book.mainContent).toHaveLength(1);
      expect(isSection(book.mainContent[0])).toBe(true);
      expect((book.mainContent[0] as Section).title).toBe('Standalone Section');
    });
  });

  describe('Metrics calculation', () => {
    it('leaves wordCount/pageCount/readingTime undefined (owned by BookMetricsCalculator now)', () => {
      const doc = buildDocument([heading(1, 'Chapter One'), paragraph('Some words here.')]);
      const book = new ASTBuilder().build(doc);

      expect(book.wordCount).toBeUndefined();
      expect(book.pageCount).toBeUndefined();
      expect(book.readingTime).toBeUndefined();
    });
  });

  describe('ID generation', () => {
    it('generates unique sequential IDs for chapters', () => {
      const doc = buildDocument([heading(1, 'Chapter One'), heading(1, 'Chapter Two')]);
      const book = new ASTBuilder().build(doc);

      const ids = book.mainContent.map((c) => (c as Chapter).id);
      expect(ids[0]).toMatch(/^chapter-/);
      expect(ids[1]).toMatch(/^chapter-/);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('generates unique sequential IDs for sections across multiple chapters', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        heading(2, 'Section A'),
        heading(1, 'Chapter Two'),
        heading(2, 'Section B'),
      ]);
      const book = new ASTBuilder().build(doc);

      const sectionIdChapterOne = (book.mainContent[0] as Chapter).sections?.[0].id;
      const sectionIdChapterTwo = (book.mainContent[1] as Chapter).sections?.[0].id;
      expect(sectionIdChapterOne).toMatch(/^section-/);
      expect(sectionIdChapterTwo).toMatch(/^section-/);
      expect(sectionIdChapterOne).not.toBe(sectionIdChapterTwo);
    });
  });

  describe('FrontMatter / BackMatter', () => {
    it('returns an empty frontMatter object', () => {
      const book = new ASTBuilder().build(buildDocument([heading(1, 'Chapter One')]));
      expect(book.frontMatter).toEqual({});
    });

    it('returns an empty backMatter object', () => {
      const book = new ASTBuilder().build(buildDocument([heading(1, 'Chapter One')]));
      expect(book.backMatter).toEqual({});
    });
  });

  describe('Block conversion', () => {
    it('converts an image node into an Image block', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        image({ caption: 'A cover', alt: 'Cover art', width: 800, height: 600 }),
      ]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;

      expect(chapter.content[0].type).toBe('image');
      const img = chapter.content[0] as any;
      expect(img.url).toBe('https://example.com/cover.png');
      expect(img.caption).toBe('A cover');
      expect(img.alt).toBe('Cover art');
      expect(img.width).toBe(800);
      expect(img.height).toBe(600);
    });

    it('splits a table node into headers and body rows', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        table([{ cells: ['Name', 'Age'], isHeader: true }, { cells: ['Alexandre', '30'] }]),
      ]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;

      expect(chapter.content[0].type).toBe('table');
      const tbl = chapter.content[0] as any;
      expect(tbl.headers).toEqual(['Name', 'Age']);
      expect(tbl.rows).toEqual([['Alexandre', '30']]);
    });

    it('parses a scripture reference string into book/chapter/verses', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        scripture('For God so loved the world', 'John 3:16'),
      ]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;

      expect(chapter.content[0].type).toBe('scripture');
      const scr = chapter.content[0] as any;
      expect(scr.reference).toEqual({ book: 'John', chapter: 3, verses: '16' });
    });

    it('leaves the reference undefined for an unparseable scripture reference string', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        scripture('Some text', 'not a valid reference'),
      ]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;

      const scr = chapter.content[0] as any;
      expect(scr.reference).toBeUndefined();
    });

    it('converts a quote node, defaulting quoteType to block', () => {
      const doc = buildDocument([heading(1, 'Chapter One'), quote('Some wisdom.', 'A. Author')]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;

      expect(chapter.content[0].type).toBe('quote');
      const q = chapter.content[0] as any;
      expect(q.attribution).toBe('A. Author');
      expect(q.quoteType).toBe('block');
    });

    it('converts a list node', () => {
      const doc = buildDocument([heading(1, 'Chapter One'), list(['One', 'Two'], true)]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;

      expect(chapter.content[0].type).toBe('list');
      const l = chapter.content[0] as any;
      expect(l.ordered).toBe(true);
      expect(l.items).toEqual(['One', 'Two']);
    });

    it('converts a footnote node with a sequential number', () => {
      const doc = buildDocument([heading(1, 'Chapter One'), footnote('See appendix A.')]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;

      expect(chapter.content[0].type).toBe('footnote');
      const fn = chapter.content[0] as any;
      expect(fn.number).toBe(1);
      expect(fn.content).toBe('See appendix A.');
    });

    it('converts inline formatting: bold, italic, underline, link, small-caps', () => {
      const doc = buildDocument([
        heading(1, 'Chapter One'),
        paragraphWithInlines([
          { type: 'bold', text: 'bold' },
          { type: 'italic', text: 'italic' },
          { type: 'underline', text: 'underline' },
          { type: 'link', text: 'link', url: 'https://example.com' },
          { type: 'small-caps', text: 'caps' },
        ]),
      ]);
      const book = new ASTBuilder().build(doc);
      const chapter = book.mainContent[0] as Chapter;
      const p = chapter.content[0] as any;

      expect(p.inlines).toEqual([
        { type: 'bold', text: 'bold' },
        { type: 'italic', text: 'italic' },
        { type: 'underline', text: 'underline' },
        { type: 'link', text: 'link', url: 'https://example.com' },
        { type: 'small-caps', text: 'caps' },
      ]);
    });
  });
});
