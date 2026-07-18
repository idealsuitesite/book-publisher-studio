import PDFDocument from 'pdfkit';
import type { Renderer, RenderContext } from '../../domain/ports/Renderer';
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

// Simple v1 drop-cap approximation: render the paragraph's first character at a larger
// size inline, with no text wrap-around (a real drop cap needs line-aware layout, which
// this heuristic renderer does not do - matches the "best-effort, not authoritative"
// framing already established for pagination, ADR-0013). Documented simplification, not
// a silent gap.
const DROP_CAP_SCALE = 2.5;

/** Resolves which registered font to use for a run, given its bold/italic flags. */
type FontResolver = (bold: boolean, italic: boolean) => string;

// A real-PDFKit-page-index's owner: a domain Page (render its title/header/footer normally),
// the literal string 'blank' (an intentionally blank page from Chapter.openingPageStyle - draw
// nothing at all on it, matching real print convention), or undefined (pagination-estimate
// drift, ADR-0013/ADR-0019 finding 6C - PDFKit auto-paginated internally beyond what
// LayoutEngine estimated, so there's no reliable title, but the page number still falls back to
// the physical index rather than showing nothing).
type PageOwner = Page | 'blank' | undefined;

export class PDFRenderer implements Renderer<Buffer> {
  // compress defaults to true for real output; tests pass false so the content stream stays
  // plain text and its rendered text can be extracted for assertions (see
  // test-utils/extractPdfText.ts - PDFKit encodes text as hex-string TJ/Tj operands, not the
  // literal-string runs a format like DOCX's XML would have, so a compressed stream can't be
  // grepped for content at all).
  private fonts = new PdfFontRegistry();

  constructor(private options: { compress?: boolean } = {}) {}

