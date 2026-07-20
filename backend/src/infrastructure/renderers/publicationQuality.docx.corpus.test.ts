/**
 * verify-publication-quality — DOCX §4, against the real import corpus.
 *
 * PUBLICATION_QUALITY_BAR.md §4 defines TEN DOCX acceptance criteria (9 numbered rows + the
 * colours criterion). This suite is the seed of the eventual `verify-publication-quality` harness
 * (§9); starting it as a test file honours §3 ("every criterion must correspond to an assertion in
 * a test file, not a sentence in a README") and keeps it deterministic and CI-safe.
 *
 * The five criteria implemented here are those verifiable AS WRITTEN, HONESTLY, against the real
 * corpus today. Each assertion is grounded in a measured equality that fails for the right reason.
 * The other five, and WHY each is not asserted here, are documented in
 * docs/architecture/diagrams/VERIFY_PUBLICATION_QUALITY.md and summarised at the foot of this file.
 *
 * The pipeline is composed exactly as presentation/app.ts composes it, so these assertions describe
 * the real exported document, not a synthetic stand-in — except the colours check, which overrides
 * ONLY the theme colour (not the manuscript) because the sole shipped theme is all-black.
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
import type { Book, Content } from '../../domain/models/Book';
import type { Theme } from '../../domain/models/Theme';

const CORPUS = (f: string): string =>
  join(__dirname, '..', '..', '..', 'verification', 'corpus', f);

interface AstCounts {
  chapters: number;
  sections: number;
  paragraphs: number;
  listItems: number;
}

function countAst(contents: Content[], acc: AstCounts): void {
  for (const c of contents) {
    if (c.type === 'chapter') acc.chapters++;
    if (c.type === 'section') acc.sections++;
    for (const b of c.content) {
      if (b.type === 'paragraph') acc.paragraphs++;
      else if (b.type === 'list') acc.listItems += b.items.length;
    }
    if (c.type === 'chapter' && c.sections) countAst(c.sections, acc);
    if (c.type === 'section' && c.subsections) countAst(c.subsections, acc);
  }
}

/** Import a real corpus manuscript to the same Book the export use case builds (with front matter). */
async function importBook(file: string): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(CORPUS(file)));
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: file });
  const built = new ASTBuilder().build(normalized);
  return { ...built, frontMatter: new FrontMatterBuilder().build(built) };
}

/** Render a Book to DOCX through the real pipeline and expose the parts §4 inspects. */
async function renderDocx(book: Book, theme: Theme) {
  const styled = new ThemeEngine().applyTheme(book, theme);
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);
  const output = (await new DOCXRenderer().render(paginated, { language: book.metadata.language })).output;
  const zip = await JSZip.loadAsync(output);
  return {
    stylesXml: await zip.file('word/styles.xml')!.async('string'),
    documentXml: await zip.file('word/document.xml')!.async('string'),
    tocEntries: paginated.tableOfContents?.length ?? 0,
  };
}

/** Paragraph opens only — `<w:p ` / `<w:p>`, never `<w:pPr>` or `<w:pStyle>`. */
const HEADING = /w:pStyle w:val="Heading/;
function paragraphChunks(documentXml: string): string[] {
  return documentXml.split(/<w:p[ >]/).slice(1);
}

