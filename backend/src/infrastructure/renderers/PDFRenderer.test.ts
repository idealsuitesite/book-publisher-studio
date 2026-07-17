import { describe, it, expect } from 'vitest';
import { PDFRenderer } from './PDFRenderer';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { createBook } from '../../domain/models/Book';
import type { Chapter, Heading, Paragraph, Table, Image, List, InlineElement } from '../../domain/models/Book';
import type { PageLayout } from '../../domain/models/PageLayout';
import { extractPdfText, extractPdfRuns, countPdfPages } from '../../test-utils/extractPdfText';
import { PdfFontRegistry } from '../fonts/PdfFontRegistry';

const LETTER_LAYOUT: PageLayout = {
  pageSize: 'letter',
  width: 612,
  height: 792,
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
};

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, id: string, text: string): Heading {
  return { type: 'heading', id, level, text };
}

function paragraph(id: string, text = 'Some body text.'): Paragraph {
  return { type: 'paragraph', id, text };
}

function chapter(
  content: (Heading | Paragraph | Table | Image | List)[],
  overrides: Partial<Chapter> = {}
): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: overrides.id ?? 'c-1',
    number: overrides.number ?? 1,
    title: overrides.title ?? 'Chapter',
    content,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function paginate(chapters: Chapter[], layout: PageLayout = LETTER_LAYOUT) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
  return new LayoutEngine().paginate(styled, layout);
}

// Chains TypographyResolver after ThemeEngine, so blockTypography (inline runs, drop
// caps) is actually populated - paginate() above deliberately does not do this, so the
// existing pre-commit-5 test cases keep exercising the plain-text fallback path.
function paginateWithTypography(chapters: Chapter[], layout: PageLayout = LETTER_LAYOUT) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine().paginate(typeset, layout);
}