  async render(book: PaginatedBook, context: RenderContext): Promise<Buffer> {
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
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));

      // Maps a page-starting block's id to the domain Page it starts (blankPagesBefore, for
      // Chapter.openingPageStyle, is 0/undefined on every page except a chapter start -
      // LayoutEngine only computes it there).
      const pageStarts = new Map<string, Page>();
      for (const page of book.pages.slice(1)) {
        const firstId = page.blocks[0];
        if (firstId) pageStarts.set(firstId, page);
      }

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
        doc.addPage();
      }

      if (frontMatter.copyrightPage) {
        this.renderCopyrightPage(doc, frontMatter.copyrightPage, book.styledBook.theme);
        pageOwners.push('blank');
        doc.addPage();
      }

      if (book.tableOfContents && book.tableOfContents.length > 0) {
        this.renderTableOfContents(doc, book.tableOfContents, book.styledBook.theme);
        pageOwners.push('blank');
        doc.addPage();
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
        true
      );

      this.drawHeadersAndFooters(doc, book, pageOwners);

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
  private drawHeadersAndFooters(doc: PDFKit.PDFDocument, book: PaginatedBook, pageOwners: PageOwner[]): void {
    const runningHead = book.styledBook.theme.runningHead;
    const range = doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i++) {
      const owner = pageOwners[i];
      if (owner === 'blank') continue;

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
          const displayNumber = owner?.number ?? i + 1;
          doc.font(this.fonts.resolveDefault(false, false)).fontSize(runningHead.size ?? 9).fillColor('#000');
          doc.text(`Page ${displayNumber} of ${range.count}`, margins.left, height - 50, {
            width: contentWidth,
            align: 'center',
            lineBreak: false,
          });
        }
      }

      doc.page.margins.bottom = savedBottom;
    }
  }

  private renderContent(
    doc: PDFKit.PDFDocument,
    contents: Content[],
    theme: Theme,
    blockStyles: Record<string, ResolvedBlockStyle>,
    blockTypography: Record<string, ResolvedTypography> | undefined,
    pageStarts: Map<string, Page>,
    pageOwners: PageOwner[],
    isTopLevel: boolean
  ): void {
    for (const content of contents) {
      const firstBlockId = content.content[0]?.id;
      const ownerPage = isTopLevel && content.type === 'chapter' && firstBlockId !== undefined ? pageStarts.get(firstBlockId) : undefined;
      if (ownerPage && firstBlockId) pageStarts.delete(firstBlockId);

      // Blank pages (Chapter.openingPageStyle) are genuinely empty physical pages - each
      // addPage() here is immediately followed by another with nothing drawn in between,
      // then the real content page below starts normally.
      for (let i = 0; i < (ownerPage?.blankPagesBefore ?? 0); i++) {
        doc.addPage();
        pageOwners.push('blank');
      }
      if (ownerPage) {
        doc.addPage();
        pageOwners.push(ownerPage);
      }
      this.renderTitle(doc, content, theme);

      for (const block of content.content) {
        this.renderBlock(doc, block, theme, blockStyles[block.id], blockTypography, pageStarts, pageOwners);
      }

      if (content.type === 'chapter' && content.sections) {
        this.renderContent(doc, content.sections, theme, blockStyles, blockTypography, pageStarts, pageOwners, false);
      } else if (content.type === 'section' && content.subsections) {
        this.renderContent(doc, content.subsections, theme, blockStyles, blockTypography, pageStarts, pageOwners, false);
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

    doc.font(this.fonts.resolveBody(theme, false, false)).fontSize(14).fillColor('#000');
    doc.text(page.author, doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 80, {
      width: usableWidth,
      align: 'center',
    });
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
    const level = content.type === 'chapter' ? 1 : content.level;
    const size = content.type === 'chapter' ? 24 : Math.max(12, 22 - content.level * 2);
    // Chapter/section titles are conceptually headings, so they now resolve through the
    // same heading role as Heading blocks (Sprint 4 commit 7 amendment) - previously they
    // used the generic "default" chrome font, a real inconsistency with Heading blocks
    // rendering in the theme's actual heading family.
    doc.font(this.fonts.resolveHeading(level, theme, true, false)).fontSize(size).fillColor('#000').text(content.title);
    doc.moveDown();
  }

  private renderBlock(
    doc: PDFKit.PDFDocument,
    block: Block,
    theme: Theme,
    style: ResolvedBlockStyle | undefined,
    blockTypography: Record<string, ResolvedTypography> | undefined,
    pageStarts: Map<string, Page>,
    pageOwners: PageOwner[]
  ): void {
    const ownerPage = pageStarts.get(block.id);
    if (ownerPage) {
      // Never carries blankPagesBefore - that only applies at a chapter's own opening break,
      // handled in renderContent above. This is an overflow-triggered continuation page.
      doc.addPage();
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
        doc.moveDown(0.5);
        return;
      }

      case 'paragraph': {
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        const dropCap = blockTypography?.[block.id]?.dropCap ?? false;
        const options: PDFKit.Mixins.TextOptions = { align: block.align === 'justify' ? 'justify' : (block.align ?? 'left') };
        if (dropCap) {
          this.renderRunsWithDropCap(doc, runs, resolveBody, fontSize, color, options);
        } else {
          this.renderRuns(doc, runs, resolveBody, fontSize, color, options);
        }
        doc.moveDown(spaceAfter / fontSize);
        return;
      }

      case 'quote':
      case 'scripture': {
        // Italics are already forced onto every run by TypographyResolver
        // (design review §4 item 9) - no block-level italic override needed here anymore.
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        this.renderRuns(doc, runs, resolveBody, fontSize, color, { indent: 36 });
        doc.moveDown(spaceAfter / fontSize);
        return;
      }

      case 'list':
        block.items.forEach((item, index) => {
          const prefix = block.ordered ? `${index + 1}. ` : '• ';
          const itemRuns = runsOrPlainFallback(blockTypography?.[listItemTypographyKey(block.id, index)], item);
          this.renderRuns(doc, itemRuns, resolveBody, fontSize, color, { indent: 18 }, prefix);
        });
        doc.moveDown(spaceAfter / fontSize);
        return;

      case 'table':
        this.renderTable(doc, block.headers, block.rows, theme, fontSize);
        return;

      case 'footnote': {
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.content);
        this.renderRuns(doc, runs, resolveBody, Math.max(7, fontSize - 2), color, {}, `[${block.number}] `);
        return;
      }

      case 'image':
        if (block.base64) {
          doc.image(Buffer.from(block.base64, 'base64'), {
            fit: [doc.page.width - doc.page.margins.left - doc.page.margins.right, block.height ?? 300],
          });
        } else {
          // No embedded data - never fetch remote URLs at render time (no hidden network I/O
          // in a renderer, same rule DOCXRenderer follows). Falls back to a text placeholder.
          doc.font(this.fonts.resolveBody(theme, false, true)).fontSize(fontSize).text(`[Image: ${block.caption ?? block.url}]`);
        }
        doc.moveDown(0.5);
        return;

      case 'page-break':
        doc.addPage();
        return;

      case 'divider':
        doc.font(this.fonts.resolveBody(theme, false, false)).fontSize(fontSize).fillColor(color).text('* * *', { align: 'center' });
        doc.moveDown(0.5);
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

  // Drop-cap v1 approximation (see DROP_CAP_SCALE above): splits the first character off
  // the paragraph's very first run and renders it at a larger size, inline, before the
  // rest of the paragraph's runs render normally via renderRuns().
  private renderRunsWithDropCap(
    doc: PDFKit.PDFDocument,
    runs: TypeRun[],
    resolveFont: FontResolver,
    fontSize: number,
    color: string,
    paragraphOptions: PDFKit.Mixins.TextOptions
  ): void {
    const [firstRun, ...restRuns] = runs;
    if (!firstRun || firstRun.text.length === 0) {
      this.renderRuns(doc, runs, resolveFont, fontSize, color, paragraphOptions);
      return;
    }

    const dropCapChar = firstRun.text[0];
    const remainderOfFirstRun = firstRun.text.slice(1);
    const remainingRuns: TypeRun[] = remainderOfFirstRun ? [{ ...firstRun, text: remainderOfFirstRun }, ...restRuns] : restRuns;

    doc.font(resolveFont(true, firstRun.italic)).fontSize(fontSize * DROP_CAP_SCALE).fillColor(color);
    doc.text(dropCapChar, { ...paragraphOptions, continued: remainingRuns.length > 0 });

    if (remainingRuns.length > 0) {
      this.renderRuns(doc, remainingRuns, resolveFont, fontSize, color, {});
    }
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
