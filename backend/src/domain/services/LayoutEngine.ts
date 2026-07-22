import type { StyledBook } from '../models/Theme';
import { dropCapGeometry, dropCapScaleOf } from './dropCapMetrics';
import { CALLOUT_PAD_V_PT, calloutTextIndentPt } from './calloutMetrics';
import { CHAPTER_SUBTITLE_RATIO } from './titleMetrics';
import type { PageLayout } from '../models/PageLayout';
import type { Page, PaginatedBook } from '../models/PaginatedBook';
import type { Content, Block, TOCEntry } from '../models/Book';
import { renderedImageSize } from './renderedImageSize';
import { countWords } from '../../shared/utils/textMetrics';
import type { TextMeasurer } from '../ports/TextMeasurer';

const WORDS_PER_LINE = 12;
const DEFAULT_IMAGE_HEIGHT = 200;

// Standard print-publishing convention (not guessed): recto/right-hand pages are
// odd-numbered, verso/left-hand pages are even-numbered, page 1 always being a right page.
function blankPagesNeededFor(style: 'right' | 'left' | 'any' | undefined, nextPageNumber: number): number {
  const isOdd = nextPageNumber % 2 === 1;
  if (style === 'right' && !isOdd) return 1;
  if (style === 'left' && isOdd) return 1;
  return 0;
}

export class LayoutEngine {
  /**
   * With a `TextMeasurer`, pagination *measures* block heights with the renderer's own fonts
   * and line heights (LAYOUT_FIDELITY.md Decision 6). Without one, the historical word-count
   * estimate applies — kept as the no-dependency fallback, with its measured defect on record:
   * it overcharges ~1.43× (§2bis), which capped real pages at ~71% fill because PDFRenderer
   * enforces these breaks on real text.
   */
  constructor(private readonly measurer?: TextMeasurer) {}

