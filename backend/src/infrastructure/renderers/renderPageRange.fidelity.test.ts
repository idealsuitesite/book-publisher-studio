import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { getTheme } from '../../domain/themes/getTheme';
import { KDP6x9PageLayout } from '../../domain/layouts/KDP6x9PageLayout';
import { PDFRenderer } from './PDFRenderer';
import { extractPdfRunsByPage, extractPdfPageSignatures, countPdfPages } from '../../test-utils/extractPdfText';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { Content } from '../../domain/models/Book';

/**
 * INCREMENTAL_RENDER (P1) — the FIDELITY INVARIANT (INCREMENTAL_RENDER_DR §1, §3): a page rendered in a
 * REGION is identical to the same page of the full export — text and page numbering. The chantier's
 * fidelity is free by construction (renderPageRange draws from the full pagination's own Page objects
 * through the same walk), and this test proves it, plus GUARDRAIL 1 (the region draws EXACTLY the range
 * and nothing outside it). This commit's scope: mid-content clean pages (no chapter opening, no
 * continuation); the drop-cap opening and the continuation split-tail are the following commits.
 */
const FIXTURE = join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');

async function paginateFaithAlone(): Promise<PaginatedBook> {
  const raw = await new MammothParser().parse(readFileSync(FIXTURE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'faith.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
}

/** The first structurally CLEAN mid-content page (1-based number): not a chapter opening, not a
 *  continuation, and its own last block not split — exactly this commit's in-scope case. */
function firstCleanMidContentPage(paginated: PaginatedBook): number {
  const chapterStartIds = new Set<string>();
  const collect = (cs: Content[]) => cs.forEach((c) => {
    if (c.content[0]) chapterStartIds.add(c.content[0].id);
    if (c.type === 'chapter' && c.sections) collect(c.sections);
    if (c.type === 'section' && c.subsections) collect(c.subsections);
  });
  collect(paginated.styledBook.book.mainContent as Content[]);

  for (let i = 8; i < paginated.pages.length - 3; i++) {
    const p = paginated.pages[i];
    const isChapterOpening = (p.blankPagesBefore ?? 0) > 0 || (p.blocks[0] !== undefined && chapterStartIds.has(p.blocks[0]));
    if (!p.startsWithContinuation && !p.splitAfterLines && !isChapterOpening && p.blocks.length > 0) {
      return p.number;
    }
  }
  throw new Error('no clean mid-content page found in faith-alone');
}

/** The PHYSICAL index of the full export's page for DOMAIN page number `n`, located by its footer —
 *  robust to the front-matter physical offset and to reconciliation drift (the footer is ground
 *  truth; its digits are Helvetica chrome and decode cleanly in any subset). */
function exportPhysicalIndex(full: Buffer, n: number, total: number): number {
  const pages = extractPdfRunsByPage(full).map((p) => p.map((r) => r.text).join(''));
  const idx = pages.findIndex((text) => text.includes(`Page ${n} of ${total}`));
  if (idx < 0) throw new Error(`no full-export page footed "Page ${n} of ${total}"`);
  return idx;
}

describe('renderPageRange — fidelity invariant: region page ≡ export page (mid-content, clean)', () => {
  it('a single mid-content page renders byte-for-text identical to that page of the full export', async () => {
    const paginated = await paginateFaithAlone();
    const renderer = new PDFRenderer({ compress: false });

    const full = (await renderer.render(paginated, { language: 'en' })).output;
    const total = countPdfPages(full);
    const n = firstCleanMidContentPage(paginated);

    const region = (await renderer.renderPageRange(paginated, { language: 'en' }, n, n, total)).output;

    // GUARDRAIL 1a: the region is EXACTLY the range width (one page), nothing leaked.
    expect(countPdfPages(region)).toBe(1);

    // The invariant (subset-invariant geometry+structure signature — text is not comparable across two
    // renders' font subsets): the region's only page ≡ page n of the full export.
    const exportSig = extractPdfPageSignatures(full);
    const regionSig = extractPdfPageSignatures(region);
    const idx = exportPhysicalIndex(full, n, total);
    expect(regionSig).toHaveLength(1);
    expect(regionSig[0]).toBe(exportSig[idx]);

    // Numbering: the region's footer reads the true "Page n of TOTAL" (the digits decode cleanly).
    expect(extractPdfRunsByPage(region)[0].map((r) => r.text).join('')).toContain(`Page ${n} of ${total}`);

    // GUARDRAIL 1b: the region's signature is NOT the signature of a neighbouring page (no wrong-page).
    expect(regionSig[0]).not.toBe(exportSig[idx - 1]);
    expect(regionSig[0]).not.toBe(exportSig[idx + 1]);
  });

  it('a 2-page mid-content window renders exactly those two pages, both identical to the export', async () => {
    const paginated = await paginateFaithAlone();
    const renderer = new PDFRenderer({ compress: false });
    const full = (await renderer.render(paginated, { language: 'en' })).output;
    const total = countPdfPages(full);
    const n = firstCleanMidContentPage(paginated);
    // Scope guard: page n+1 must be clean too — not a continuation INTO it, and its OWN last block not
    // split (a trailing split would spill a 3rd page — the trailing-boundary case is out of scope, YAGNI).
    const next = paginated.pages[n]; // 0-based index n == domain page number n+1
    if (!next || next.startsWithContinuation || next.splitAfterLines) return; // the single-page test carries the core

    const region = (await renderer.renderPageRange(paginated, { language: 'en' }, n, n + 1, total)).output;
    expect(countPdfPages(region)).toBe(2);
    const exportSig = extractPdfPageSignatures(full);
    const regionSig = extractPdfPageSignatures(region);
    expect(regionSig).toHaveLength(2);
    expect(regionSig[0]).toBe(exportSig[exportPhysicalIndex(full, n, total)]);
    expect(regionSig[1]).toBe(exportSig[exportPhysicalIndex(full, n + 1, total)]);
  });
});
