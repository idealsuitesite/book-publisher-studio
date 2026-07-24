import PDFDocument from 'pdfkit';
import type { Renderer, RenderContext, RenderResult } from '../../domain/ports/Renderer';
import type { PageRangeRenderer } from '../../domain/ports/PageRangeRenderer';
import type { PaginatedBook, Page } from '../../domain/models/PaginatedBook';
import type { ResolvedBlockStyle, Theme } from '../../domain/models/Theme';
import type { ResolvedTypography, TypeRun } from '../../domain/models/ResolvedTypography';
import type {
  Content,
  Block,
  Chapter,
  Section,
  TOCEntry,
  TitlePage,
  CopyrightPage,
} from '../../domain/models/Book';
import { listItemTypographyKey } from '../../shared/utils/typographyKeys';
import { runsOrPlainFallback } from '../../shared/utils/typographyRuns';
import { PdfFontRegistry } from '../fonts/PdfFontRegistry';
import { renderedImageSize } from '../../domain/services/renderedImageSize';
import { dropCapGeometry, dropCapScaleOf, type DropCapGeometry } from '../../domain/services/dropCapMetrics';
import { CALLOUT_PAD_V_PT, CALLOUT_RULE_PT, calloutRuleColorOf, calloutTextIndentPt, calloutTintOf } from '../../domain/services/calloutMetrics';
import { CHAPTER_SUBTITLE_RATIO } from '../../domain/services/titleMetrics';
import { assertPlausibleCapHeight } from '../fonts/PdfKitTextMeasurer';

// The drop-cap scale now lives in the Domain (dropCapMetrics), because the pagination model
// must price exactly what this renderer draws. It used to be a private constant here AND an
// identical private constant in DOCXRenderer - the same declared value in two places, which
// the model could not see at all.

/** Resolves which registered font to use for a run, given its bold/italic flags. */
type FontResolver = (bold: boolean, italic: boolean) => string;

/**
 * Partitions styled runs at a character offset into the concatenated text (Phase B). The
 * boundary falls at a word end, so the tail's leading whitespace is trimmed rather than
 * rendered as a bogus indent at the top of the continuation page.
 */
function splitRunsAt(runs: TypeRun[], offset: number): [TypeRun[], TypeRun[]] {
  const head: TypeRun[] = [];
  const tail: TypeRun[] = [];
  let consumed = 0;
  for (const run of runs) {
    const end = consumed + run.text.length;
    if (end <= offset) {
      head.push(run);
    } else if (consumed >= offset) {
      tail.push(run);
    } else {
      const cut = offset - consumed;
      head.push({ ...run, text: run.text.slice(0, cut) });
      tail.push({ ...run, text: run.text.slice(cut) });
    }
    consumed = end;
  }
  if (tail.length > 0) tail[0] = { ...tail[0], text: tail[0].text.replace(/^\s+/, '') };
  return [head.filter((r) => r.text.length > 0), tail.filter((r) => r.text.length > 0)];
}

// A real-PDFKit-page-index's owner: a domain Page (render its title/header/footer normally),
// the literal string 'blank' (an intentionally blank page from Chapter.openingPageStyle - draw
// nothing at all on it, matching real print convention), or undefined (pagination-estimate
// drift, ADR-0013/ADR-0019 finding 6C - PDFKit auto-paginated internally beyond what
// LayoutEngine estimated, so there's no reliable title, but the page number still falls back to
// the physical index rather than showing nothing).
type PageOwner = Page | 'blank' | undefined;

/** Per-document tally of drop caps abandoned because the font-metric guard refused (RenderMetrics.degradedDropCaps). */
interface DegradationTally { degradedDropCaps: number }

function degradationTally(doc: PDFKit.PDFDocument): DegradationTally {
  const holder = doc as unknown as { __degradation?: DegradationTally };
  holder.__degradation ??= { degradedDropCaps: 0 };
  return holder.__degradation;
}

function countDegradedDropCap(doc: PDFKit.PDFDocument, error: unknown): void {
  const tally = degradationTally(doc);
  tally.degradedDropCaps += 1;
  const where = (doc as unknown as { __currentBlockId?: string }).__currentBlockId ?? 'unknown block';
  console.warn(
    `[PDFRenderer] drop cap #${tally.degradedDropCaps} abandoned on ${where}; rendered as ordinary ` +
      `text so the book still exports. Cause: ${error instanceof Error ? error.message : String(error)}`
  );
}

// Phase B (LAYOUT_FIDELITY.md Decision 7): which blocks are split, into which line counts, and
// which domain Pages their continuations own.
interface SplitPlan {
  segments: Map<string, number[]>;
  continuations: Map<string, Page[]>;
}

/**
 * INCREMENTAL_RENDER (P1, candidate 1): the window that turns the whole-book draw into a visible-region
 * render. Threaded through the SAME renderContent/renderBlock walk (never a second walk — INCREMENTAL_
 * RENDER_DR §D1), so per-block geometry is inherited, not imitated. `undefined` everywhere on the full
 * render path ⇒ byte-identical to before (the parity locks guard this). While `!active`, drawing and
 * planned breaks are suppressed; the walk reaches `startId`, draws through `endId`, then stops. The
 * chrome (numbers, running heads) is fed the range's own domain Pages in `pageOwners`, so it is true by
 * construction, not recomputed.
 */
interface RenderWindow {
  startId: string;
  endId: string;
  // The region's 1-based domain page bounds. renderSplitRuns (INCREMENTAL_RENDER 1d) needs the numeric
  // bounds — not just the boundary block ids — to know which pieces of a split paragraph fall inside the
  // region: a split's continuations are consecutive pages, so a piece's page is read off `continuations`
  // and compared to these. `startId`/`endId` gate the block walk; `startPage`/`endPage` gate a split.
  startPage: number;
  endPage: number;
  active: boolean;
  done: boolean;
}

export class PDFRenderer implements Renderer<Buffer>, PageRangeRenderer {
  // compress defaults to true for real output; tests pass false so the content stream stays
  // plain text and its rendered text can be extracted for assertions (see
  // test-utils/extractPdfText.ts - PDFKit encodes text as hex-string TJ/Tj operands, not the
  // literal-string runs a format like DOCX's XML would have, so a compressed stream can't be
  // grepped for content at all).
  private fonts = new PdfFontRegistry();

  constructor(private options: { compress?: boolean } = {}) {}