describe('PDFRenderer', () => {
  const renderer = new PDFRenderer({ compress: false });
  const fontRegistry = new PdfFontRegistry();

  it('produces a valid PDF starting with the %PDF header', async () => {
    const paginated = paginate([chapter([heading(1, 'h-1', 'Chapter One'), paragraph('p-1', 'Hello world.')])]);

    const buffer = await renderer.render(paginated, {});

    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('includes chapter titles and paragraph text', async () => {
    const paginated = paginate([chapter([paragraph('p-1', 'Hello world.')], { title: 'My Chapter' })]);

    const buffer = await renderer.render(paginated, {});
    const text = extractPdfText(buffer);

    expect(text).toContain('My Chapter');
    expect(text).toContain('Hello world.');
  });

  it('renders a table with headers and rows', async () => {
    const table: Table = { type: 'table', id: 't-1', headers: ['Name'], rows: [['Alexandre']] };
    const paginated = paginate([chapter([table])]);

    const buffer = await renderer.render(paginated, {});
    const text = extractPdfText(buffer);

    expect(text).toContain('Name');
    expect(text).toContain('Alexandre');
  });

  // Regression suite for a real bug found via npm run verify-real-export against a
  // genuine DOCX (backend/verification/tables.docx): a Word table with no distinguishable
  // header row makes ASTBuilder produce headers: [] - a common real-world shape, not a
  // malformed edge case. renderTable() divided usableWidth by headers.length (0),
  // producing Infinity, then NaN positioning the first cell - PDFKit rejected it and
  // every such export crashed with HTTP 500.
  describe('table rendering without a header row (renderTable column-count fallback)', () => {
    function pdfStart(buffer: Buffer): string {
      return buffer.subarray(0, 5).toString('latin1');
    }

    it('renders a table with headers, multiple columns', async () => {
      const table: Table = { type: 'table', id: 't-1', headers: ['Name', 'Role'], rows: [['Alexandre', 'Author']] };
      const buffer = await renderer.render(paginate([chapter([table])]), {});
      const text = extractPdfText(buffer);

      expect(pdfStart(buffer)).toBe('%PDF-');
      expect(text).toContain('Name');
      expect(text).toContain('Alexandre');
    });

    it('renders a table without headers (headers: []), multiple columns - the exact crash scenario', async () => {
      const table: Table = {
        type: 'table',
        id: 't-1',
        headers: [],
        rows: [
          ['Name', 'Role'],
          ['Alexandre', 'Author'],
        ],
      };
      const buffer = await renderer.render(paginate([chapter([table])]), {});
      const text = extractPdfText(buffer);

      expect(pdfStart(buffer)).toBe('%PDF-');
      expect(text).toContain('Name');
      expect(text).toContain('Alexandre');
    });

    it('renders nothing and does not throw for a genuinely empty table (no headers, no rows)', async () => {
      const table: Table = { type: 'table', id: 't-1', headers: [], rows: [] };
      const buffer = await renderer.render(paginate([chapter([table])]), {});

      expect(pdfStart(buffer)).toBe('%PDF-');
    });

    it('renders a single-column table with headers', async () => {
      const table: Table = { type: 'table', id: 't-1', headers: ['Only'], rows: [['A'], ['B']] };
      const buffer = await renderer.render(paginate([chapter([table])]), {});
      const text = extractPdfText(buffer);

      expect(pdfStart(buffer)).toBe('%PDF-');
      expect(text).toContain('Only');
      expect(text).toContain('A');
    });

    it('renders a single-column table without headers - column count falls back to the first data row', async () => {
      const table: Table = { type: 'table', id: 't-1', headers: [], rows: [['A'], ['B']] };
      const buffer = await renderer.render(paginate([chapter([table])]), {});
      const text = extractPdfText(buffer);

      expect(pdfStart(buffer)).toBe('%PDF-');
      expect(text).toContain('A');
      expect(text).toContain('B');
    });

    it('renders a multi-column table without headers', async () => {
      const table: Table = {
        type: 'table',
        id: 't-1',
        headers: [],
        rows: [
          ['A', 'B', 'C', 'D'],
          ['1', '2', '3', '4'],
        ],
      };
      const buffer = await renderer.render(paginate([chapter([table])]), {});
      const text = extractPdfText(buffer);

      expect(pdfStart(buffer)).toBe('%PDF-');
      expect(text).toContain('A');
      expect(text).toContain('4');
    });
  });

  it('inserts a page break when pagination calls for one', async () => {
    const manyParagraphs = Array.from({ length: 200 }, (_, i) => paragraph(`p-${i}`, 'word '.repeat(50)));
    const smallLayout: PageLayout = { ...LETTER_LAYOUT, height: 300 };
    const paginated = paginate([chapter(manyParagraphs)], smallLayout);
    expect(paginated.pages.length).toBeGreaterThan(1);

    const buffer = await renderer.render(paginated, {});

    expect(countPdfPages(buffer)).toBeGreaterThan(1);
  });

  it('falls back to a text placeholder for images without embedded base64 data', async () => {
    const image: Image = { type: 'image', id: 'img-1', url: 'https://example.com/a.png', caption: 'A cover' };
    const paginated = paginate([chapter([image])]);

    const buffer = await renderer.render(paginated, {});
    const text = extractPdfText(buffer);

    expect(text).toContain('A cover');
  });

  it('renders bold and italic inline runs, each using the font PdfFontRegistry resolves for that weight/style', async () => {
    const inlines: InlineElement[] = [
      { type: 'text', text: 'Plain ' },
      { type: 'bold', text: 'bold ' },
      { type: 'italic', text: 'italic.' },
    ];
    const para: Paragraph = { type: 'paragraph', id: 'p-1', text: 'ignored when inlines present', inlines };
    const paginated = paginateWithTypography([chapter([para])]);

    const buffer = await renderer.render(paginated, {});
    const text = extractPdfText(buffer);
    const runs = extractPdfRuns(buffer);

    // Functional check: the text is extracted correctly regardless of which fonts
    // rendered it.
    expect(text).toContain('Plain bold italic.');

    // Functional check: each styled run used the font PdfFontRegistry itself resolves
    // for that weight/style - derived from the registry's own public API, not a
    // hardcoded PDFKit-internal name (family choice, subset tagging, and PDFKit's own
    // naming are all implementation details this test should stay correct across).
    const plainFont = fontRegistry.resolve(ClassicTheme.fonts.body, false, false);
    const boldFont = fontRegistry.resolve(ClassicTheme.fonts.body, true, false);
    const italicFont = fontRegistry.resolve(ClassicTheme.fonts.body, false, true);

    expect(runs.find((r) => r.text.includes('Plain'))?.baseFont).toContain(plainFont);
    expect(runs.find((r) => r.text.includes('bold'))?.baseFont).toContain(boldFont);
    expect(runs.find((r) => r.text.includes('italic'))?.baseFont).toContain(italicFont);
  });

  it('sizes a level-1 heading from theme.fontSizes.h1, not the old hardcoded per-level formula', async () => {
    const paginated = paginateWithTypography([chapter([heading(1, 'h-1', 'Big Title')])]);

    const buffer = await renderer.render(paginated, {});
    const raw = buffer.toString('latin1');

    // ClassicTheme.fontSizes.h1 = 28. The formula this replaced (max(12, 28 - level*3))
    // would have produced 25 for a level-1 heading - asserting its absence catches a
    // regression back to the hardcoded formula, not just the presence of *a* size.
    expect(raw).toMatch(/\b28 Tf\b/);
    expect(raw).not.toMatch(/\b25 Tf\b/);
  });

  it("renders per-item inline runs within a list, using the correct resolved font for each item's style", async () => {
    const inlinesPerItem: InlineElement[][] = [[{ type: 'text', text: 'First' }], [{ type: 'bold', text: 'Second' }]];
    const list: List = { type: 'list', id: 'l-1', ordered: false, items: ['ignored', 'ignored'], inlines: inlinesPerItem };
    const paginated = paginateWithTypography([chapter([list])]);

    const buffer = await renderer.render(paginated, {});
    const text = extractPdfText(buffer);
    const runs = extractPdfRuns(buffer);

    expect(text).toContain('First');
    expect(text).toContain('Second');

    const boldFont = fontRegistry.resolve(ClassicTheme.fonts.body, true, false);
    expect(runs.find((r) => r.text.includes('Second'))?.baseFont).toContain(boldFont);
  });

  it("applies a drop cap by enlarging the paragraph's first character, without losing or duplicating text", async () => {
    const para: Paragraph = { type: 'paragraph', id: 'p-1', text: 'Once upon a time.', dropCap: true };
    const paginated = paginateWithTypography([chapter([para])]);

    const buffer = await renderer.render(paginated, {});
    const text = extractPdfText(buffer);
    const raw = buffer.toString('latin1');

    expect(text).toContain('Once upon a time.');
    // ClassicTheme body fontSize is 11; DROP_CAP_SCALE (2.5) makes the first letter 27.5pt.
    expect(raw).toMatch(/\b27\.5 Tf\b/);
  });

  it('stamps every page with an accurate running "Page N of TOTAL" footer', async () => {
    const manyParagraphs = Array.from({ length: 200 }, (_, i) => paragraph(`p-${i}`, 'word '.repeat(50)));
    const smallLayout: PageLayout = { ...LETTER_LAYOUT, height: 300 };
    const paginated = paginate([chapter(manyParagraphs)], smallLayout);

    const buffer = await renderer.render(paginated, {});
    const text = extractPdfText(buffer);
    const actualPageCount = countPdfPages(buffer);

    // ADR-0019 finding 6, bug C: this must equal the real rendered page count, not
    // PaginatedBook.pages.length (LayoutEngine's estimate) - real content can exceed the estimate.
    expect(text).toContain(`Page 1 of ${actualPageCount}`);
    expect(text).toContain(`Page ${actualPageCount} of ${actualPageCount}`);
  });
});
