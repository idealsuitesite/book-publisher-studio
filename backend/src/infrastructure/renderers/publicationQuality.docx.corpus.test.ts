/**
 * verify-publication-quality — DOCX §4, against real fixtures.
 *
 * PUBLICATION_QUALITY_BAR.md §4 defines TEN DOCX acceptance criteria (9 numbered rows + the
 * colours criterion). ALL TEN are covered, each with a verdict (CTO 2026-07-21: no subset, all ten
 * count). This suite is the seed of the eventual `verify-publication-quality` harness (§9); a test
 * file honours §3 ("every criterion must correspond to an assertion in a test file").
 *
 * Every runnable criterion asserts a MEASURED equality that fails for the right reason. Fixture
 * choice per criterion (CTO decision 2, per-criterion fixtures) — the import corpus for structure,
 * the real verify-real-export fixtures where the corpus doesn't exercise a feature; NO fixture is
 * fabricated to fake coverage. The disclosed gaps (footnotes/hyperlinks) have no fixture anywhere in
 * the repo (measured) and are stated, not filled.
 */
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
import { DOCXRenderer } from './DOCXRenderer';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { getTheme } from '../../domain/themes/getTheme';
import { createBook, type Book, type Content, type Table } from '../../domain/models/Book';
import type { Theme } from '../../domain/models/Theme';

const VERIFICATION = join(__dirname, '..', '..', '..', 'verification');
const corpus = (f: string): string => join(VERIFICATION, 'corpus', f);
const fixture = (f: string): string => join(VERIFICATION, f);

interface Counts {
  chapters: number; sections: number; paragraphs: number; listItems: number;
  tables: number; tableCells: number; images: number;
  bold: number; italic: number; strike: number; underline: number;
}
function emptyCounts(): Counts {
  return { chapters: 0, sections: 0, paragraphs: 0, listItems: 0, tables: 0, tableCells: 0, images: 0, bold: 0, italic: 0, strike: 0, underline: 0 };
}
function countAst(contents: Content[], acc: Counts): void {
  for (const c of contents) {
    if (c.type === 'chapter') acc.chapters++;
    if (c.type === 'section') acc.sections++;
    for (const b of c.content) {
      if (b.type === 'paragraph') acc.paragraphs++;
      else if (b.type === 'list') acc.listItems += b.items.length;
      else if (b.type === 'table') { acc.tables++; acc.tableCells += b.headers.length + b.rows.reduce((n, r) => n + r.length, 0); }
      else if (b.type === 'image') acc.images++;
      if (b.type === 'paragraph' || b.type === 'heading') {
        for (const inl of b.inlines ?? []) {
          if (inl.type === 'bold') acc.bold++;
          else if (inl.type === 'italic') acc.italic++;
          else if (inl.type === 'strikethrough') acc.strike++;
          else if (inl.type === 'underline') acc.underline++;
        }
      }
    }
    if (c.type === 'chapter' && c.sections) countAst(c.sections, acc);
    if (c.type === 'section' && c.subsections) countAst(c.subsections, acc);
  }
}
function firstTable(contents: Content[]): Table | undefined {
  for (const c of contents) {
    for (const b of c.content) if (b.type === 'table') return b;
    const nested = c.type === 'chapter' ? c.sections : c.type === 'section' ? c.subsections : undefined;
    if (nested) { const t = firstTable(nested); if (t) return t; }
  }
  return undefined;
}

async function importBuffer(buffer: Buffer, filename: string): Promise<Book> {
  const raw = await new MammothParser().parse(buffer);
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: filename });
  const built = new ASTBuilder().build(normalized);
  return { ...built, frontMatter: new FrontMatterBuilder().build(built) };
}
const importFile = (path: string, name: string): Promise<Book> => importBuffer(readFileSync(path), name);

