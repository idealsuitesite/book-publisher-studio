import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { DOCXRenderer } from './DOCXRenderer';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { createBook } from '../../domain/models/Book';
import type { Chapter, Heading, Paragraph, Table, Image } from '../../domain/models/Book';
import type { PageLayout } from '../../domain/models/PageLayout';

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

async function extractDocumentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('word/document.xml missing from generated docx');
  return doc.async('string');
}

function paginate(chapters: Chapter[]) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
  return new LayoutEngine().paginate(styled, LETTER_LAYOUT);
}

describe('DOCXRenderer', () => {
  const renderer = new DOCXRenderer();

  it('produces a valid docx zip containing paragraph text', async () => {
    const paginated = paginate([chapter([heading(1, 'h-1', 'Chapter One'), paragraph('p-1', 'Hello world.')])]);

    const buffer = await renderer.render(paginated, {});

    expect(buffer.length).toBeGreaterThan(0);
    const xml = await extractDocumentXml(buffer);
    expect(xml).toContain('Hello world.');
  });

  it('includes chapter titles as headings', async () => {
    const paginated = paginate([chapter([paragraph('p-1')], { title: 'My Chapter' })]);

    const buffer = await renderer.render(paginated, {});
    const xml = await extractDocumentXml(buffer);

    expect(xml).toContain('My Chapter');
  });

  it('renders a table with headers and rows', async () => {
    const table: Table = { type: 'table', id: 't-1', headers: ['Name'], rows: [['Alexandre']] };
    const paginated = paginate([chapter([table])]);

    const buffer = await renderer.render(paginated, {});
    const xml = await extractDocumentXml(buffer);

    expect(xml).toContain('Name');
    expect(xml).toContain('Alexandre');
  });

  it('inserts a page break when pagination calls for one', async () => {
    const manyParagraphs = Array.from({ length: 200 }, (_, i) => paragraph(`p-${i}`, 'word '.repeat(50)));
    const paginated = paginate([chapter(manyParagraphs)]);
    expect(paginated.pages.length).toBeGreaterThan(1);

    const buffer = await renderer.render(paginated, {});
    const xml = await extractDocumentXml(buffer);

    expect(xml).toContain('<w:pageBreakBefore/>');
  });

  it('falls back to a text placeholder for images without embedded base64 data', async () => {
    const image: Image = { type: 'image', id: 'img-1', url: 'https://example.com/a.png', caption: 'A cover' };
    const paginated = paginate([chapter([image])]);

    const buffer = await renderer.render(paginated, {});
    const xml = await extractDocumentXml(buffer);

    expect(xml).toContain('A cover');
  });
});
