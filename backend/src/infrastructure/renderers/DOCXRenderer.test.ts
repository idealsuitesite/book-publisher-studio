import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { DOCXRenderer } from './DOCXRenderer';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { createBook } from '../../domain/models/Book';
import type { Chapter, Heading, Paragraph, Table, Image, List, InlineElement, TableOfContents } from '../../domain/models/Book';
import type { PageLayout } from '../../domain/models/PageLayout';
import type { Theme } from '../../domain/models/Theme';

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

async function extractDocumentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('word/document.xml missing from generated docx');
  return doc.async('string');
}

function paginate(chapters: Chapter[], layout: PageLayout = LETTER_LAYOUT, theme: Theme = ClassicTheme) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  const styled = new ThemeEngine().applyTheme(book, theme);
  return new LayoutEngine().paginate(styled, layout);
}

function paginateWithToc(chapters: Chapter[], toc: TableOfContents) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  const styled = new ThemeEngine().applyTheme({ ...book, frontMatter: { toc } }, ClassicTheme);
  return new LayoutEngine().paginate(styled, LETTER_LAYOUT);
}

// Chains TypographyResolver after ThemeEngine, so blockTypography (inline runs, drop
// caps) is actually populated - paginate() above deliberately does not do this, so the
// existing pre-commit-7 test cases keep exercising the plain-text fallback path.
function paginateWithTypography(chapters: Chapter[]) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine().paginate(typeset, LETTER_LAYOUT);
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

  // Sprint 6: DOCXRenderer previously emitted no <w:pgSz>/<w:pgMar> at all, so every export
  // silently used docx's own library default (Letter-equivalent) regardless of the selected
  // PageLayout - a real gap found while wiring PageLayout selection through to actual
  // rendered output (see PaginatedBook.pageLayout's doc comment). Values are in twips
  // (1pt = 20 twips): A4's 595.28x841.89pt -> 11905.6x16837.8 twips, truncated by docx's
  // own integer rounding.
  it('renders the DOCX at the selected PageLayout size, not a hardcoded Letter default', async () => {
    const a4Layout: PageLayout = { ...LETTER_LAYOUT, pageSize: 'a4', width: 595.28, height: 841.89 };
    const paginated = paginate([chapter([paragraph('p-1', 'Hello world.')])], a4Layout);

    const buffer = await renderer.render(paginated, {});
    const xml = await extractDocumentXml(buffer);

    expect(xml).toMatch(/<w:pgSz[^>]*w:w="11905"[^>]*w:h="16837"/);
  });

  // Sprint 6 (ADR-0029, Functional Spec item 5): Chapter.openingPageStyle blank-page insertion.
  describe('Chapter.openingPageStyle blank-page insertion', () => {
    it("inserts an extra blank page (an empty paragraph forcing its own page break) for 'right'", async () => {
      const paginated = paginate([
        chapter([paragraph('p-1', 'Hello one.')], { id: 'c-1', number: 1 }),
        chapter([paragraph('p-2', 'Hello two.')], { id: 'c-2', number: 2, openingPageStyle: 'right' }),
      ]);

      const buffer = await renderer.render(paginated, {});
      const xml = await extractDocumentXml(buffer);

      const pageBreakCount = (xml.match(/<w:pageBreakBefore\/>/g) ?? []).length;
      // 1 for chapter 2's title paragraph (chapters always start a new page) + 1 for the
      // inserted blank page = 2. Without openingPageStyle this would be 1.
      expect(pageBreakCount).toBe(2);
      expect(xml).toContain('Hello one.');
      expect(xml).toContain('Hello two.');
    });

    it('does not insert an extra blank page for a first chapter (nothing to break from)', async () => {
      const paginated = paginate([chapter([paragraph('p-1', 'Hello one.')], { id: 'c-1', number: 1, openingPageStyle: 'right' })]);

      const buffer = await renderer.render(paginated, {});
      const xml = await extractDocumentXml(buffer);

      expect((xml.match(/<w:pageBreakBefore\/>/g) ?? []).length).toBe(0);
    });
  });

  // Sprint 6 (ADR-0029, Functional Spec item 9): DOCXRenderer gains header/footer support -
  // a genuinely new capability, none existed before this.
  describe('header/footer (Theme.runningHead)', () => {
    it("writes a real header part with the book's title and a footer part with a live PAGE/NUMPAGES field", async () => {
      const paginated = paginate([chapter([paragraph('p-1', 'Hello world.')])]);

      const buffer = await renderer.render(paginated, {});
      const zip = await JSZip.loadAsync(buffer);
      const headerFile = Object.keys(zip.files).find((f) => /word\/header\d+\.xml/.test(f));
      const footerFile = Object.keys(zip.files).find((f) => /word\/footer\d+\.xml/.test(f));

      expect(headerFile).toBeDefined();
      expect(footerFile).toBeDefined();

      const headerXml = await zip.file(headerFile!)!.async('string');
      const footerXml = await zip.file(footerFile!)!.async('string');

      expect(headerXml).toContain('T'); // paginate()'s book title
      expect(footerXml).toContain('PAGE');
      expect(footerXml).toContain('NUMPAGES');
    });

    it('writes no header/footer parts when runningHead.show is false', async () => {
      const theme: Theme = { ...ClassicTheme, runningHead: { ...ClassicTheme.runningHead!, show: false } };
      const paginated = paginate([chapter([paragraph('p-1', 'Hello world.')])], LETTER_LAYOUT, theme);

      const buffer = await renderer.render(paginated, {});
      const zip = await JSZip.loadAsync(buffer);
      const headerFile = Object.keys(zip.files).find((f) => /word\/header\d+\.xml/.test(f));
      const footerFile = Object.keys(zip.files).find((f) => /word\/footer\d+\.xml/.test(f));

      expect(headerFile).toBeUndefined();
      expect(footerFile).toBeUndefined();
    });

    it('writes no header/footer parts when the theme has no runningHead at all', async () => {
      const theme: Theme = { ...ClassicTheme, runningHead: undefined };
      const paginated = paginate([chapter([paragraph('p-1', 'Hello world.')])], LETTER_LAYOUT, theme);

      const buffer = await renderer.render(paginated, {});
      const zip = await JSZip.loadAsync(buffer);
      const headerFile = Object.keys(zip.files).find((f) => /word\/header\d+\.xml/.test(f));

      expect(headerFile).toBeUndefined();
    });
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

  it('renders bold, italic, underline, strikethrough, superscript, and subscript inline runs', async () => {
    const inlines: InlineElement[] = [
      { type: 'text', text: 'Plain ' },
      { type: 'bold', text: 'bold ' },
      { type: 'italic', text: 'italic ' },
      { type: 'underline', text: 'under ' },
      { type: 'strikethrough', text: 'strike ' },
      { type: 'superscript', text: 'sup ' },
      { type: 'subscript', text: 'sub' },
    ];
    const para: Paragraph = { type: 'paragraph', id: 'p-1', text: 'ignored when inlines present', inlines };
    const paginated = paginateWithTypography([chapter([para])]);

    const buffer = await renderer.render(paginated, {});
    const xml = await extractDocumentXml(buffer);

    // Functional check: text is present regardless of which runs carried it.
    expect(xml).toContain('Plain ');
    expect(xml).toContain('bold ');
    expect(xml).toContain('italic ');
    expect(xml).toContain('under ');
    expect(xml).toContain('strike ');
    expect(xml).toContain('sup ');
    expect(xml).toContain('sub');

    // Functional check: the spec-level OOXML markers for each style are present -
    // these are the actual Word-compatible representation of "this run is bold/
    // italic/etc", not an internal implementation detail (unlike a specific PDFKit
    // font-subset tag).
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('<w:u w:val="single"/>');
    expect(xml).toContain('<w:strike/>');
    expect(xml).toContain('<w:vertAlign w:val="superscript"/>');
    expect(xml).toContain('<w:vertAlign w:val="subscript"/>');
  });

  it('sizes headings from theme.fontSizes.h1, not a hardcoded value', async () => {
    const paginated = paginateWithTypography([chapter([{ type: 'heading', id: 'h-1', level: 1, text: 'Big Title' }])]);

    const buffer = await renderer.render(paginated, {});
    const zip = await JSZip.loadAsync(buffer);
    const stylesXml = await zip.file('word/styles.xml')!.async('string');

    // ClassicTheme.fontSizes.h1 = 28pt = 56 half-points (docx sizes are in half-points).
    // Checking the declared style's size value, not any renderer-internal detail.
    const expectedHalfPoints = Math.round(ClassicTheme.fontSizes.h1 * 2);
    expect(stylesXml).toContain(`w:styleId="Heading1"`);
    const heading1Section = stylesXml.slice(stylesXml.indexOf('w:styleId="Heading1"'), stylesXml.indexOf('w:styleId="Heading1"') + 400);
    expect(heading1Section).toContain(`w:sz w:val="${expectedHalfPoints}"`);
  });

  it("renders per-item inline runs within a list, preserving each item's style", async () => {
    const inlinesPerItem: InlineElement[][] = [[{ type: 'text', text: 'First' }], [{ type: 'bold', text: 'Second' }]];
    const list: List = { type: 'list', id: 'l-1', ordered: false, items: ['ignored', 'ignored'], inlines: inlinesPerItem };
    const paginated = paginateWithTypography([chapter([list])]);

    const buffer = await renderer.render(paginated, {});
    const xml = await extractDocumentXml(buffer);

    expect(xml).toContain('First');
    expect(xml).toContain('Second');
    expect(xml).toContain('<w:b/>');
  });

  it("applies a drop cap by enlarging the paragraph's first character, without losing or duplicating text", async () => {
    const para: Paragraph = { type: 'paragraph', id: 'p-1', text: 'Once upon a time.', dropCap: true };
    const paginated = paginateWithTypography([chapter([para])]);

    const buffer = await renderer.render(paginated, {});
    const xml = await extractDocumentXml(buffer);

    // Functional check: the full text is present exactly once, split across a
    // larger first-character run and the remainder - not duplicated, not dropped.
    expect(xml).toContain('O');
    expect(xml).toContain('nce upon a time.');
    expect((xml.match(/Once upon a time\./g) ?? []).length).toBe(0); // never appears whole in one run
  });

  // Sprint 6 (Functional Spec item 7, Architecture Impact §4): DOCXRenderer consumes
  // paginated.tableOfContents.
  describe('table of contents (PaginatedBook.tableOfContents)', () => {
    it('renders a real TOC with entry titles and resolved page numbers before body content, on its own page', async () => {
      // Real-file verification finding (Sprint 6 commit 11): a real DOCX import never produces
      // a content-level Heading block - every real heading becomes a Chapter title instead
      // (see LayoutEngine.ts's buildTableOfContents doc comment). No literal heading() blocks
      // here, matching that real-world shape.
      const paginated = paginateWithToc(
        [
          chapter([paragraph('p-1', 'Hello one.')], { id: 'c-1', number: 1, title: 'Chapter One' }),
          chapter([paragraph('p-2', 'Hello two.')], { id: 'c-2', number: 2, title: 'Chapter Two' }),
        ],
        { generateAutomatically: true, entries: [] }
      );

      const buffer = await renderer.render(paginated, {});
      const xml = await extractDocumentXml(buffer);

      expect(xml).toContain('Table of Contents');
      expect(xml).toContain('Chapter One');
      expect(xml).toContain('Chapter Two');
      // The TOC's own heading + chapter 1's title both carry a page break: one separating
      // the TOC page from body content, one starting chapter 2 (chapter 1 is the document's
      // own first real page after the TOC, so it needs the forced break; chapter 2 gets its
      // normal chapter-start break).
      expect((xml.match(/<w:pageBreakBefore\/>/g) ?? []).length).toBe(2);
    });

    it('renders no TOC when tableOfContents is absent (generateAutomatically not set)', async () => {
      const paginated = paginate([chapter([heading(1, 'h-1', 'Chapter One'), paragraph('p-1')])]);

      const buffer = await renderer.render(paginated, {});
      const xml = await extractDocumentXml(buffer);

      expect(xml).not.toContain('Table of Contents');
    });
  });
});