async function renderDocx(book: Book, theme: Theme) {
  const styled = new ThemeEngine().applyTheme(book, theme);
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);
  const output = (await new DOCXRenderer().render(paginated, { language: book.metadata.language })).output;
  const zip = await JSZip.loadAsync(output);
  return {
    output,
    stylesXml: await zip.file('word/styles.xml')!.async('string'),
    documentXml: await zip.file('word/document.xml')!.async('string'),
    mediaCount: Object.keys(zip.files).filter((n) => n.startsWith('word/media/')).length,
    tocEntries: paginated.tableOfContents?.length ?? 0,
  };
}

const HEADING = /w:pStyle w:val="Heading/;
const paragraphChunks = (xml: string): string[] => xml.split(/<w:p[ >]/).slice(1);
const astOf = (book: Book): Counts => { const c = emptyCounts(); countAst(book.mainContent, c); return c; };

describe('Publication quality — DOCX §4 (real fixtures)', () => {
  const classic = getTheme('classic');
  let faith: Book, art: Book, typo: Book, tables: Book, images: Book;

  beforeAll(async () => {
    faith = await importFile(corpus('faith-alone-styled.docx'), 'faith-alone-styled.docx');
    art = await importFile(corpus('art-of-captivating-list-dense.docx'), 'art.docx');
    typo = await importFile(fixture('typography-test.docx'), 'typography-test.docx');
    tables = await importFile(fixture('tables.docx'), 'tables.docx');
    images = await importFile(fixture('images.docx'), 'images.docx');
  }, 45_000);

  it('§4.1 — Word heading styles match the AST chapter/section hierarchy', async () => {
    const ast = astOf(faith);
    const { documentXml, tocEntries } = await renderDocx(faith, classic);
    const headingParas = (documentXml.match(/w:pStyle w:val="Heading\d"/g) ?? []).length;
    expect(headingParas).toBe(ast.chapters + ast.sections + (tocEntries > 0 ? 1 : 0));
    expect(ast.chapters).toBe(17); // guards the fixture
  });

  it('§4.2 real half — bold/italic/strike survive a genuine import→export→re-import round trip', async () => {
    const before = astOf(typo);
    expect([before.bold, before.italic, before.strike]).toEqual([2, 1, 1]);
    expect(before.underline).toBe(0); // mammoth drops <u> at import — ADR-0025, disclosed
    const { output } = await renderDocx(typo, classic);
    const after = astOf(await importBuffer(output, 'roundtrip.docx'));
    expect(after.bold).toBeGreaterThanOrEqual(before.bold);
    expect(after.italic).toBeGreaterThanOrEqual(before.italic);
    expect(after.strike).toBeGreaterThanOrEqual(before.strike);
  });

  it('§4.2 synthetic half — the renderer emits <w:u/> when handed an underline run directly', async () => {
    // SYNTHETIC, and named so: underline cannot arrive from a real import (ADR-0025), so this
    // verifies export EMISSION only, NOT import→export fidelity. Not a fidelity test.
    const underlineBook = createBook({ title: 'U', author: 'A', language: 'en' }, [
      { type: 'chapter', id: 'c1', number: 1, title: 'C', createdAt: new Date(), updatedAt: new Date(),
        content: [{ type: 'paragraph', id: 'p1', text: 'Underlined text', inlines: [{ type: 'underline', text: 'Underlined text' }] }] },
    ]);
    const { documentXml } = await renderDocx(underlineBook, classic);
    expect(documentXml).toMatch(/<w:u\b/);
  });

  it('§4.4 — lists preserved: one numbered/bulleted paragraph per AST list item', async () => {
    const ast = astOf(art);
    const { documentXml } = await renderDocx(art, classic);
    expect((documentXml.match(/<w:numPr>/g) ?? []).length).toBe(ast.listItems);
    expect(ast.listItems).toBe(1067); // guards the fixture
  });

  it('§4.5 — tables preserved with correct cell count and cell content', async () => {
    const ast = astOf(tables);
    const { documentXml } = await renderDocx(tables, classic);
    expect((documentXml.match(/<w:tbl>/g) ?? []).length).toBe(ast.tables);
    expect((documentXml.match(/<w:tc>/g) ?? []).length).toBe(ast.tableCells);
    expect(ast.tables).toBe(2); // guards the fixture
    // Cell CONTENT (not just count): a real cell's text reaches the export. These tables keep their
    // cells in `rows` (no separate header array), so read from wherever the content actually lives.
    const t = firstTable(tables.mainContent)!;
    const cells = [...t.headers, ...t.rows.flat()].filter((c): c is string => !!c && c.trim().length > 0);
    expect(cells.length).toBeGreaterThan(0);
    const cell = cells.find((c) => /^[\w .,'-]+$/.test(c)) ?? cells[0];
    expect(documentXml).toContain(cell);
  });

  it('§4.6 — images embedded, one per AST image node', async () => {
    const ast = astOf(images);
    const { documentXml, mediaCount } = await renderDocx(images, classic);
    expect(ast.images).toBe(2); // guards the fixture
    expect(mediaCount).toBe(ast.images); // real bytes in word/media/, not a placeholder
    expect((documentXml.match(/<w:drawing>/g) ?? []).length).toBe(ast.images);
  });

  it('§4.8 — the exported DOCX declares the theme fonts, no silent substitution', async () => {
    const { stylesXml, documentXml } = await renderDocx(faith, classic);
    expect(classic.fonts.heading).toBe('Georgia');
    expect(stylesXml).toContain(classic.fonts.heading);
    expect(documentXml).toContain(classic.fonts.body);
  });

  it('§4.9 — no paragraph fragmentation: one AST paragraph exports as exactly one paragraph', async () => {
    const ast = astOf(faith);
    const { documentXml } = await renderDocx(faith, classic);
    const chunks = paragraphChunks(documentXml);
    const firstHeading = chunks.findIndex((c) => HEADING.test(c));
    const bodyParas = chunks.slice(firstHeading).filter((c) => !HEADING.test(c)).length;
    expect(bodyParas).toBe(ast.paragraphs);
    expect(ast.paragraphs).toBe(681); // guards the fixture
  });

  describe('§4 colours', () => {
    it('mechanism — a declared theme colour resolves in styles.xml (non-black theme)', async () => {
      // Classic is all-black (accent === text === #000000), so it cannot distinguish a black
      // FALLBACK from the theme's real black. This half reuses accentColors.triformat.test.ts's
      // synthetic #1D4E68 (not a third theme) to prove the mechanism theme -> styles.xml, with a
      // negative control so it cannot pass vacuously.
      const nonBlack: Theme = { ...classic, name: 'accent-proof', colors: { ...classic.colors, accent: '#1D4E68' } };
      const { stylesXml } = await renderDocx(faith, nonBlack);
      expect(stylesXml).toContain('1D4E68');
      const { stylesXml: classicStyles } = await renderDocx(faith, classic);
      expect(classicStyles).not.toContain('1D4E68');
    });

    it('Classic — internal consistency: accent stays equal to text, whatever the value (CTO decision 6)', () => {
      // The honest Classic check: not an absolute value (which a fallback would satisfy) but the
      // INVARIANT that Classic's accent and text are the same colour. This fails for the right
      // reason if someone breaks the equality — whether both #000000 or both something else.
      expect(classic.colors.accent).toBe(classic.colors.text);
    });
  });
});

/*
 * The remaining §4 criteria and their verdicts (CTO decisions 2026-07-21; VERIFY_PUBLICATION_QUALITY.md):
 *  §4.3 footnotes  — DISCLOSED GAP. Rendered inline as [N] (live choice on main), inline-[N] proxy
 *                    accepted; but zero footnoteReference in ANY fixture repo-wide (measured) — no
 *                    fixture fabricated. Recorded in TODO.md KNOWN ISSUES as a known fidelity gap.
 *  §4.7 hyperlinks — DISCLOSED OUT OF SCOPE (internal anchors unimplemented) + DISCLOSED GAP (zero
 *                    hyperlink in any fixture repo-wide, measured; none fabricated). Only external
 *                    ExternalHyperlink is emitted. Recorded in TODO.md KNOWN ISSUES.
 */