  async render(book: PaginatedBook, context: RenderContext): Promise<RenderResult<Buffer>> {
    return new Promise((resolve, reject) => {
      // bufferPages defers writing pages to the output stream until flushed - see
      // drawHeadersAndFooters() below for why this is the right approach here.
      const { width, height, marginTop, marginBottom, marginLeft, marginRight } = book.pageLayout;
      const doc = new PDFDocument({
        size: [width, height],
        margins: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight },
        bufferPages: true,
        compress: this.options.compress ?? true,
        info: {
          ...(context.metadata?.title ? { Title: context.metadata.title } : {}),
          ...(context.metadata?.author ? { Author: context.metadata.author } : {}),
        },
      });

      this.fonts.registerAll(doc);

      const chunks: Buffer[] = [];
      // The true page count, captured before end() flushes the buffered pages. This is the same
      // figure drawHeadersAndFooters() already trusts for the "of TOTAL" denominator - the one
      // number in this file that is measured rather than estimated (ADR-0019 finding 6C), and
      // therefore the only honest source for RenderMetrics (ADR-0045).
      // A holder rather than a `let`: the 'end' listener closes over it and reads it after the
      // assignment below, which prefer-const cannot see - it would have us freeze the value
      // before it is measured.
      const measured: { pageCount?: number } = {};
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          output: Buffer.concat(chunks),
          metrics: {
            pageCount: measured.pageCount,
            pageLayout: book.pageLayout,
            unplannedPageBreaks: reconciliation.unplannedPageBreaks,
            unplannedTitleBreaks: reconciliation.unplannedTitleBreaks,
            degradedDropCaps: degradationTally(doc).degradedDropCaps,
          },
        })
      );
      doc.on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));

      // The page-start and split-plan maps (extracted to buildPageMaps so the region renderer
      // consumes the SAME maps — one truth, never a second copy that could drift, INCREMENTAL_RENDER
      // §D1). Behaviour on this full path is byte-identical (the parity locks guard it).
      const { pageStarts, splitSegments, continuationPages } = this.buildPageMaps(book);

      // Real-PDFKit-page-index -> owning domain Page, built up as addPage() actually happens
      // below (not assumed 1:1 with book.pages - both pagination-estimate drift, ADR-0013, and
      // this commit's own blank pages, which own no domain Page at all, break that assumption).
      // drawHeadersAndFooters() reads this instead of indexing into book.pages directly.
      //
      // Sprint 6 commit 10: a generated TOC (book.tableOfContents) renders as its own
      // unnumbered front-matter page(s) before body content, matching real print convention
      // (front matter is typically unnumbered or uses a separate roman-numeral sequence, out of
      // scope here) - it deliberately does NOT participate in the body's own page-number
      // sequence, which LayoutEngine already computed without reserving room for a TOC page (a
      // real, disclosed simplification: a very long TOC that overflows onto extra physical
      // pages falls into the same pagination-estimate-drift bucket as any other overflow).
      const pageOwners: PageOwner[] = [];

      // ADR-0051 (RENDER_DRIFT.md fix 2): the renderer never breaks a page on its own
      // initiative — but PDFKit CAN, from inside doc.text() when real flow exceeds the plan.
      // Those breaks were silent and unowned: uncounted, unlogged, and — measured, not
      // hypothesized — they shifted every later pageOwners entry by one, misattributing
      // running heads and page numbers for the rest of the book. Every deliberate break in
      // this file now goes through plannedAddPage(); anything else reaching addPage() is a
      // reconciliation event: counted into RenderMetrics, logged with its trigger block, and
      // given an owner so header/footer attribution stays aligned even when a residual drift
      // (e.g. bold-run wrapping, the ±1-line class) slips past the aligned charges.
      const reconciliation = { unplannedPageBreaks: 0, unplannedTitleBreaks: 0 };
      const origAddPage = doc.addPage.bind(doc);
      (doc as unknown as { addPage: () => PDFKit.PDFDocument }).addPage = () => {
        const marker = doc as unknown as { __plannedBreak?: boolean; __currentBlockId?: string };
        const planned = marker.__plannedBreak === true;
        marker.__plannedBreak = false;
        if (!planned) {
          reconciliation.unplannedPageBreaks += 1;
          // MINI_DR_BLOCKLESS_TITLES D5: a reconciliation that fires while a TITLE is being
          // drawn strands a heading at a page bottom — the §10.3 heading gate's failure mode.
          // It gets its own named count instead of adding anonymously into the total
          // (renderTitle stamps the marker with `title "…"`; the gate test pins this at 0 on
          // the whole corpus).
          if (marker.__currentBlockId?.startsWith('title "')) reconciliation.unplannedTitleBreaks += 1;
          console.warn(
            `[PDFRenderer] unplanned page break #${reconciliation.unplannedPageBreaks} while rendering ${marker.__currentBlockId ?? 'front matter'} — real flow exceeded the plan (ADR-0051)`
          );
          pageOwners.push(pageOwners[pageOwners.length - 1] ?? 'blank');
        }
        return origAddPage();
      };

      // Front matter renders first, before the TOC and body, matching real print convention:
      // half-title/title page, then copyright (traditionally on the verso), then contents.
      //
      // Until now `Book.frontMatter` was fully typed and entirely unrendered except for `toc`,
      // so every exported book opened directly on Chapter 1 - no title page, no copyright, no
      // ISBN, no rights notice. That is the difference between a converted document and a
      // publishable book. Like the TOC above, these pages sit outside the body's page-number
      // sequence, which LayoutEngine computed without reserving room for them.
      const frontMatter = book.styledBook.book.frontMatter;

      if (frontMatter.titlePage) {
        this.renderTitlePage(doc, frontMatter.titlePage, book.styledBook.theme);
        pageOwners.push('blank');
        this.plannedAddPage(doc);
      }

      if (frontMatter.copyrightPage) {
        this.renderCopyrightPage(doc, frontMatter.copyrightPage, book.styledBook.theme);
        pageOwners.push('blank');
        this.plannedAddPage(doc);
      }

      if (book.tableOfContents && book.tableOfContents.length > 0) {
        this.renderTableOfContents(doc, book.tableOfContents, book.styledBook.theme);
        pageOwners.push('blank');
        this.plannedAddPage(doc);
      }
      pageOwners.push(book.pages[0]);

      this.renderContent(
        doc,
        book.styledBook.book.mainContent,
        book.styledBook.theme,
        book.styledBook.blockStyles,
        book.styledBook.blockTypography,
        pageStarts,
        pageOwners,
        { segments: splitSegments, continuations: continuationPages },
        true
      );

      this.drawHeadersAndFooters(doc, book, pageOwners);

      // Read after every addPage() has happened and before end() flushes: at this point the
      // buffered range is exactly the document that will be written, front matter included.
      measured.pageCount = doc.bufferedPageRange().count;

      doc.end();
    });
  }

  /**
   * The page-start and split-plan maps, derived from the paginated book. Extracted so BOTH the full
   * render and the region render (`renderPageRange`) consume the SAME maps — one truth, never a second
   * copy that could drift (INCREMENTAL_RENDER_DR §D1). Pure; no drawing.
   */
  private buildPageMaps(book: PaginatedBook): {
    pageStarts: Map<string, Page>;
    splitSegments: Map<string, number[]>;
    continuationPages: Map<string, Page[]>;
  } {
    // Maps a page-starting block's id to the domain Page it starts (blankPagesBefore, for
    // Chapter.openingPageStyle, is 0/undefined on every page except a chapter start -
    // LayoutEngine only computes it there).
    const pageStarts = new Map<string, Page>();
    for (const page of book.pages.slice(1)) {
      // A continuation page's first block is the TAIL of a block split on the previous page
      // (Phase B): the split rendering below produces that page break itself, so forcing one
      // here would double it — and would break the block at its start instead of mid-text.
      if (page.startsWithContinuation) continue;
      const firstId = page.blocks[0];
      if (firstId) pageStarts.set(firstId, page);
    }
    // Phase B split plan: per split block, the line counts of every non-final segment, and
    // the domain Pages its continuations own (so running heads carry the right numbers).
    const splitSegments = new Map<string, number[]>();
    const continuationPages = new Map<string, Page[]>();
    for (const page of book.pages) {
      if (page.splitAfterLines) {
        const lastId = page.blocks[page.blocks.length - 1];
        if (lastId) {
          const segs = splitSegments.get(lastId) ?? [];
          segs.push(page.splitAfterLines);
          splitSegments.set(lastId, segs);
        }
      }
      if (page.startsWithContinuation) {
        const firstId = page.blocks[0];
        if (firstId) {
          const conts = continuationPages.get(firstId) ?? [];
          conts.push(page);
          continuationPages.set(firstId, conts);
        }
      }
    }
    return { pageStarts, splitSegments, continuationPages };
  }

  /**
   * INCREMENTAL_RENDER (P1, candidate 1, INCREMENTAL_RENDER_DR §D1): render ONLY the visible page range
   * `[startPage, endPage]` (1-based domain page numbers) of an already-paginated book. It draws through
   * the SAME renderContent/renderBlock walk as the full render, gated by a `RenderWindow`, and feeds
   * `drawHeadersAndFooters` the range's own domain Pages — so page N in a region is page-for-page
   * identical to page N of the full export (the fidelity invariant), at a fraction of the cost.
   *
   * `totalPages` is the full book's REAL page count (the caller holds it from a full render — the live
   * studio renders the whole book once, then region-renders on edit). It is the "of TOTAL" denominator,
   * so the footer reads "Page 171 of 156", not "of 2".
   *
   * Scope: the leading page may be mid-content (1b), a chapter/section OPENING (1c — its title block and,
   * theme-permitting, its drop cap draw true, seeded on physical page 0), or a CONTINUATION split-tail
   * (1d — renderSplitRuns advances silently through the shared cut implementation to the region's leading
   * boundary and draws from there; a region that ends mid-split shows only its own lines). The invariant
   * tests and guardrails pin exactly what is in scope; nothing speculative is built (YAGNI).
   */
  async renderPageRange(
    book: PaginatedBook,
    context: RenderContext,
    startPage: number,
    endPage: number,
    totalPages: number
  ): Promise<RenderResult<Buffer>> {
    return new Promise((resolve, reject) => {
      const { width, height, marginTop, marginBottom, marginLeft, marginRight } = book.pageLayout;
      const doc = new PDFDocument({
        size: [width, height],
        margins: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight },
        bufferPages: true,
        compress: this.options.compress ?? true,
        info: {
          ...(context.metadata?.title ? { Title: context.metadata.title } : {}),
          ...(context.metadata?.author ? { Author: context.metadata.author } : {}),
        },
      });
      this.fonts.registerAll(doc);

      // Reconciliation wrapper + pageOwners, the SAME mechanism as render() (ADR-0051). Declared
      // before the listeners that close over them.
      const reconciliation = { unplannedPageBreaks: 0, unplannedTitleBreaks: 0 };
      const pageOwners: PageOwner[] = [];
      const measured: { pageCount?: number } = {};
      const origAddPage = doc.addPage.bind(doc);
      (doc as unknown as { addPage: () => PDFKit.PDFDocument }).addPage = () => {
        const marker = doc as unknown as { __plannedBreak?: boolean; __currentBlockId?: string };
        const planned = marker.__plannedBreak === true;
        marker.__plannedBreak = false;
        if (!planned) {
          reconciliation.unplannedPageBreaks += 1;
          if (marker.__currentBlockId?.startsWith('title "')) reconciliation.unplannedTitleBreaks += 1;
          pageOwners.push(pageOwners[pageOwners.length - 1] ?? 'blank');
        }
        return origAddPage();
      };

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () =>
        resolve({
          output: Buffer.concat(chunks),
          metrics: {
            pageCount: measured.pageCount,
            pageLayout: book.pageLayout,
            unplannedPageBreaks: reconciliation.unplannedPageBreaks,
            unplannedTitleBreaks: reconciliation.unplannedTitleBreaks,
            degradedDropCaps: degradationTally(doc).degradedDropCaps,
          },
        })
      );
      doc.on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));

      const { pageStarts, splitSegments, continuationPages } = this.buildPageMaps(book);
      const startIdx = startPage - 1;
      const endIdx = endPage - 1;
      const startBlocks = book.pages[startIdx]?.blocks ?? [];
      const endBlocks = book.pages[endIdx]?.blocks ?? [];
      const window: RenderWindow = {
        startId: startBlocks[0] ?? '',
        endId: endBlocks[endBlocks.length - 1] ?? '',
        startPage,
        endPage,
        active: false,
        done: false,
      };

      // Physical page 0 (PDFKit's initial page) IS domain page `startPage`: seed pageOwners so the
      // chrome numbers it truly. Front matter is skipped by construction (a region is body-only).
      pageOwners.push(book.pages[startIdx]);

      this.renderContent(
        doc,
        book.styledBook.book.mainContent,
        book.styledBook.theme,
        book.styledBook.blockStyles,
        book.styledBook.blockTypography,
        pageStarts,
        pageOwners,
        { segments: splitSegments, continuations: continuationPages },
        true,
        window
      );

      this.drawHeadersAndFooters(doc, book, pageOwners, totalPages);
      measured.pageCount = doc.bufferedPageRange().count;
      doc.end();
    });
  }

  // ADR-0019 finding 6: an earlier version drew headers/footers live via the 'pageAdded' event
  // while content was flowing, which caused two real bugs - (a) writing footer text below the
  // margin triggered PDFKit's own overflow-based auto-pagination from inside the handler that
  // was drawing it, recursing until the stack overflowed, and (b) doc.text(x, y, ...) leaves
  // PDFKit's cursor (doc.x/doc.y) stranded near the bottom of the page, so every subsequent
  // content call without explicit coordinates immediately overflowed onto a new page (a 9-page
  // document rendered as 212 pages). A separate real-world test (a genuine DOCX from
  // backend/uploads/) then surfaced a third problem with the live-draw approach even after
  // those fixes: the footer showed "Page 6 of 4" - LayoutEngine's word-count heuristic (used for
  // the "of TOTAL" figure) undershot PDFKit's actual rendered page count once real content
  // exceeded the estimate.
  //
  // bufferPages: true fixes all three at once. Content renders first with no header/footer
  // interference at all (doc.addPage() flows freely, cursor is never touched by header/footer
  // code). Only after every page actually exists do we loop back with switchToPage() and stamp
  // each one - at which point doc.bufferedPageRange().count is the true, exact page count, not
  // an estimate. No two-pass *render* is needed, just a two-pass *header/footer draw*, and
  // PaginatedBook.pages.length (LayoutEngine's estimate) is no longer used for the displayed
  // total at all.
  //
  // Sprint 6 (ADR-0029 Decision 6): the running-head text is now Theme.runningHead-driven
  // instead of the hardcoded literal 'Book Publisher Studio' this replaced - a real,
  // previously-disclosed bug (PROFESSIONAL_LAYOUT_ENGINE.md §2), fixed as a direct consequence
  // of RunningHead becoming real data, not filed separately. If Theme.runningHead is absent or
  // show:false, no running head OR page-number footer is drawn at all - previously every export
  // always got a footer unconditionally; this is a disclosed, intentional behavior change now
  // gated by theme, matching every other theme decision (fonts, colors) already being
  // theme-driven. PDFKit's estimated Page[] can have a different length than the real rendered
  // page count (ADR-0013) - book.pages[i]'s title is looked up with the index clamped to the
  // last real domain page rather than going out of bounds.
  //
  // RunningHead.font and .separator are accepted by the type but not yet consulted here - no
  // theme populates them yet (only ClassicTheme exists, and it leaves both unset), so there is
  // no real usage to validate against (ADR-0029 Risk 5, same disclosed-not-hidden category as
  // ValidationContext's reserved fields, Sprint 5). Revisit when a real theme needs them.
  //
  // Sprint 6 commit 8: an intentionally blank page (Chapter.openingPageStyle) is pageOwners[i]
  // === 'blank' - nothing is drawn on it at all, matching real print convention.
  // Sprint 6 commit 9: the page-number NUMERATOR now reads the resolved domain Page's own
  // `.number` (honors Chapter.startPageNumber) instead of the raw physical index - the whole
  // point of startPageNumber is to make the displayed number diverge from physical order. The
  // "of TOTAL" DENOMINATOR still uses the real PDFKit page count (ADR-0019 finding 6C, unchanged
  // - an estimate could show a factually wrong total). For a pagination-estimate-drift tail page
  // (pageOwners[i] === undefined, ADR-0013) there is no resolved Page to read a number from, so
  // the numerator falls back to the physical index too, same as every page did before this
  // commit - no regression for the drift case that finding 6C's own test already covers.
  private drawHeadersAndFooters(doc: PDFKit.PDFDocument, book: PaginatedBook, pageOwners: PageOwner[], totalPages?: number): void {
    const runningHead = book.styledBook.theme.runningHead;
    const range = doc.bufferedPageRange();
    // The "of TOTAL" denominator. Full render: the real buffered count (ADR-0019 finding 6C). Region
    // render (INCREMENTAL_RENDER): the FULL book's real count passed in, so page N's footer reads
    // "of <full total>" identically to the full export — not "of <region page count>".
    const denominator = totalPages ?? range.count;

    // TABLE_DUPLICATION.md Défaut B: an unplanned (reconciliation) page copies the PREVIOUS
    // page's owner (PDFRenderer.ts, the addPage wrapper) — right for the running-head TITLE
    // (the spilled text belongs to the same chapter) but wrong for the page NUMBER, which
    // must still advance. One field, two jobs; ADR-0051 fixed the title, silently broke the
    // number. The fix separates them: the copied owner keeps carrying the title, and the
    // displayed number becomes `owner.number + insertionsSoFar` — every reconciliation shifts
    // the physical sequence one ahead of the model's own numbering, so this offset re-aligns
    // it into a strictly-increasing run. A reconciliation page is identified by REFERENCE
    // equality with the previous owner (planned pages each push a DISTINCT `Page` object; only
    // the wrapper pushes a duplicate reference). `startPageNumber` — never populated by the
    // real pipeline today, but honored via `owner.number` — keeps working: its reset rides
    // along in `owner.number`, and the offset stays consistent within the new sequence.
    let insertions = 0;
    let prevOwner: PageOwner = undefined;

    for (let i = range.start; i < range.start + range.count; i++) {
      const owner = pageOwners[i];
      if (owner === 'blank') {
        prevOwner = owner;
        continue;
      }
      const isReconciliation = owner !== undefined && owner === prevOwner;
      if (isReconciliation) insertions += 1;

      doc.switchToPage(i);
      const { width, height, margins } = doc.page;
      const contentWidth = width - margins.left - margins.right;
      const savedBottom = margins.bottom;
      doc.page.margins.bottom = 0;

      if (runningHead?.show) {
        const title = owner?.headerFooterTitle;
        if (title) {
          const text = runningHead.uppercase ? title.toUpperCase() : title;
          const align = runningHead.position === 'left' ? 'left' : 'right';
          doc.font(this.fonts.resolveDefault(false, false)).fontSize(runningHead.size ?? 9).fillColor('#000');
          doc.text(text, margins.left, 40, { width: contentWidth, align, lineBreak: false });
        }

        if (runningHead.pageNumber) {
          // owner.number honors startPageNumber; +insertions re-aligns physical progression
          // past reconciliation pages (see the block comment above). Drift/undefined owners
          // (ADR-0013) still fall back to the physical index.
          const displayNumber = owner?.number !== undefined ? owner.number + insertions : i + 1;
          doc.font(this.fonts.resolveDefault(false, false)).fontSize(runningHead.size ?? 9).fillColor('#000');
          doc.text(`Page ${displayNumber} of ${denominator}`, margins.left, height - 50, {
            width: contentWidth,
            align: 'center',
            lineBreak: false,
          });
        }
      }

      doc.page.margins.bottom = savedBottom;
      prevOwner = owner;
    }
  }


  /**
   * Every DELIBERATE page break goes through here (ADR-0051): flags the wrapped addPage so it
   * is not mistaken for a PDFKit-initiated overflow break. The flag lives on the doc because
   * a renderer instance is shared across concurrent requests; the document is not.
   */
  private plannedAddPage(doc: PDFKit.PDFDocument): void {
    (doc as unknown as { __plannedBreak?: boolean }).__plannedBreak = true;
    doc.addPage();
  }

  /**
   * Spends a block's `spaceAfter` exactly as the model charged it: FLAT POINTS. The previous
   * `doc.moveDown(spaceAfter / fontSize)` advanced `spaceAfter × (lineHeight / fontSize)` —
   * about +15% on every block, the dominant cause of the 55 unplanned overflow breaks
   * (RENDER_DRIFT.md §3, fix 1: "charge what the renderer spends, or spend what the model
   * charges" — the model's flat-point semantic is the theme's own declared meaning).
   */
  private spendSpaceAfter(doc: PDFKit.PDFDocument, spaceAfter: number): void {
    doc.y += spaceAfter;
  }

  private renderContent(
    doc: PDFKit.PDFDocument,
    contents: Content[],
    theme: Theme,
    blockStyles: Record<string, ResolvedBlockStyle>,
    blockTypography: Record<string, ResolvedTypography> | undefined,
    pageStarts: Map<string, Page>,
    pageOwners: PageOwner[],
    splits: SplitPlan,
    isTopLevel: boolean,
    window?: RenderWindow
  ): void {
    for (const content of contents) {
      if (window?.done) return; // the range is finished — draw nothing more
      const firstBlockId = content.content[0]?.id;
      // A blockless titled top-level chapter (the Part-opener shape) owns its planned page under
      // the CONTENT's own id — it has no block id the pageStarts protocol could key by
      // (LayoutEngine's ownsBarePage branch, PART_LEVEL_STRUCTURE commit 1). startKey preserves
      // the first-block path byte-for-byte when blocks exist; for an empty-with-sections chapter
      // the model emitted no content-id page, so the lookup misses and behaviour is unchanged.
      const startKey =
        firstBlockId ?? (isTopLevel && content.type === 'chapter' && content.title ? content.id : undefined);
      const ownerPage = isTopLevel && content.type === 'chapter' && startKey !== undefined ? pageStarts.get(startKey) : undefined;
      if (ownerPage && startKey !== undefined) pageStarts.delete(startKey);

      // INCREMENTAL_RENDER: while BEFORE the range (window && !active), the chapter/section chrome —
      // its blank pages, its opening break, its keep-with-next break, its title — is suppressed and
      // no page is added, so pageOwners stays aligned with the pages that are actually emitted. The
      // pageStarts entries are still consumed (deleted) above/below to keep the map's state consistent
      // with the full walk. A mid-content range never draws a title here (its title is on an earlier page).
      //
      // INCREMENTAL_RENDER 1c — the region's LEADING page IS this content's opening. Its first block
      // is `window.startId`, so activate the window HERE, before the chrome decisions, so the opening's
      // TITLE (and, for a chapter, its subtitle) draws — page-for-page identical to the export's opening.
      // The drop cap needs nothing special here: it is a property of the first paragraph and rides along
      // through renderBlock (theme-conditional — Novel lights it, Classic doesn't). But the leading page
      // is ALREADY seeded as physical page 0 in renderPageRange, so the blank pages and the opening/
      // keep-with-next page BREAK are suppressed (drawing them would push the opening onto physical page
      // 1+): the exact analogue of renderBlock consuming a mid-content leading block's page-start so no
      // leading break fires. One walk, one path — chapter openings and section openings alike.
      const isLeadingBoundary =
        window !== undefined && !window.active && firstBlockId !== undefined && firstBlockId === window.startId;
      if (isLeadingBoundary) window.active = true;
      const drawingChrome = !window || window.active;
      // Every opening WITHIN the range adds its own page; the range's leading opening does not (seeded).
      const addingLeadingPages = drawingChrome && !isLeadingBoundary;

      // Blank pages (Chapter.openingPageStyle) are genuinely empty physical pages - each
      // addPage() here is immediately followed by another with nothing drawn in between,
      // then the real content page below starts normally.
      if (addingLeadingPages) {
        for (let i = 0; i < (ownerPage?.blankPagesBefore ?? 0); i++) {
          this.plannedAddPage(doc);
          pageOwners.push('blank');
        }
        if (ownerPage) {
          this.plannedAddPage(doc);
          pageOwners.push(ownerPage);
        }
      }
      // Keep-with-next (ADR-0051): a non-chapter titled content whose first block begins a
      // planned page moved WITH its title — the model's flushBeforeTitleIfOrphaned invariant —
      // so the break comes BEFORE the title, never stranding it at a spent page bottom.
      // A BLOCKLESS titled content has no first block to key by: its planned page carries the
      // content's OWN id (MINI_DR_BLOCKLESS_TITLES, the ownsBarePage precedent one level down),
      // so the same protocol matches on that — one key, no new mechanism.
      const keepWithNextKey = firstBlockId ?? (content.title ? content.id : undefined);
      if (!ownerPage && content.title && keepWithNextKey) {
        const sectionStart = pageStarts.get(keepWithNextKey);
        if (sectionStart) {
          pageStarts.delete(keepWithNextKey);
          if (addingLeadingPages) {
            this.plannedAddPage(doc);
            pageOwners.push(sectionStart);
          }
        }
      }
      if (drawingChrome) this.renderTitle(doc, content, theme);

      for (const block of content.content) {
        this.renderBlock(doc, block, theme, blockStyles[block.id], blockTypography, pageStarts, pageOwners, splits, window);
        if (window && block.id === window.endId) {
          window.done = true;
          window.active = false;
        }
      }

      if (content.type === 'chapter' && content.sections) {
        this.renderContent(doc, content.sections, theme, blockStyles, blockTypography, pageStarts, pageOwners, splits, false, window);
      } else if (content.type === 'section' && content.subsections) {
        this.renderContent(doc, content.subsections, theme, blockStyles, blockTypography, pageStarts, pageOwners, splits, false, window);
      }
    }
  }

  // Functional Spec item 7 / Architecture Impact §4: PDFRenderer becomes a consumer of
  // paginated.tableOfContents, the same way it already consumes resolved header/footer data.
  // Each entry indents by its heading level and shows "Title    N" - no dotted-leader styling
  // (a cosmetic detail the design doesn't specify), title left, page number appended inline.
  /**
   * A title page is mostly whitespace by design — the title sits roughly a third down the page,
   * the author near the foot. Centring everything in a block at the top would read as a heading,
   * not as a title page.
   */
  private renderTitlePage(doc: PDFKit.PDFDocument, page: TitlePage, theme: Theme): void {
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const top = doc.page.margins.top + (doc.page.height - doc.page.margins.top - doc.page.margins.bottom) * 0.28;

    doc.font(this.fonts.resolveHeading(1, theme, true, false)).fontSize(32).fillColor('#000');
    doc.text(page.title, doc.page.margins.left, top, { width: usableWidth, align: 'center' });

    if (page.subtitle) {
      doc.moveDown(0.5);
      doc.font(this.fonts.resolveHeading(2, theme, false, true)).fontSize(16).fillColor('#333');
      doc.text(page.subtitle, doc.page.margins.left, doc.y, { width: usableWidth, align: 'center' });
    }

    if (page.tagline) {
      doc.moveDown(1);
      doc.font(this.fonts.resolveBody(theme, false, true)).fontSize(11).fillColor('#555');
      doc.text(page.tagline, doc.page.margins.left, doc.y, { width: usableWidth, align: 'center' });
    }

    // A title page with no real author prints no author line (FOUNDER_TRAVERSAL defect 2) —
    // never 'Unknown author'. FrontMatterBuilder only sets this when a real author exists.
    if (page.author) {
      doc.font(this.fonts.resolveBody(theme, false, false)).fontSize(14).fillColor('#000');
      doc.text(page.author, doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 80, {
        width: usableWidth,
        align: 'center',
      });
    }
  }

  /**
   * Set small and low on the page, as printed books do. Every line is conditional: a copyright
   * page that prints an empty "ISBN:" label looks authored and wrong, so a missing field is
   * simply absent.
   */
  private renderCopyrightPage(doc: PDFKit.PDFDocument, page: CopyrightPage, theme: Theme): void {
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const lines = [
      page.text,
      page.copyrightText && page.copyrightText !== page.text ? page.copyrightText : undefined,
      page.legalNotice,
      page.isbn ? `ISBN: ${page.isbn}` : undefined,
      page.printingInfo,
    ].filter((line): line is string => Boolean(line));

    doc.font(this.fonts.resolveBody(theme, false, false)).fontSize(9).fillColor('#000');
    let y = doc.page.height - doc.page.margins.bottom - lines.length * 14 - 40;

    for (const line of lines) {
      doc.text(line, doc.page.margins.left, y, { width: usableWidth, align: 'left' });
      y = doc.y + 2;
    }
  }

  private renderTableOfContents(doc: PDFKit.PDFDocument, entries: TOCEntry[], theme: Theme): void {
    doc.font(this.fonts.resolveHeading(1, theme, true, false)).fontSize(24).fillColor('#000').text('Table of Contents');
    doc.moveDown();

    for (const entry of entries) {
      const indent = (entry.level - 1) * 18;
      const pageLabel = entry.pageNumber !== undefined ? `    ${entry.pageNumber}` : '';
      doc.font(this.fonts.resolveBody(theme, false, false)).fontSize(11).fillColor('#000');
      doc.text(`${entry.title}${pageLabel}`, doc.page.margins.left + indent, doc.y);
    }
  }

  private renderTitle(doc: PDFKit.PDFDocument, content: Chapter | Section, theme: Theme): void {
    // An empty title (e.g. an untitled preamble Section, ADR-0020 addendum) draws nothing and,
    // crucially, spends NO spacing -- matching LayoutEngine.titleHeightOf's `if (!title) return 0`,
    // so charged == consumed holds for empty titles too (MINI_DR_SUBTITLE_SPACING). Without this,
    // the flat title spacing below would be consumed while the model charged zero -> drift.
    if (!content.title) return;
    (doc as unknown as { __currentBlockId?: string }).__currentBlockId = `title "${content.title.slice(0, 40)}"`;
    const level = content.type === 'chapter' ? 1 : content.level;
    const size = content.type === 'chapter' ? 24 : Math.max(12, 22 - content.level * 2);
    // Chapter/section titles are conceptually headings, so they now resolve through the
    // same heading role as Heading blocks (Sprint 4 commit 7 amendment) - previously they
    // used the generic "default" chrome font, a real inconsistency with Heading blocks
    // rendering in the theme's actual heading family.
    // Phase 3 capability 1: the title colour comes from the theme's accent, like Heading blocks
    // (ThemeEngine). This '#000' was the ONLY hardcoded title colour of the three renderers —
    // DOCX already resolved it through buildHeadingStyles, EPUB inherits it from CSS. The other
    // hardcoded colours here (running heads, title page, copyright) are front matter and chrome,
    // a different surface, deliberately untouched — see MINI_DR_ACCENT_COLORS.md §1.
    // Title spacing is a theme value, spent flat in lock-step with LayoutEngine.titleHeightOf
    // (MINI_DR_SUBTITLE_SPACING). Was: no space before + a size-scaled doc.moveDown() after --
    // below-only and backwards from convention. Now: titleSpaceBefore above, titleSpaceAfter below
    // (above > below), so the title binds to the text it introduces. Both terms are flat points
    // (theme-owned, size-independent) and both are charged by titleHeightOf, so charged == consumed
    // (ADR-0051) holds by construction. The preceding block's paragraphSpacing still bleeds down,
    // so the visible gap above is (paragraphSpacing + titleSpaceBefore); values account for it.
    this.spendSpaceAfter(doc, theme.spacing.titleSpaceBefore);
    doc.font(this.fonts.resolveHeading(level, theme, true, false)).fontSize(size).fillColor(theme.colors.accent).text(content.title);
    // A chapter's subtitle (MINI_DR_SUBTITLE_FIELD §4): italic, the shared ratio of the title
    // size, same accent, directly under the title INSIDE the title block — drawn here and
    // charged by titleHeightOf in the same expression (lock-step, never a parallel calculation).
    if (content.type === 'chapter' && content.subtitle) {
      doc
        .font(this.fonts.resolveHeading(level, theme, false, true))
        .fontSize(size * CHAPTER_SUBTITLE_RATIO)
        .fillColor(theme.colors.accent)
        .text(content.subtitle);
    }
    this.spendSpaceAfter(doc, theme.spacing.titleSpaceAfter);
  }

  private renderBlock(
    doc: PDFKit.PDFDocument,
    block: Block,
    theme: Theme,
    style: ResolvedBlockStyle | undefined,
    blockTypography: Record<string, ResolvedTypography> | undefined,
    pageStarts: Map<string, Page>,
    pageOwners: PageOwner[],
    splits: SplitPlan,
    window?: RenderWindow
  ): void {
    // INCREMENTAL_RENDER window gate: before the range's first block, draw nothing and break nothing.
    // At startId we are already on the region's first physical page, so consume this block's own
    // page-start so the leading break below does NOT fire (the region begins at page top, not after a
    // break). endId is closed by the caller AFTER this block draws.
    if (window) {
      if (window.done) return;
      if (block.id === window.startId) {
        window.active = true;
        pageStarts.delete(block.id);
      } else if (!window.active) {
        return;
      }
    }
    (doc as unknown as { __currentBlockId?: string }).__currentBlockId = `${block.type} ${block.id}`;
    const ownerPage = pageStarts.get(block.id);
    if (ownerPage) {
      // Never carries blankPagesBefore - that only applies at a chapter's own opening break,
      // handled in renderContent above. This is an overflow-triggered continuation page.
      this.plannedAddPage(doc);
      pageOwners.push(ownerPage);
      pageStarts.delete(block.id);
    }

    const fontSize = style?.fontSize ?? 11;
    const color = style?.color ?? '#000000';
    const spaceAfter = style?.spaceAfter ?? 8;
    const resolveBody: FontResolver = (bold, italic) => this.fonts.resolveBody(theme, bold, italic);

    switch (block.type) {
      case 'heading': {
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        // Headings are always bold at the PDFRenderer level (a rendering choice, same as
        // before this commit) - each run's own italic flag (inline emphasis within the
        // heading) is still respected. Size now comes from the theme (style.fontSize,
        // theme.fontSizes.h1-h6 via ThemeEngine) instead of a hardcoded per-level formula -
        // design review §4 item 3.
        const resolveHeadingFont: FontResolver = (bold, italic) => this.fonts.resolveHeading(block.level, theme, bold, italic);
        this.renderRuns(doc, runs, resolveHeadingFont, fontSize, color, {}, undefined, true);
        this.spendSpaceAfter(doc, spaceAfter);
        return;
      }

      case 'paragraph': {
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        const dropCap = blockTypography?.[block.id]?.dropCap ?? false;
        const options: PDFKit.Mixins.TextOptions = { align: block.align === 'justify' ? 'justify' : (block.align ?? 'left') };
        if (block.callout === true) {
          // Atomic (never in the split plan) and never drop-capped (the resolver's exclusion).
          this.renderCalloutParagraph(doc, runs, resolveBody, fontSize, color, options, theme);
          this.spendSpaceAfter(doc, spaceAfter);
          return;
        }
        const segments = splits.segments.get(block.id);
        if (segments && !dropCap) {
          this.renderSplitRuns(doc, runs, resolveBody, fontSize, color, options, segments, splits.continuations.get(block.id) ?? [], pageOwners, window);
          this.spendSpaceAfter(doc, spaceAfter);
          return;
        }
        if (dropCap) {
          this.renderRunsWithDropCap(doc, runs, resolveBody, fontSize, color, options, dropCapScaleOf(theme));
        } else {
          this.renderRuns(doc, runs, resolveBody, fontSize, color, options);
        }
        this.spendSpaceAfter(doc, spaceAfter);
        return;
      }

      case 'quote':
      case 'scripture': {
        // Italics are already forced onto every run by TypographyResolver
        // (design review §4 item 9) - no block-level italic override needed here anymore.
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        this.renderRuns(doc, runs, resolveBody, fontSize, color, { indent: 36 });
        this.spendSpaceAfter(doc, spaceAfter);
        return;
      }

      case 'list':
        block.items.forEach((item, index) => {
          const prefix = block.ordered ? `${index + 1}. ` : '• ';
          const itemRuns = runsOrPlainFallback(blockTypography?.[listItemTypographyKey(block.id, index)], item);
          this.renderRuns(doc, itemRuns, resolveBody, fontSize, color, { indent: 18 }, prefix);
        });
        this.spendSpaceAfter(doc, spaceAfter);
        return;

      case 'table':
        this.renderTable(doc, block.headers, block.rows, theme, fontSize);
        this.spendSpaceAfter(doc, spaceAfter);
        return;

      case 'footnote': {
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.content);
        this.renderRuns(doc, runs, resolveBody, Math.max(7, fontSize - 2), color, {}, `[${block.number}] `);
        this.spendSpaceAfter(doc, spaceAfter);
        return;
      }

      case 'image':
        if (block.base64) {
          // R2: the fit box comes from renderedImageSize — the exact height the model priced.
          // Without probed dimensions, the historical 300pt-fit fallback stands (and the model
          // priced its own fallback constant; both sides degrade together, never apart).
          const usableImageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          const size = renderedImageSize(block, usableImageWidth);
          try {
            doc.image(Buffer.from(block.base64, 'base64'), {
              fit: size ? [size.width, size.height] : [usableImageWidth, block.height ?? 300],
            });
          } catch (error) {
            // One undecodable image must never kill a whole book's export (ADR-0050: the
            // manuscript survives; ADR-0051 spirit: the degradation is OBSERVABLE, never
            // silent). Found live: a malformed PNG that browsers tolerate but PDFKit's strict
            // decoder rejects — before Phase 2 populated base64, nothing ever decoded, so the
            // corruption hid inside the fixture for its whole life.
            console.warn(
              `[PDFRenderer] image ${block.id} could not be decoded (${error instanceof Error ? error.message : String(error)}) — rendered as placeholder`
            );
            doc.font(this.fonts.resolveBody(theme, false, true)).fontSize(fontSize).text(`[Image: ${block.caption ?? block.alt ?? 'undecodable'}]`);
          }
        } else {
          // No embedded data - never fetch remote URLs at render time (no hidden network I/O
          // in a renderer, same rule DOCXRenderer follows). Falls back to a text placeholder.
          doc.font(this.fonts.resolveBody(theme, false, true)).fontSize(fontSize).text(`[Image: ${block.caption ?? block.url}]`);
        }
        this.spendSpaceAfter(doc, spaceAfter);
        return;

      case 'page-break':
        this.plannedAddPage(doc);
        return;

      case 'divider':
        doc.font(this.fonts.resolveBody(theme, false, false)).fontSize(fontSize).fillColor(color).text('* * *', { align: 'center' });
        return;

      default: {
        const _exhaustive: never = block;
        throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  // Renders a sequence of TypeRun spans as one flowing PDFKit paragraph, using continued
  // text so font/color/decoration can change mid-line without breaking the line - this is
  // what lets bold/italic/underline/strikethrough/links actually appear now (previously,
  // no renderer read Block.inlines at all). Superscript/subscript/small-caps are resolved
  // by TypographyResolver but PDFKit has no built-in primitive for baseline shifting or
  // small-caps glyph substitution (unlike underline/strike, which are native text options) -
  // rendered as plain-sized text for v1, a documented gap matching this codebase's existing
  // precedent of accepting a library capability limit rather than hand-rolling risky
  // absolute positioning (ADR-0019 finding 6's cursor-stranding lesson).
  //
  // leadingPlainText (list "1. "/"• " prefixes, footnote "[n] " prefixes) renders in the
  // block's plain (non-bold, non-italic) style before the real runs, on the same line.
  // forceBold applies to every run in this call (headings only, a PDFRenderer-level
  // rendering choice - not a Domain rule). resolveFont is bound by the caller to the
  // correct PdfFontRegistry role (body vs heading) - this method never talks to
  // PdfFontRegistry directly, keeping all font-selection policy in the registry.
  private renderRuns(
    doc: PDFKit.PDFDocument,
    runs: TypeRun[],
    resolveFont: FontResolver,
    fontSize: number,
    color: string,
    paragraphOptions: PDFKit.Mixins.TextOptions = {},
    leadingPlainText?: string,
    forceBold = false
  ): void {
    const segments: Array<{ text: string; bold: boolean; italic: boolean; underline?: boolean; strike?: boolean; link?: string }> = [];
    if (leadingPlainText) {
      segments.push({ text: leadingPlainText, bold: forceBold, italic: false });
    }
    for (const run of runs) {
      segments.push({
        text: run.text,
        bold: forceBold || run.bold,
        italic: run.italic,
        underline: run.underline || undefined,
        strike: run.strikethrough || undefined,
        link: run.linkUrl,
      });
    }
    if (segments.length === 0) return;

    segments.forEach((seg, index) => {
      const isFirst = index === 0;
      const isLast = index === segments.length - 1;
      doc.font(resolveFont(seg.bold, seg.italic)).fontSize(fontSize).fillColor(color);
      doc.text(seg.text, {
        ...(isFirst ? paragraphOptions : {}),
        continued: !isLast,
        underline: seg.underline,
        strike: seg.strike,
        link: seg.link,
      });
    });
  }

  /**
   * Renders a paragraph the LayoutEngine split across pages (Phase B, LAYOUT_FIDELITY.md
   * Decision 7): each non-final segment renders its allotted lines, then a real page break,
   * with the continuation's own domain Page pushed so running heads carry the right numbers.
   *
   * The cut point is found on the SAME metrics pagination measured with (this document's own
   * font and column width), by binary search over word boundaries — the largest prefix whose
   * real height fits the allotted lines. Two disclosed residuals: a justified paragraph's
   * pre-break line renders ragged (PDFKit justifies every line except a text() call's last,
   * and the segment boundary is one), and bold/italic runs can wrap a word differently than
   * the plain-text measurement assumed — both are ADR-0013's drift class, bounded to ±1 line.
   */
  private renderSplitRuns(
    doc: PDFKit.PDFDocument,
    runs: TypeRun[],
    resolveFont: FontResolver,
    fontSize: number,
    color: string,
    paragraphOptions: PDFKit.Mixins.TextOptions,
    segments: number[],
    continuations: Page[],
    pageOwners: PageOwner[],
    window?: RenderWindow
  ): void {
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.font(resolveFont(false, false)).fontSize(fontSize);
    const lineHeight = doc.heightOfString('x', { width: 10_000 });

    // INCREMENTAL_RENDER 1d — the split-tail factor. A split paragraph's continuations are always
    // CONSECUTIVE pages (a paragraph cannot skip a page), so each drawn piece's page is read off
    // `continuations`: piece 0 (the head on the block's own start page) sits on continuations[0].number-1,
    // piece k≥1 on continuations[k-1].number, and the final remainder on continuations[last].number. When
    // a region window is present, only the pieces whose page lies within [startPage, endPage] are drawn:
    //   • a piece BEFORE the region is advanced SILENTLY through the SAME cut implementation below
    //     (charsFittingBudget/splitRunsAt) — never a second resume logic — so `remaining` arrives at the
    //     region's leading boundary exactly as the full render leaves it (the leading split-tail);
    //   • a piece AFTER the region is not drawn and its leading break is not emitted — required for
    //     page-region ≡ page-export, since the region's last page must show only the lines the export
    //     shows there (the trailing boundary — correctness demands it, so it is handled, not deferred).
    // No window ⇒ every piece is in range ⇒ byte-identical to the full render (the parity locks guard it).
    const startPage = window?.startPage ?? Number.NEGATIVE_INFINITY;
    const endPage = window?.endPage ?? Number.POSITIVE_INFINITY;
    const piece0Page = continuations.length > 0 ? continuations[0].number - 1 : Number.NEGATIVE_INFINITY;

    let remaining = runs;
    for (let i = 0; i < segments.length; i++) {
      const plain = remaining.map((run) => run.text).join('');
      // Float-noise epsilon only. The previous half-line slack let a segment render up to
      // half a line taller than the model charged for it — at 149 splits per book, a steady
      // source of end-of-page overflows PDFKit resolved on its own (ADR-0051 census).
      const budget = segments[i] * lineHeight + 0.5;
      const cutAt = this.charsFittingBudget(doc, plain, budget, usableWidth);
      const piecePage = i === 0 ? piece0Page : continuations[i - 1].number;

      if (cutAt <= 0 || cutAt >= plain.length) {
        // drift guard: the cut failed; the full render draws the rest whole at THIS piece's page.
        // In a region, draw it only if that page is inside the region (else it belongs before/after).
        if (piecePage >= startPage && piecePage <= endPage) {
          this.renderRuns(doc, remaining, resolveFont, fontSize, color, paragraphOptions);
        }
        return;
      }

      const [head, tail] = splitRunsAt(remaining, cutAt);
      const nextPage = continuations[i].number; // the page this piece would break TO (piece i+1)

      if (piecePage >= startPage && piecePage <= endPage) {
        this.renderRuns(doc, head, resolveFont, fontSize, color, paragraphOptions);
        if (nextPage <= endPage) {
          this.plannedAddPage(doc);
          pageOwners.push(continuations[i]);
        } else {
          return; // the region ends on this page, mid-split: emit no break past endPage
        }
      }
      // (a piece before the region: advance silently — no draw, no break)
      doc.font(resolveFont(false, false)).fontSize(fontSize);
      remaining = tail;
    }
    // The final remainder — drawn only if its page is within the region.
    const finalPage = continuations.length > 0 ? continuations[continuations.length - 1].number : piece0Page;
    if (finalPage >= startPage && finalPage <= endPage) {
      this.renderRuns(doc, remaining, resolveFont, fontSize, color, paragraphOptions);
    }
  }

  /**
   * Largest word-boundary character offset whose text really fits `budget` points of height at
   * this width — binary search over word ends, ~log2(words) heightOfString calls. Assumes the
   * document's font and size are already set to the segment's own.
   */
  private charsFittingBudget(doc: PDFKit.PDFDocument, text: string, budget: number, width: number): number {
    const wordEnds: number[] = [];
    const re = /\S+/g;
    for (let m = re.exec(text); m; m = re.exec(text)) wordEnds.push(m.index + m[0].length);
    if (wordEnds.length < 2) return 0;

    let lo = 1; // at least one word stays behind the cut
    let hi = wordEnds.length - 1; // at least one word crosses it
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const height = doc.heightOfString(text.slice(0, wordEnds[mid - 1]), { width });
      if (height <= budget) {
        best = wordEnds[mid - 1];
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  }

  /**
   * The callout chrome (MINI_DR_CALLOUTS §3): a left rule in the resolved accent, an optional
   * theme-declared tint behind the text, the text in a column narrowed by rule + gap, vertical
   * padding above and below — every number from `calloutMetrics`, the same the model charged.
   *
   * The chrome's height is MEASURED here on this document (plain concatenated text, the same
   * arithmetic `estimateBlockHeight` ran), drawn BEFORE the text so the ink sits behind it.
   * Bold-heavy runs can wrap a line past the measured box (the standing ±1-line residual class,
   * same as renderSplitRuns') — the cursor then advances to wherever the real text ended, never
   * backwards over drawn text. On the atomic-overflow debt case (a callout taller than a page)
   * PDFKit breaks the page mid-box: counted as a reconciliation, and the chrome rects stay on
   * the first page — the disclosed shape of that debt, not a silent defect.
   */
  private renderCalloutParagraph(
    doc: PDFKit.PDFDocument,
    runs: TypeRun[],
    resolveFont: FontResolver,
    fontSize: number,
    color: string,
    paragraphOptions: PDFKit.Mixins.TextOptions,
    theme: Theme
  ): void {
    const xLeft = doc.page.margins.left;
    const usableWidth = doc.page.width - xLeft - doc.page.margins.right;
    const narrowWidth = usableWidth - calloutTextIndentPt();

    doc.font(resolveFont(false, false)).fontSize(fontSize);
    const plain = runs.map((run) => run.text).join('');
    const boxHeight = doc.heightOfString(plain, { width: narrowWidth }) + 2 * CALLOUT_PAD_V_PT;

    const y0 = doc.y;
    const tint = calloutTintOf(theme);
    if (tint) doc.rect(xLeft, y0, usableWidth, boxHeight).fill(tint);
    doc.rect(xLeft, y0, CALLOUT_RULE_PT, boxHeight).fill(calloutRuleColorOf(theme));

    doc.x = xLeft + calloutTextIndentPt();
    doc.y = y0 + CALLOUT_PAD_V_PT;
    this.renderRuns(doc, runs, resolveFont, fontSize, color, { ...paragraphOptions, width: narrowWidth });

    doc.x = xLeft;
    doc.y = Math.max(doc.y + CALLOUT_PAD_V_PT, y0 + boxHeight);
  }

  private renderRunsWithDropCap(
    doc: PDFKit.PDFDocument,
    runs: TypeRun[],
    resolveFont: FontResolver,
    fontSize: number,
    color: string,
    paragraphOptions: PDFKit.Mixins.TextOptions,
    dropCapScale: number
  ): void {
    const [firstRun, ...restRuns] = runs;
    if (!firstRun || firstRun.text.length === 0) {
      this.renderRuns(doc, runs, resolveFont, fontSize, color, paragraphOptions);
      return;
    }

    const dropCapChar = firstRun.text[0];
    const remainderOfFirstRun = firstRun.text.slice(1);
    const remainingRuns: TypeRun[] = remainderOfFirstRun ? [{ ...firstRun, text: remainderOfFirstRun }, ...restRuns] : restRuns;

    const dropSize = fontSize * dropCapScale;
    const dropFont = resolveFont(true, firstRun.italic);

    // Metrics first, because they can refuse. Measured on THIS document, in the very faces this
    // renderer draws with — the same numbers LayoutEngine priced through TextMeasurer.
    let geometry: DropCapGeometry;
    let bodyLine: number;
    try {
      doc.font(dropFont).fontSize(dropSize);
      const glyphWidth = doc.widthOfString(dropCapChar);
      const capEm = ((doc as unknown as { _font?: { capHeight?: number } })._font?.capHeight ?? Number.NaN) / 1000;
      assertPlausibleCapHeight(capEm, dropFont);
      doc.font(resolveFont(false, false)).fontSize(fontSize);
      bodyLine = doc.heightOfString('x', { width: 10_000 });
      geometry = dropCapGeometry({
        fontSize,
        usableWidth: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        glyphWidth,
        capPt: capEm * dropSize,
        bodyLine,
      });
    } catch (error) {
      // The guard refused: PDFKit's private cap-height metric is no longer trustworthy
      // (docs/DECISIONS.md). Drop the ORNAMENT, never the book — the paragraph renders as
      // ordinary text and the loss is counted, never silent (ADR-0051 applied to presentation).
      countDegradedDropCap(doc, error);
      doc.font(resolveFont(false, false)).fontSize(fontSize);
      this.renderRuns(doc, runs, resolveFont, fontSize, color, paragraphOptions);
      return;
    }

    const xLeft = doc.page.margins.left;
    const usableWidth = doc.page.width - xLeft - doc.page.margins.right;
    const y0 = doc.y;

    // The glyph itself: drawn at the margin, NOT joined to the text flow. The old
    // `{ continued: true }` is exactly what caused DROPCAP_TEXT_OVERLAP — the following lines
    // wrapped at full column width and started underneath the glyph, hiding four characters.
    doc.font(dropFont).fontSize(dropSize).fillColor(color);
    doc.text(dropCapChar, xLeft, y0, { lineBreak: false });
    doc.font(resolveFont(false, false)).fontSize(fontSize);

    if (remainingRuns.length === 0) {
      doc.y = y0 + geometry.capPt;
      doc.x = xLeft;
      return;
    }

    // How much text fills the indented band beside the glyph, measured at the narrowed column.
    const plain = remainingRuns.map((run) => run.text).join('');
    const budget = geometry.bandLines * bodyLine + 0.5; // float-noise epsilon only
    const beside = { ...paragraphOptions, width: geometry.narrowWidth };

    // Ask "does ALL of it fit beside the glyph?" DIRECTLY. charsFittingBudget cannot answer it:
    // its contract is to always leave at least one word past the cut (correct for a page split,
    // where something must cross to the next page). Using it here pushed the last word of a
    // short paragraph below the band for no reason -- caught by the pre-existing drop-cap test,
    // which is exactly what it was written to catch.
    const fitsEntirely = doc.heightOfString(plain, { width: geometry.narrowWidth }) <= budget;
    const cutAt = fitsEntirely ? plain.length : this.charsFittingBudget(doc, plain, budget, geometry.narrowWidth);

    if (cutAt <= 0 || cutAt >= plain.length) {
      // The whole remainder sits beside the glyph.
      doc.x = xLeft + geometry.indentPt;
      doc.y = y0;
      this.renderRuns(doc, remainingRuns, resolveFont, fontSize, color, beside);
      doc.x = xLeft;
      // Never let the next block start inside the glyph's ink.
      if (doc.y < y0 + geometry.capPt) doc.y = y0 + geometry.capPt;
      return;
    }

    const [head, tail] = splitRunsAt(remainingRuns, cutAt);
    doc.x = xLeft + geometry.indentPt;
    doc.y = y0;
    this.renderRuns(doc, head, resolveFont, fontSize, color, beside);
    // Below the band the column is whole again.
    doc.x = xLeft;
    doc.y = y0 + geometry.bandLines * bodyLine;
    this.renderRuns(doc, tail, resolveFont, fontSize, color, { ...paragraphOptions, width: usableWidth });
  }

  // PDFKit has no table primitive (ADR-0019, finding 4): draw a grid manually, using
  // heightOfString() per cell to grow each row to fit its tallest cell's wrapped text.
  // Matches LayoutEngine's own treatment of a table as one non-splitting unit (ADR-0013) -
  // this does not attempt to split a table across a forced page break.
  //
  // Bug fixed here: a Word table with no distinguishable header row makes ASTBuilder
  // produce headers: [] (confirmed against a real DOCX, not assumed) - a very common
  // real-world shape, not a malformed edge case. `usableWidth / headers.length` then
  // divided by zero (Infinity), which produced NaN positioning the first cell of the
  // first data row and crashed PDFKit's rect() call with "unsupported number: NaN"
  // (HTTP 500 on every such export). Column count now falls back to the first data
  // row's width when there are no headers, and a genuinely empty table (no headers,
  // no rows) is skipped entirely rather than dividing by zero.
  private renderTable(doc: PDFKit.PDFDocument, headers: string[], rows: (string | null)[][], theme: Theme, fontSize: number): void {
    const columnCount = headers.length > 0 ? headers.length : (rows[0]?.length ?? 0);
    if (columnCount === 0) return;

    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = usableWidth / columnCount;
    const cellPad = 4;
    const startX = doc.x;

    const rowHeight = (cells: string[]): number =>
      Math.max(...cells.map((text) => doc.heightOfString(text, { width: colWidth - cellPad * 2 }))) + cellPad * 2;

    const drawRow = (cells: string[], bold: boolean): void => {
      if (cells.length === 0) return;
      const h = rowHeight(cells);
      const y = doc.y;
      doc.font(this.fonts.resolveBody(theme, bold, false)).fontSize(Math.max(8, fontSize - 1));
      cells.forEach((text, i) => {
        const x = startX + i * colWidth;
        doc.rect(x, y, colWidth, h).stroke();
        doc.text(text, x + cellPad, y + cellPad, { width: colWidth - cellPad * 2 });
      });
      doc.y = y + h;
    };

    if (headers.length > 0) drawRow(headers, true);
    for (const row of rows) drawRow(row.map((cell) => cell ?? ''), false);
    doc.moveDown();
  }
}