  paginate(styled: StyledBook, layout: PageLayout): PaginatedBook {
    // Measured pagination packs pages against this budget EXACTLY — and the renderer's real
    // consumption carries ±0.5pt/block of irreducible noise (justified wrapping, run-segmented
    // text() calls vs one measured string). Packing to the last point turned that noise into
    // silent PDFKit overflow breaks on ~5% of pages (RENDER_DRIFT.md follow-up trace: pages
    // planned to 501.0 of 504.0). The half-line reserve absorbs the noise class; genuinely
    // mismeasured blocks (e.g. bold-run wrapping, a full line off) remain and are surfaced by
    // the renderer's observable reconciliation (ADR-0051), never hidden by a bigger margin.
    // Only the measured path pays it: the fallback estimator's error dwarfs any tolerance.
    const PAGE_SAFETY_PT = 7;
    const usableHeight =
      layout.height - layout.marginTop - layout.marginBottom - (this.measurer ? PAGE_SAFETY_PT : 0);
    const usableWidth = layout.width - layout.marginLeft - layout.marginRight;
    const pages: Page[] = [];
    let currentPageBlocks: string[] = [];
    let currentPageHeights: number[] = [];
    let currentHeight = 0;
    let pageNumber = 1;
    // Whichever top-level Chapter/Section's blocks are being added when a page is flushed -
    // the only piece of running-head resolution only LayoutEngine can compute (see
    // Page.headerFooterTitle's doc comment). Chapters always start a new page (existing rule
    // below), so in practice this is exact for chapter-content pages; top-level Sections can
    // share a page, matching this pipeline's existing "best-effort, not guaranteed" pagination
    // philosophy (ADR-0013).
    let currentTopLevelTitle: string | undefined;
    // Set right before the chapter's first block is added (after any blank pages this
    // chapter needed have already had their own numbers reserved) - consumed and reset by
    // the next flushPage(), which will be this chapter's own first page. Blank pages
    // themselves are never given their own Page entry (no content, no running head/footer
    // makes sense for them) - just a count the renderer inserts extra doc.addPage() calls
    // for immediately before breaking to this page's first block.
    let pendingBlankPagesBefore = 0;

    const resolveHeaderFooterTitle = (): string | undefined => {
      const runningHead = styled.theme.runningHead;
      if (!runningHead?.show) return undefined;
      return runningHead.content === 'bookTitle' ? styled.book.metadata.title : currentTopLevelTitle;
    };

    // Phase B split bookkeeping (LAYOUT_FIDELITY.md Decision 7). `splitLinesForCurrentPage`
    // belongs to the page being closed; `currentPageContinues` to the page being opened.
    let splitLinesForCurrentPage: number | undefined;
    let currentPageContinues = false;

    const flushPage = (): void => {
      if (currentPageBlocks.length === 0) return;
      pages.push({
        number: pageNumber,
        blocks: currentPageBlocks,
        headerFooterTitle: resolveHeaderFooterTitle(),
        blankPagesBefore: pendingBlankPagesBefore || undefined,
        splitAfterLines: splitLinesForCurrentPage,
        startsWithContinuation: currentPageContinues || undefined,
      });
      pendingBlankPagesBefore = 0;
      splitLinesForCurrentPage = undefined;
      currentPageContinues = false;
      pageNumber += 1;
      currentPageBlocks = [];
      currentPageHeights = [];
      currentHeight = 0;
    };

    // Ends the current page on overflow. If its last block asked to stay with what
    // follows (StyledBook.blockTypography[...].staysWithNext - currently set for
    // Heading blocks only, design review §4 item 6/9's "widow/orphan avoidance"),
    // that last block is carried onto the new page too instead of being left alone
    // at the bottom of the closing one. Best-effort nudge (ADR-0013), not a
    // guarantee, and only looks at the single block immediately before the break -
    // this pagination model never splits a block's own content across pages, so
    // there is no line-level widow/orphan to detect, only this block-level one.
    const breakPageKeepingLastBlockTogether = (): void => {
      const lastId = currentPageBlocks[currentPageBlocks.length - 1];
      const staysWithNext = lastId !== undefined && (styled.blockTypography?.[lastId]?.staysWithNext ?? false);

      if (staysWithNext && currentPageBlocks.length > 1) {
        const carriedId = currentPageBlocks.pop() as string;
        const carriedHeight = currentPageHeights.pop() as number;
        flushPage();
        currentPageBlocks = [carriedId];
        currentPageHeights = [carriedHeight];
        currentHeight = carriedHeight;
      } else {
        flushPage();
      }
    };

    // The renderer draws a chapter/section title (renderTitle: 24pt for chapters,
    // max(12, 22 - 2·level) for sections, then a full moveDown) before the content blocks.
    // Until Decision 6 this cost was booked at ZERO, which is half of the CTO's
    // title-above-a-void observation — the model believed the page under a title was taller
    // than it really was. Only chargeable when a measurer exists: the fallback estimator has
    // no line-height source for heading sizes and inventing one would be a new guess.
    const titleHeightOf = (content: Content): number => {
      if (!this.measurer || !content.title) return 0;
      const size = content.type === 'chapter' ? 24 : Math.max(12, 22 - content.level * 2);
      const { titleSpaceBefore, titleSpaceAfter } = styled.theme.spacing;
      // A chapter's subtitle (MINI_DR_SUBTITLE_FIELD §4) is charged INSIDE the same expression
      // renderTitle spends — italic at the shared ratio of the title size, measured with the
      // heading face (the italic wrap-width delta is the standing ±1-line residual class,
      // disclosed). Sections carry no subtitle field.
      const subtitleHeight =
        content.type === 'chapter' && content.subtitle
          ? this.measurer.measureHeight(content.subtitle, {
              fontSize: size * CHAPTER_SUBTITLE_RATIO,
              width: usableWidth,
              heading: true,
              theme: styled.theme,
            })
          : 0;
      return (
        subtitleHeight +
        // Lock-step with PDFRenderer.renderTitle (MINI_DR_SUBTITLE_SPACING): flat titleSpaceBefore
        // above + the measured title height + flat titleSpaceAfter below. Replaces the former
        // `+ lineHeight(size)` term, which charged renderTitle's old size-scaled moveDown(). The
        // two must move together, else charged != consumed and pagination drifts (ADR-0051).
        titleSpaceBefore +
        this.measurer.measureHeight(content.title, {
          fontSize: size,
          width: usableWidth,
          heading: true,
          theme: styled.theme,
        }) +
        titleSpaceAfter
      );
    };

    /**
     * Keep-with-next for titles (RENDER_DRIFT follow-up, ADR-0051): a title whose content
     * cannot start under it moves WITH its content to the next page. Before this rule, the
     * title's charge landed on the closing page while its first block flushed to the next —
     * so the renderer drew a 40-90pt title into a page-bottom the model had already spent,
     * and PDFKit broke the page on its own initiative (10 of the 13 residual silent breaks).
     * The invariant the renderer relies on: a titled content's first block starts a planned
     * page ⇔ its title starts that page too.
     */
    const flushBeforeTitleIfOrphaned = (content: Content, firstBlock: Block): number => {
      const titleHeight = titleHeightOf(content);
      if (titleHeight === 0 || currentPageBlocks.length === 0) return titleHeight;
      const style = styled.blockStyles[firstBlock.id];
      const fontSize = style?.fontSize ?? styled.theme.fontSizes.body;
      const line = this.measurer!.lineHeight(fontSize, { theme: styled.theme });
      const blockHeight = this.estimateBlockHeight(firstBlock, styled, usableWidth);
      // A block under ~4 lines cannot split (min-2-lines at both ends), so it needs its full
      // height under the title; a longer one only needs a 2-line start.
      const blockLines = Math.max(1, Math.round(blockHeight / line));
      const minStart = blockLines < 4 ? blockHeight : 2 * line;
      if (currentHeight + titleHeight + minStart > usableHeight) flushPage();
      return titleHeight;
    };

    /**
     * Splits a paragraph across pages, line-granular, with min-2-lines at BOTH ends of every
     * break (Phase B, LAYOUT_FIDELITY.md Decision 7). This is the "essai de coupure" step the
     * CTO's investigation found missing: before this, a paragraph one line too tall for the
     * remaining space moved whole, leaving the space empty.
     *
     * The rules, in order:
     *  - remainder fits → place it, done;
     *  - fewer than 2 lines would sit at the bottom (orphan) → no split, fresh page instead;
     *  - a split that would strand fewer than 2 lines on the next page (widow) → cut earlier,
     *    keeping 2 back; if that leaves under 2 at the bottom, again no split.
     * A block long enough may split repeatedly — every intermediate page keeps ≥2 lines.
     */
    const addSplittingText = (block: Block, textHeight: number, spaceAfter: number, line: number): void => {
      let remainingLines = Math.max(1, Math.round(textHeight / line));

      for (;;) {
        const remainingSpace = usableHeight - currentHeight;
        if (remainingLines * line + spaceAfter <= remainingSpace) {
          currentPageBlocks.push(block.id);
          currentPageHeights.push(remainingLines * line + spaceAfter);
          currentHeight += remainingLines * line + spaceAfter;
          return;
        }

        const fits = Math.floor(remainingSpace / line);
        const cut = Math.min(fits, remainingLines - 2);

        if (cut < 2) {
          if (currentPageBlocks.length === 0) {
            // A fresh page that still cannot hold a sane split (pathologically small page or
            // 2-3 line block): place whole, overflow tolerated exactly as before Phase B.
            currentPageBlocks.push(block.id);
            currentPageHeights.push(remainingLines * line + spaceAfter);
            currentHeight += remainingLines * line + spaceAfter;
            return;
          }
          breakPageKeepingLastBlockTogether();
          continue;
        }

        currentPageBlocks.push(block.id);
        currentPageHeights.push(cut * line);
        currentHeight += cut * line;
        splitLinesForCurrentPage = cut;
        flushPage();
        currentPageContinues = true;
        remainingLines -= cut;
      }
    };

    const addBlock = (block: Block, forceNewPage: boolean): void => {
      const blockHeight = this.estimateBlockHeight(block, styled, usableWidth);
      const overflow = currentHeight + blockHeight > usableHeight;

      if (forceNewPage) {
        flushPage();
      } else if (overflow) {
        // Try the cut before surrendering the space (measured mode, plain paragraphs only:
        // quotes/scriptures render with a first-line indent whose continuation semantics
        // differ, a drop-cap paragraph's first lines are typographically special, and a
        // CALLOUT is atomic — its chrome cannot break mid-box (MINI_DR_CALLOUTS §4, the third
        // member of the atomicity family; the loud overflow test ships with this exclusion).
        if (this.measurer && block.type === 'paragraph' && block.text.trim() && block.callout !== true && !styled.blockTypography?.[block.id]?.dropCap) {
          const style = styled.blockStyles[block.id];
          const fontSize = style?.fontSize ?? styled.theme.fontSizes.body;
          const line = this.measurer.lineHeight(fontSize, { theme: styled.theme });
          const textHeight = this.measurer.measureHeight(block.text, {
            fontSize,
            width: usableWidth,
            theme: styled.theme,
          });
          addSplittingText(block, textHeight, style?.spaceAfter ?? 8, line);
          return;
        }
        if (currentPageBlocks.length > 0) breakPageKeepingLastBlockTogether();
      }

      currentPageBlocks.push(block.id);
      currentPageHeights.push(blockHeight);
      currentHeight += blockHeight;
    };

    // Chapters conventionally start on a new page; sections/subsections flow within their chapter's pages.
    const walkContent = (contents: Content[], isTopLevel: boolean): void => {
      for (const content of contents) {
        // A titled, blockless, childless TOP-LEVEL CHAPTER owns a page of its own — the
        // Part-opener shape (PART_LEVEL_STRUCTURE commit 1). Every renderer draws such a
        // content's title unconditionally, but this walker only flushes pages per block, so the
        // model charged NOTHING for the page the renderer emitted — the exact ADR-0051 drift
        // measured in part-level-geometry-spike.ts (model +0, renderer +3 pages, unplanned
        // 3→6). The page carries the CONTENT's own id — the only id it has — and PDFRenderer's
        // planned-break protocol matches on it (renderContent's startKey). Measured on the whole
        // corpus (empty-shape-probe.ts): no imported book produces this shape, so this branch is
        // unreachable from any real import — byte-identity guarded by the parity locks. A chapter
        // whose text lives under its sections (content: [] but sections present) is NOT this
        // shape and flows exactly as before; a blockless titled top-level SECTION keeps today's
        // in-flow title (the renderer plans no break for it — mirroring that is out of scope
        // here, disclosed in PART_LEVEL_STRUCTURE.md).
        const ownsBarePage =
          isTopLevel &&
          content.type === 'chapter' &&
          Boolean(content.title) &&
          content.content.length === 0 &&
          (content.sections?.length ?? 0) === 0;
        if (ownsBarePage && content.type === 'chapter') {
          // Same protocol as a chapter's opening break below: flush attributing the closing page
          // to the OLD currentTopLevelTitle, then blank-page parity, then the opener's own page.
          flushPage();
          if (content.startPageNumber !== undefined) pageNumber = content.startPageNumber;
          const needed = blankPagesNeededFor(content.openingPageStyle, pageNumber);
          pendingBlankPagesBefore = needed;
          pageNumber += needed;
          currentTopLevelTitle = content.title;
          const titleHeight = titleHeightOf(content);
          currentPageBlocks.push(content.id);
          currentPageHeights.push(titleHeight);
          currentHeight += titleHeight;
          // The opener page holds ONLY its title: flush now so whatever follows starts a fresh
          // planned page (renderBlock/renderContent honour it via pageStarts).
          flushPage();
          continue;
        }
        // MINI_DR_BLOCKLESS_TITLES: any OTHER titled content whose own `content` is empty —
        // a nested or top-level section (with or without children), or a chapter whose text
        // lives entirely under its sections. Every renderer draws such a title, but the block
        // loop below never runs for it, so its height was charged at ZERO — the live ADR-0051
        // drift TYPOGRAPHY_QUALITY_SCOPE §1 measured stranding a real 18pt heading at a page
        // bottom on Modern (model +0 / renderer +~38pt). The page records the content's OWN id
        // (the ownsBarePage precedent above): planned breaks become expressible via the
        // renderers' startKey protocol, and the TOC's existing `content.id` fallback resolves a
        // real page number. An UNTITLED blockless content stays charged at zero — the renderer
        // draws nothing for it, and charging phantom heights would be the inverse drift.
        if (content.title && content.content.length === 0) {
          if (isTopLevel && content.type === 'chapter') {
            // The full chapter-opening protocol (MINI_DR_BLOCKLESS_TITLES D2): this shape —
            // reachable from any import whose chapter heading is immediately followed by a
            // section heading — previously got NO opening break and never claimed the
            // running-head attribution either (its pages kept the previous chapter's name).
            flushPage();
            if (content.startPageNumber !== undefined) pageNumber = content.startPageNumber;
            const needed = blankPagesNeededFor(content.openingPageStyle, pageNumber);
            pendingBlankPagesBefore = needed;
            pageNumber += needed;
          } else {
            // D3 orphan guard — the flushBeforeTitleIfOrphaned floor applied to the shape that
            // has no first block to key on: the title plus a 2-line start must fit, else the
            // break comes BEFORE the title and whatever follows lands under it.
            const titleHeight = titleHeightOf(content);
            if (titleHeight > 0 && currentPageBlocks.length > 0) {
              const line = this.measurer!.lineHeight(styled.theme.fontSizes.body, { theme: styled.theme });
              if (currentHeight + titleHeight + 2 * line > usableHeight) flushPage();
            }
          }
          if (isTopLevel) currentTopLevelTitle = content.title;
          const titleHeight = titleHeightOf(content);
          currentPageBlocks.push(content.id);
          currentPageHeights.push(titleHeight);
          currentHeight += titleHeight;
        }
        const startsChapter = isTopLevel && content.type === 'chapter';
        let isFirstBlock = true;
        for (const block of content.content) {
          const forceNewPage = isFirstBlock && startsChapter;
          // Flush (attributing the closing page to the OLD currentTopLevelTitle) before
          // reassigning - reassigning first would mislabel the page that's closing right now
          // as belonging to the chapter that's only just starting.
          if (forceNewPage) {
            flushPage();
            if (content.type === 'chapter') {
              // startPageNumber is applied before the openingPageStyle parity check, so an
              // explicit odd/even startPageNumber and 'right'/'left' agree without inserting
              // an unwanted blank page. If they genuinely conflict (e.g. an even
              // startPageNumber paired with openingPageStyle:'right'), the blank page still
              // gets inserted and the chapter's actual displayed number ends up one past what
              // startPageNumber requested - a real, disclosed edge case (PROFESSIONAL_LAYOUT_
              // ENGINE.md doesn't specify this interaction), not silently resolved.
              if (content.startPageNumber !== undefined) pageNumber = content.startPageNumber;
              const needed = blankPagesNeededFor(content.openingPageStyle, pageNumber);
              pendingBlankPagesBefore = needed;
              pageNumber += needed;
            }
          }
          if (isTopLevel) currentTopLevelTitle = content.title;
          // The title is drawn (and priced) immediately before this content's first block —
          // after the chapter's own page break, in the flow for sections; kept with its
          // content when the page is nearly spent (flushBeforeTitleIfOrphaned's invariant).
          if (isFirstBlock) {
            // Two statements ON PURPOSE: `currentHeight += f()` reads the LEFT operand BEFORE
            // the call, so the flush inside f() (which zeroes currentHeight) was being
            // overwritten with the pre-flush value — a JS evaluation-order trap that produced
            // a ghost near-full page at every section boundary (found by the calibration
            // spike's fill distribution, of all things).
            const titleHeight = flushBeforeTitleIfOrphaned(content, block);
            currentHeight += titleHeight;
          }
          addBlock(block, false);
          isFirstBlock = false;
        }
        if (content.type === 'chapter' && content.sections) {
          walkContent(content.sections as unknown as Content[], false);
        } else if (content.type === 'section' && content.subsections) {
          walkContent(content.subsections as unknown as Content[], false);
        }
      }
    };
    walkContent(styled.book.mainContent, true);
    flushPage();

    return { styledBook: styled, pages, pageLayout: layout, tableOfContents: this.buildTableOfContents(styled, pages) };
  }

