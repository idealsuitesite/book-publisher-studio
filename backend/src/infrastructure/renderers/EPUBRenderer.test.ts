import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { EPUBRenderer } from './EPUBRenderer';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { createBook } from '../../domain/models/Book';
import type { Chapter, Section, Content, Heading, Paragraph, Table, Image } from '../../domain/models/Book';

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

function section(content: (Heading | Paragraph)[], overrides: Partial<Section> = {}): Section {
  const now = new Date();
  return {
    type: 'section',
    id: overrides.id ?? 's-1',
    title: overrides.title ?? '',
    content,
    level: overrides.level ?? 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function paginate(mainContent: Content[]) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, mainContent);
  const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
  return new LayoutEngine().paginate(styled, LetterPageLayout);
}

async function extractChapterHtml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xhtmlFiles = Object.keys(zip.files).filter((f) => f.endsWith('.xhtml') && !f.includes('toc'));
  const texts = await Promise.all(xhtmlFiles.map((f) => zip.file(f)!.async('string')));
  return texts.join('\n');
}

describe('EPUBRenderer', () => {
  const renderer = new EPUBRenderer();

  it('produces a valid EPUB3 zip (mimetype first & uncompressed, OPF declares version 3.0)', async () => {
    const paginated = paginate([chapter([paragraph('p-1', 'Hello world.')])]);

    const buffer = await renderer.render(paginated, {});

    const zip = await JSZip.loadAsync(buffer);
    const entryOrder = Object.keys(zip.files);
    expect(entryOrder[0]).toBe('mimetype');
    expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip');

    const opfPath = entryOrder.find((f) => f.endsWith('.opf'));
    const opf = await zip.file(opfPath!)!.async('string');
    expect(opf).toContain('version="3.0"');
  });

  it('includes chapter titles and paragraph text', async () => {
    const paginated = paginate([chapter([paragraph('p-1', 'Hello world.')], { title: 'My Chapter' })]);

    const buffer = await renderer.render(paginated, {});
    const html = await extractChapterHtml(buffer);

    expect(html).toContain('My Chapter');
    expect(html).toContain('Hello world.');
  });

  it('renders a table with headers and rows', async () => {
    const table: Table = { type: 'table', id: 't-1', headers: ['Name'], rows: [['Alexandre']] };
    const paginated = paginate([chapter([table])]);

    const buffer = await renderer.render(paginated, {});
    const html = await extractChapterHtml(buffer);

    expect(html).toContain('<table>');
    expect(html).toContain('Name');
    expect(html).toContain('Alexandre');
  });

  it('renders nested sections at increasing heading levels', async () => {
    const nested = section([paragraph('p-2', 'Nested section text.')], { title: 'A Section', level: 2 });
    const paginated = paginate([chapter([paragraph('p-1', 'Top text.')], { title: 'Chapter One', sections: [nested] })]);

    const buffer = await renderer.render(paginated, {});
    const html = await extractChapterHtml(buffer);

    expect(html).toContain('<h1>Chapter One</h1>');
    expect(html).toContain('<h2>A Section</h2>');
    expect(html).toContain('Nested section text.');
  });

  // Regression test: ASTBuilder can produce a top-level Section ("preamble") instead of a
  // Chapter when the source document has no Heading-1-level break at all. An earlier version of
  // EPUBRenderer filtered mainContent for Chapter only, which silently produced a structurally
  // valid but completely empty EPUB for exactly this shape - caught only by exporting a real
  // DOCX through the running dev server, not by any fixture that always included a Chapter
  // (ADR-0020 addendum). This fixture reproduces that shape directly.
  it('renders a top-level Section (no Chapter at all) without producing an empty book', async () => {
    const preamble = section([paragraph('p-1', 'Preamble text with no chapter wrapper.')], { title: '' });
    const paginated = paginate([preamble]);

    const buffer = await renderer.render(paginated, {});
    const html = await extractChapterHtml(buffer);

    expect(html).toContain('Preamble text with no chapter wrapper.');
  });

  it('falls back to a text placeholder for images without embedded base64 data', async () => {
    const image: Image = { type: 'image', id: 'img-1', url: 'https://example.com/a.png', caption: 'A cover' };
    const paginated = paginate([chapter([image])]);

    const buffer = await renderer.render(paginated, {});
    const html = await extractChapterHtml(buffer);

    expect(html).toContain('A cover');
    expect(html).not.toContain('<img');
  });

  it('embeds an image with base64 data as a real file, not a network reference', async () => {
    // 1x1 transparent PNG
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const image: Image = { type: 'image', id: 'img-1', url: 'https://example.com/a.png', base64 };
    const paginated = paginate([chapter([image])]);

    const buffer = await renderer.render(paginated, {});

    const zip = await JSZip.loadAsync(buffer);
    const imageFiles = Object.keys(zip.files).filter((f) => /\.png$/i.test(f));
    expect(imageFiles.length).toBe(1);

    const html = await extractChapterHtml(buffer);
    expect(html).toContain('<img');
    expect(html).not.toContain('https://example.com/a.png');
  });
});