describe('Publication quality — DOCX §4 (real corpus)', () => {
  const classic = getTheme('classic');
  let faithBook: Book;
  let artBook: Book;

  beforeAll(async () => {
    faithBook = await importBook('faith-alone-styled.docx');
    artBook = await importBook('art-of-captivating-list-dense.docx');
  }, 30_000);

  it('§4.1 — Word heading styles match the AST chapter/section hierarchy', async () => {
    const ast: AstCounts = { chapters: 0, sections: 0, paragraphs: 0, listItems: 0 };
    countAst(faithBook.mainContent, ast);
    const { documentXml, tocEntries } = await renderDocx(faithBook, classic);

    const headingParas = (documentXml.match(/w:pStyle w:val="Heading\d"/g) ?? []).length;
    // Every chapter -> one Heading1, every section -> one HeadingN, plus the TOC's own title
    // (a Heading1) when a TOC is generated. Real faith-alone: 17 chapters + 79 sections.
    const tocTitle = tocEntries > 0 ? 1 : 0;
    expect(headingParas).toBe(ast.chapters + ast.sections + tocTitle);
    expect(ast.chapters).toBe(17); // guards the fixture itself against silent drift
  });

  it('§4.4 — lists are preserved: one numbered/bulleted paragraph per AST list item', async () => {
    const ast: AstCounts = { chapters: 0, sections: 0, paragraphs: 0, listItems: 0 };
    countAst(artBook.mainContent, ast);
    const { documentXml } = await renderDocx(artBook, classic);

    // docx emits one <w:numPr> per bulleted list-item paragraph. Real art-of-captivating: 1067 items.
    const listItemParas = (documentXml.match(/<w:numPr>/g) ?? []).length;
    expect(listItemParas).toBe(ast.listItems);
    expect(ast.listItems).toBe(1067); // guards the fixture
  });

  it('§4.8 — the exported DOCX declares the theme fonts, no silent substitution', async () => {
    const { stylesXml, documentXml } = await renderDocx(faithBook, classic);
    // Classic: heading and body are both Georgia — distinguishable from any default face (unlike
    // the colour, which is #000000). A silent fallback would leave Georgia absent.
    expect(classic.fonts.heading).toBe('Georgia');
    expect(stylesXml).toContain(classic.fonts.heading); // heading style definitions
    expect(documentXml).toContain(classic.fonts.body); // body runs, on a real 17-chapter manuscript
  });

  it('§4.9 — no paragraph fragmentation: one AST paragraph exports as exactly one paragraph', async () => {
    const ast: AstCounts = { chapters: 0, sections: 0, paragraphs: 0, listItems: 0 };
    countAst(faithBook.mainContent, ast);
    const { documentXml } = await renderDocx(faithBook, classic);

    // Body paragraphs = non-heading paragraphs that come AFTER the first heading (front-matter
    // paragraphs precede it and are excluded naturally). If the renderer split any paragraph, this
    // count would exceed the AST count — DOCX never splits (startsWithContinuation is skipped).
    const chunks = paragraphChunks(documentXml);
    const firstHeading = chunks.findIndex((c) => HEADING.test(c));
    const bodyParas = chunks.slice(firstHeading).filter((c) => !HEADING.test(c)).length;
    expect(bodyParas).toBe(ast.paragraphs);
    expect(ast.paragraphs).toBe(681); // guards the fixture
  });

  it('§4 colours — a declared theme colour resolves in styles.xml (tested under a non-black theme)', async () => {
    // Classic is all-black (accent === text === #000000), so a black FALLBACK is indistinguishable
    // from the theme's real black. Only the theme colour is overridden here — the manuscript is the
    // real corpus — so the check can fail for the right reason: a fallback would omit this colour.
    const nonBlack: Theme = { ...classic, colors: { ...classic.colors, accent: '#1D4E68' } };
    const { stylesXml } = await renderDocx(faithBook, nonBlack);
    expect(stylesXml).toContain('1D4E68');
    // Proof this is not vacuous: Classic's own export would NOT contain this colour.
    const { stylesXml: classicStyles } = await renderDocx(faithBook, classic);
    expect(classicStyles).not.toContain('1D4E68');
  });
});

/*
 * NOT asserted here — the other five §4 criteria, and why (measured, not assumed; see
 * VERIFY_PUBLICATION_QUALITY.md for the full matrix and the CTO decisions of 2026-07-21):
 *
 *  §4.2 underline  — mammoth drops <u> on import (ADR-0025), so it cannot round-trip. The real half
 *                    (bold/italic/strike) and a synthetic export-side <w:u/> assertion belong in a
 *                    separate emission test, clearly labelled synthetic — NOT a real fidelity test.
 *  §4.3 footnotes  — DOCX renders footnotes inline as [N] paragraphs (a live rendering choice on
 *                    main, not B's to fix). Proxy accepted (a [N] matches a present definition), but
 *                    DISCLOSED GAP: zero footnoteReference in any fixture repo-wide (measured). No
 *                    fixture is fabricated to fake coverage.
 *  §4.5 tables     — renderer emits them correctly; the import corpus has none. Runs against the
 *                    real verify-real-export fixture tables.docx (2 tables), pending in this harness.
 *  §4.6 images     — as tables; runs against images.docx (2 images), pending.
 *  §4.7 hyperlinks — external links only are emitted; internal anchors are unimplemented and
 *                    DISCLOSED OUT OF SCOPE. DISCLOSED GAP: zero hyperlink in any fixture repo-wide
 *                    (measured). No fixture is fabricated.
 */
