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