  // Functional Spec item 7: walks headings in document order, post-pagination (so each entry's
  // pageNumber can be resolved), only when Book.frontMatter.toc.generateAutomatically is true -
  // Book is never mutated (ADR-0001), so this never touches a manually-authored
  // frontMatter.toc.entries at all; the two are entirely separate fields. A flat, level-annotated
  // list, not a nested tree - see PaginatedBook.tableOfContents's doc comment for why nesting is
  // deliberately out of scope rather than guessed.
  //
  // Real-file verification finding (Sprint 6 commit 11, fixed here as a direct scope exception -
  // ADR-0019/0020/0026 precedent, not deferred): the design's own wording ("walks all Heading
  // blocks") assumed content-level Heading blocks are how a real book's heading hierarchy shows
  // up. Reading ASTBuilder.ts and testing against a real DOCX (large-book.docx) confirmed
  // otherwise - every real heading in an imported document is structurally consumed into a
  // Chapter/Section boundary (its `title` field), never emitted as a Heading block inside
  // `content[]`. Walking only Heading blocks (the original implementation) produced a
  // *permanently empty TOC on every real import* - a real, would-have-shipped-broken bug, not a
  // hypothetical. Fixed to walk Chapter/Section titles as the primary, real-world path
  // (headingId repurposed to the owning Chapter/Section's own id, since no Heading.id exists to
  // link back to for these); literal Heading blocks are still included too, for hand-built Book
  // models or a future import-pipeline change that starts emitting them.
  private buildTableOfContents(styled: StyledBook, pages: Page[]): TOCEntry[] | undefined {
    const toc = styled.book.frontMatter.toc;
    if (!toc?.generateAutomatically) return undefined;

    const pageNumberByBlockId = new Map<string, number>();
    for (const page of pages) {
      for (const blockId of page.blocks) {
        if (!pageNumberByBlockId.has(blockId)) pageNumberByBlockId.set(blockId, page.number);
      }
    }

    const entries: TOCEntry[] = [];
    const addEntry = (level: number, title: string, headingId: string, firstBlockId: string | undefined): void => {
      if (toc.maxDepth !== undefined && level > toc.maxDepth) return;
      entries.push({ level, title, pageNumber: firstBlockId ? pageNumberByBlockId.get(firstBlockId) : undefined, headingId });
    };

    const walk = (contents: Content[]): void => {
      for (const content of contents) {
        // The primary, real-world case: a Chapter/Section's own title (an untitled preamble
        // Section, ADR-0020 addendum, is skipped - an empty-title entry is never useful).
        if (content.title) {
          const level = content.type === 'chapter' ? 1 : content.level;
          // A blockless titled chapter's page carries the content's own id (ownsBarePage), so the
          // fallback resolves a Part opener's page number; for ordinary content the content id is
          // never on a page and the fallback misses exactly as the old undefined did.
          addEntry(level, content.title, content.id, content.content[0]?.id ?? content.id);
        }
        for (const block of content.content) {
          // The synthetic/future case: a literal Heading block genuinely present in content.
          if (block.type === 'heading') {
            addEntry(block.level, block.text, block.id, block.id);
          }
        }
        if (content.type === 'chapter' && content.sections) {
          walk(content.sections as unknown as Content[]);
        } else if (content.type === 'section' && content.subsections) {
          walk(content.subsections as unknown as Content[]);
        }
      }
    };
    walk(styled.book.mainContent);
    return entries;
  }

