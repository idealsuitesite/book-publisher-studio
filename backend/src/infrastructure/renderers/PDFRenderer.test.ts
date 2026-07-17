import { describe, it, expect } from 'vitest';
import { PDFRenderer } from './PDFRenderer';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { createBook } from '../../domain/models/Book';
import type { Chapter, Heading, Paragraph, Table, Image } from '../../domain/models/Book';
import type { PageLayout } from '../../domain/models/PageLayout';
import { extractPdfText, countPdfPages } from '../../test-utils/extractPdfText';

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
  content: (Heading | Paragraph | Table | Image)[],
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

describe('PDFRenderer', () => {
  const renderer = new PDFRenderer({ compress: false });

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
