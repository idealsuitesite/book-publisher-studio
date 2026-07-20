import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { getTheme } from '../../domain/themes/getTheme';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { DOCXRenderer } from './DOCXRenderer';
import { EPUBRenderer } from './EPUBRenderer';
import type { Book } from '../../domain/models/Book';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';

const FIXTURE = join(__dirname, '..', '..', '..', 'verification', 'tables.docx');

// The harness assertion the CTO required to CLOSE the class, not just the observed symptom
// (TABLE_DUPLICATION.md §3, ADR-0050): each table cell's text must appear EXACTLY ONCE in the
// output. Before the fix, a descendant selector emitted every cell twice — once in the table,
// once as a stray body paragraph. Text-bearing formats (DOCX XML, EPUB HTML) are asserted
// directly; the AST invariant covers PDF, whose subset-encoded glyphs are not greppable.
describe('table content appears exactly once (TABLE_DUPLICATION.md, ADR-0050)', () => {
  // tables.docx cells: Name/Role/Alexandre/Author/Marie/Editor, then A..D / 1..8. Tokens
  // chosen to be unambiguous (a bare "1" could match anything; the header names cannot).
  const CELL_TOKENS = ['Alexandre', 'Author', 'Marie', 'Editor'];
  let book: Book;
  let paginated: PaginatedBook;

  beforeAll(async () => {
    const raw = await new MammothParser().parse(readFileSync(FIXTURE));
    const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'tables.docx' });
    const built = new ASTBuilder().build(normalized);
    book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
    const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
    const typeset = new TypographyResolver().resolve(styled);
    paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);
  }, 60_000);

  it('the AST body carries each cell once and no stray cell paragraphs (covers PDF too)', () => {
    const blocks: string[] = [];
    const walk = (contents: Book['mainContent']): void => {
      for (const c of contents) {
        for (const b of c.content) blocks.push(b.type);
        if (c.type === 'chapter' && c.sections) walk(c.sections as unknown as Book['mainContent']);
        else if (c.type === 'section' && c.subsections) walk(c.subsections as unknown as Book['mainContent']);
      }
    };
    walk(book.mainContent);
    // The document is: "A small table:" + table + "A wider table:" + table.
    expect(blocks.filter((t) => t === 'table')).toHaveLength(2);
    expect(blocks.filter((t) => t === 'paragraph')).toHaveLength(2);
  });

  it('DOCX contains each cell token exactly once', async () => {
    const result = await new DOCXRenderer().render(paginated, { language: 'en' });
    const zip = await JSZip.loadAsync(result.output);
    const documentXml = await zip.file('word/document.xml')!.async('string');
    for (const token of CELL_TOKENS) {
      const count = documentXml.split(token).length - 1;
      expect(count, `"${token}" appears ${count}× in DOCX, expected 1`).toBe(1);
    }
  });

  it('EPUB contains each cell token exactly once', async () => {
    const result = await new EPUBRenderer().render(paginated, { language: 'en' });
    const zip = await JSZip.loadAsync(result.output);
    const html = (
      await Promise.all(
        Object.keys(zip.files)
          .filter((n) => n.endsWith('.xhtml') || n.endsWith('.html'))
          .map((n) => zip.file(n)!.async('string'))
      )
    ).join('');
    for (const token of CELL_TOKENS) {
      const count = html.split(token).length - 1;
      expect(count, `"${token}" appears ${count}× in EPUB, expected 1`).toBe(1);
    }
  });
});