  /**
   * Height of a paragraph that opens with a drop cap, priced the way `PDFRenderer` really draws
   * it: `bandLines` lines running beside the glyph in a narrowed column, then the remainder at
   * full width below. Never shorter than the glyph's own ink, since nothing may start inside it.
   *
   * Mirrors the renderer step for step ON PURPOSE — same `dropCapGeometry`, same budget, same
   * word-boundary cut. Any cleverness that made the two differ would recreate exactly the
   * charged-vs-consumed disagreement this whole chantier exists to close.
   */
  private priceDropCapParagraph(
    text: string,
    styled: StyledBook,
    usableWidth: number,
    fontSize: number,
    spaceAfter: number,
    bodyLine: number
  ): number {
    const measurer = this.measurer!;
    const theme = styled.theme;
    const plain = (t: string, width: number): number =>
      measurer.measureHeight(t, { fontSize, width, theme }) + spaceAfter;

    // Theme-declared scale, same helper the renderers read (§6 commit 2) — the model prices at
    // the value the renderer will really draw with, whatever the theme declares.
    const dropSize = fontSize * dropCapScaleOf(theme);
    let geometry;
    try {
      geometry = dropCapGeometry({
        fontSize,
        usableWidth,
        glyphWidth: measurer.measureWidth(text[0], { fontSize: dropSize, heading: true, theme }),
        capPt: measurer.capHeight(dropSize, { theme, heading: true }),
        bodyLine,
      });
    } catch {
      // The font-metric guard refused. The renderer degrades this paragraph to ordinary text and
      // counts it (RenderMetrics.degradedDropCaps) — so the model must price the SAME ordinary
      // paragraph. Both consult the same metric and reach the same verdict; if they did not, the
      // degradation would itself open the charged-vs-consumed gap it is meant to avoid.
      return plain(text, usableWidth);
    }

    const remainder = text.slice(1);
    if (!remainder.trim()) return Math.max(geometry.capPt, bodyLine) + spaceAfter;

    // Does ALL of it fit beside the glyph? Asked directly and FIRST, mirroring the renderer: the
    // word-boundary search below always leaves a word past the cut, so it can never answer this.
    const budget = geometry.bandLines * bodyLine + 0.5; // float-noise epsilon, matching the renderer
    if (measurer.measureHeight(remainder, { fontSize, width: geometry.narrowWidth, theme }) <= budget) {
      return Math.max(plain(remainder, geometry.narrowWidth), geometry.capPt + spaceAfter);
    }

    // Otherwise: the largest word-boundary prefix that really fits the band at the narrowed column.
    const wordEnds: number[] = [];
    for (const match of remainder.matchAll(/\S+/g)) wordEnds.push(match.index + match[0].length);

    let cutAt = 0;
    let lo = 1;
    let hi = wordEnds.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const height = measurer.measureHeight(remainder.slice(0, wordEnds[mid - 1]), {
        fontSize,
        width: geometry.narrowWidth,
        theme,
      });
      if (height <= budget) {
        cutAt = wordEnds[mid - 1];
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (cutAt <= 0 || cutAt >= remainder.length) {
      // Everything sits beside the glyph — but never shorter than the glyph inks.
      return Math.max(plain(remainder, geometry.narrowWidth), geometry.capPt + spaceAfter);
    }
    return geometry.bandLines * bodyLine + plain(remainder.slice(cutAt).replace(/^\s+/, ''), usableWidth);
  }

  private estimateBlockHeight(block: Block, styled: StyledBook, usableWidth: number): number {
    const style = styled.blockStyles[block.id];
    const fontSize = style?.fontSize ?? styled.theme.fontSizes.body;

    // Decision 6: measured heights when a TextMeasurer is wired. Real font, real glyph widths,
    // natural line height — the renderer's own numbers — plus the spaceAfter the renderer adds
    // after every block (moveDown(spaceAfter/fontSize)), which the estimate never modelled.
    if (this.measurer) {
      const spaceAfter = style?.spaceAfter ?? 8;
      const measure = (text: string, heading = false): number =>
        this.measurer!.measureHeight(text, { fontSize, width: usableWidth, heading, theme: styled.theme }) +
        spaceAfter;
      const line = this.measurer.lineHeight(fontSize, { theme: styled.theme });

      switch (block.type) {
        case 'heading':
          return measure(block.text, true);
        case 'paragraph': {
          // A callout's chrome consumes real height: vertical padding above and below, and a
          // text column narrowed by the rule + gap (MINI_DR_CALLOUTS §4 — the SAME calloutMetrics
          // constants the renderer spends, lock-step; the subtitle-spacing pattern). A callout
          // never carries the drop-cap path: the resolver decides that exclusion once, upstream.
          if (block.callout === true) {
            return (
              CALLOUT_PAD_V_PT * 2 +
              this.measurer.measureHeight(block.text, {
                fontSize,
                width: usableWidth - calloutTextIndentPt(),
                theme: styled.theme,
              }) +
              spaceAfter
            );
          }
          // A drop cap makes the paragraph's first lines wrap in a NARROWED column, beside the
          // glyph (DROPCAP_TEXT_OVERLAP). Charging it at full width under-charges by exactly the
          // lines the narrowing pushes down — the charged-vs-consumed class RENDER_DRIFT closed.
          // The geometry is computed by the SAME domain function the renderer uses, on the same
          // measured inputs, so model and renderer cannot disagree about it.
          if (styled.blockTypography?.[block.id]?.dropCap && block.text.trim()) {
            return this.priceDropCapParagraph(block.text, styled, usableWidth, fontSize, spaceAfter, line);
          }
          return measure(block.text);
        }
        case 'quote':
        case 'scripture':
          return measure(block.text);
        case 'list':
          // Each item renders WITH its bullet/number prefix ('• ' / 'N. '), which the old
          // join omitted — so a near-boundary item wrapped one line further at draw time than
          // at measure time, a systematic under-charge that made atomic lists overflow into
          // silent reconciliation pages (LIST_PAGINATION_DRIFT.md, the list analogue of
          // RENDER_DRIFT fix 1: charge what the renderer spends). PDFKit's per-item indent
          // shifts only the first line, so the wrap width stays the full column — measure at
          // usableWidth, prefixes included, still joined by newline (each item is its own line).
          return measure(
            block.items.map((item, i) => (block.ordered ? `${i + 1}. ` : '• ') + item).join('\n')
          );
        case 'table':
          return (1 + block.rows.length) * line + spaceAfter;
        case 'footnote':
          return line + spaceAfter;
        case 'image': {
          // R2 (BOOK_PRESENTATION.md): priced from REAL probed dimensions via the same
          // formula the renderers draw with — never a guessed constant when truth exists.
          const size = renderedImageSize(block, usableWidth);
          return (size ? size.height : (block.height ?? DEFAULT_IMAGE_HEIGHT)) + spaceAfter;
        }
        case 'page-break':
        case 'divider':
          return line;
        default: {
          const _exhaustive: never = block;
          throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
        }
      }
    }

    // Historical no-measurer fallback. Its defect is measured and on record (LAYOUT_FIDELITY.md
    // §2bis: ~1.43× overcharge → ~71% page fill): kept only so the engine works standalone.
    const linePoints = fontSize * styled.theme.spacing.lineHeight;

    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
      case 'scripture':
        return Math.max(1, Math.ceil(countWords(block.text) / WORDS_PER_LINE)) * linePoints;
      case 'list':
        return Math.max(1, block.items.length) * linePoints;
      case 'table':
        return (1 + block.rows.length) * linePoints;
      case 'footnote':
        return linePoints;
      case 'image': {
        const size = renderedImageSize(block, usableWidth);
        return size ? size.height : (block.height ?? DEFAULT_IMAGE_HEIGHT);
      }
      case 'page-break':
      case 'divider':
        // Not yet produced by ASTBuilder (same scope decision already made for BlockMapper/BlockDTO
        // in Phase 2) - minimal placeholder height until something actually generates these.
        return linePoints;
      default: {
        const _exhaustive: never = block;
        throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
