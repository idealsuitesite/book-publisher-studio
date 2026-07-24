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
import { extractPdfRunsByPage, extractPdfPageText, extractPdfPageSignatures, countPdfPages } from '../../test-utils/extractPdfText';
import type { PaginatedBook, Page } from '../../domain/models/PaginatedBook';
import type { Content, Block } from '../../domain/models/Book';

/**
 * INCREMENTAL_RENDER (P1) — the FIDELITY INVARIANT (INCREMENTAL_RENDER_DR §1, §3): a page rendered in a
 * REGION is identical to the same page of the full export — text and page numbering. The chantier's
 * fidelity is free by construction (renderPageRange draws from the full pagination's own Page objects
 * through the same walk), and this test proves it, plus GUARDRAIL 1 (the region draws EXACTLY the range
 * and nothing outside it). This commit's scope: mid-content clean pages (no chapter opening, no
 * continuation); the drop-cap opening and the continuation split-tail are the following commits.
 */
const FIXTURE = join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');

async function paginateFaithAlone(themeName = 'classic'): Promise<PaginatedBook> {
  const raw = await new MammothParser().parse(readFileSync(FIXTURE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'faith.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const styled = new ThemeEngine().applyTheme(book, getTheme(themeName));
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

/** Every block by id (top-level + nested) — to read the DOMAIN's own text for a page's blocks. */
function indexBlocks(paginated: PaginatedBook): Map<string, Block> {
  const map = new Map<string, Block>();
  const walk = (cs: Content[]) => cs.forEach((c) => {
    for (const b of c.content) map.set(b.id, b);
    if (c.type === 'chapter' && c.sections) walk(c.sections);
    if (c.type === 'section' && c.subsections) walk(c.subsections);
  });
  walk(paginated.styledBook.book.mainContent as Content[]);
  return map;
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
    // ATTRIBUTION (155 → 156): the P1 cadrage reported faith-alone at 155 pages — that is
    // `paginated.pages.length`, LayoutEngine's DOMAIN/body page count. `countPdfPages` here is the
    // PHYSICAL PDF count, which adds the one rendered front-matter page (FrontMatterBuilder emits a
    // title page; no copyright/TOC for this fixture) → 156. Same book, two honest measures: body pages
    // vs physical pages. The footer's "of 156" is the physical denominator, as the full export shows.
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
    const regionText = extractPdfPageText(region, 0);
    expect(regionText).toContain(`Page ${n} of ${total}`);

    // GUARDRAIL 1b: the region's signature is NOT the signature of a neighbouring page (no wrong-page).
    expect(regionSig[0]).not.toBe(exportSig[idx - 1]);
    expect(regionSig[0]).not.toBe(exportSig[idx + 1]);

    // COMPENSATING DOMAIN ANCHOR (CTO): geometry equality proves same LAYOUT; anchor CONTENT to domain
    // truth so a coincidental geometry match on different words cannot pass silently. Cross-render text
    // is dead (subsets), but a SINGLE render decodes self-consistently — so at least one distinctive
    // word the model places on page n must appear verbatim in the region's own decoded text. (A page
    // has many long words; the extractor mangles only a minority of glyphs, so ≥1 survives — and if
    // none did, that itself would be a real signal, not a false negative.)
    const blockIndex = indexBlocks(paginated);
    const domainWords = paginated.pages[n - 1].blocks
      .flatMap((id) => (blockIndex.get(id) as { text?: string } | undefined)?.text?.split(/\s+/) ?? [])
      .filter((w) => /^[A-Za-z]{6,}$/.test(w));
    expect(domainWords.length).toBeGreaterThan(0); // the page has real prose to anchor to
    expect(domainWords.some((w) => regionText.includes(w))).toBe(true);
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

/** The chapter-opening pages that light a drop cap, and the opening chapter's title, for the Novel
 *  theme (the only shipped theme that lights drop caps — Classic's scope is 'none'). A clean opening
 *  has no trailing split, no blank pages, no continuation, so its region [n, n] is exactly one page. */
function chapterOpeners(paginated: PaginatedBook): Map<string, { page: Page; title: string | undefined }> {
  const byFirstBlock = new Map<string, { page: Page; title: string | undefined }>();
  const chapterFirstIds = new Map<string, string | undefined>();
  const collect = (cs: Content[]) => cs.forEach((c) => {
    if (c.type === 'chapter' && c.content[0]) chapterFirstIds.set(c.content[0].id, c.title);
    if (c.type === 'chapter' && c.sections) collect(c.sections);
    if (c.type === 'section' && c.subsections) collect(c.subsections);
  });
  collect(paginated.styledBook.book.mainContent as Content[]);
  for (const page of paginated.pages) {
    const first = page.blocks[0];
    if (first && chapterFirstIds.has(first)) byFirstBlock.set(first, { page, title: chapterFirstIds.get(first) });
  }
  return byFirstBlock;
}

/**
 * INCREMENTAL_RENDER 1c — the FIDELITY INVARIANT for a region whose LEADING page is a chapter opening.
 * Runs on the Novel theme (the n=2 ruling, DR §5/§5bis: book 3's continuation split-tail AND a Novel
 * drop-cap opening), the only shipped theme that lights the drop cap. Proves the region draws the true
 * chrome — the title block and the drop cap — page-for-page identical to the full export, by the same
 * construction as 1b (the full pagination's own Page objects, the same renderBlock walk). Both prior
 * mid-content tests still run under Classic above, unchanged.
 */
describe('renderPageRange — fidelity invariant: region page ≡ export page (drop-cap chapter opening, Novel)', () => {
  it('a drop-cap chapter-opening page renders byte-for-text identical to that page of the full export', async () => {
    const paginated = await paginateFaithAlone('novel');
    const renderer = new PDFRenderer({ compress: false });

    const full = (await renderer.render(paginated, { language: 'en' })).output;
    const total = countPdfPages(full);

    const dropCap = paginated.styledBook.blockTypography ?? {};
    const openers = chapterOpeners(paginated);
    // A CLEAN drop-cap opening: its first block lights the drop cap, and the page has no trailing split,
    // no blank pages, and does not itself start with a continuation — so [n, n] is exactly one page (the
    // opening that ALSO splits its tail is the 1c+1d combination, out of this single-commit's scope).
    const opening = [...openers.values()].find(({ page }) => {
      const first = page.blocks[0];
      return (
        !!first &&
        !!(dropCap[first] as { dropCap?: boolean } | undefined)?.dropCap &&
        !page.splitAfterLines &&
        !(page.blankPagesBefore ?? 0) &&
        !page.startsWithContinuation
      );
    });
    if (!opening) throw new Error('no clean drop-cap chapter-opening page found in faith-alone (Novel)');
    const n = opening.page.number;

    const region = (await renderer.renderPageRange(paginated, { language: 'en' }, n, n, total)).output;

    // GUARDRAIL 1a: exactly the range width — no leaked blank/opening page pushed the opening off page 0.
    expect(countPdfPages(region)).toBe(1);

    // The invariant: the region's only page ≡ page n of the full export (title block + drop cap included,
    // since both are in the geometry signature — a suppressed title could not match).
    const exportSig = extractPdfPageSignatures(full);
    const regionSig = extractPdfPageSignatures(region);
    const idx = exportPhysicalIndex(full, n, total);
    expect(regionSig).toHaveLength(1);
    expect(regionSig[0]).toBe(exportSig[idx]);

    // Not a neighbour (no wrong-page).
    expect(regionSig[0]).not.toBe(exportSig[idx - 1]);
    expect(regionSig[0]).not.toBe(exportSig[idx + 1]);

    // CONTENT anchor to domain truth — the page NUMBER footer. It is Helvetica chrome and decodes in
    // ANY font subset (unlike prose), so it is the anchor the instrument can be trusted for here. The
    // region's footer reads the true "Page n of TOTAL", and `idx` was located in the export by that same
    // footer — so a coincidental geometry collision on a DIFFERENT page is excluded: that page would have
    // to carry both this signature AND the "Page n" footer.
    const regionText = extractPdfPageText(region, 0);
    expect(regionText).toContain(`Page ${n} of ${total}`);

    // INSTRUMENT-LIAR RECORD (why no decoded-PROSE anchor here, unlike the Classic mid-content tests):
    // the text extractor mangles the Novel theme's embedded-font subsets, and mangles the REGION and the
    // FULL EXPORT DIFFERENTLY because each embeds a different glyph subset (the region only this page's
    // glyphs). Measured on this very page: the full export decodes the body cleanly but scrambles the
    // title ("Whactep Twrl…"); the region decodes the title cleanly but scrambles the body
    // ("Justicaotin dsto hs…"). So a decoded-word match is not a trustworthy signal for Novel. The
    // guarantee that does NOT depend on decoding is the subset-INVARIANT signature asserted above (it
    // captures the drop-cap glyph's own geometry), plus the decode-reliable page-number footer. The prose
    // text-identity anchor lives on the Classic pages, where the extractor is reliable. (No extractor fix
    // is owed by this chantier; consign if a future chantier needs Novel prose extraction.)
  });
});
