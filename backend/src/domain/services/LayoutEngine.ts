import type { StyledBook } from '../models/Theme';
import type { PageLayout } from '../models/PageLayout';
import type { Page, PaginatedBook } from '../models/PaginatedBook';
import type { Content, Block, TOCEntry } from '../models/Book';
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
      return (
        this.measurer.measureHeight(content.title, {
          fontSize: size,
          width: usableWidth,
          heading: true,
          theme: styled.theme,
        }) + this.measurer.lineHeight(size, { theme: styled.theme, heading: true }) // renderTitle's moveDown(), in the face it really uses
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
        // differ, and a drop-cap paragraph's first lines are typographically special).
        if (this.measurer && block.type === 'paragraph' && block.text.trim() && !styled.blockTypography?.[block.id]?.dropCap) {
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
          if (isFirstBlock) currentHeight += flushBeforeTitleIfOrphaned(content, block);
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
          addEntry(level, content.title, content.id, content.content[0]?.id);
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
        case 'paragraph':
        case 'quote':
        case 'scripture':
          return measure(block.text);
        case 'list':
          // Items render as separate lines; measuring them joined by newlines matches the
          // renderer's per-item text calls to within wrapping.
          return measure(block.items.join('\n'));
        case 'table':
          return (1 + block.rows.length) * line + spaceAfter;
        case 'footnote':
          return line + spaceAfter;
        case 'image':
          return (block.height ?? DEFAULT_IMAGE_HEIGHT) + spaceAfter;
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
      case 'image':
        return block.height ?? DEFAULT_IMAGE_HEIGHT;
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
