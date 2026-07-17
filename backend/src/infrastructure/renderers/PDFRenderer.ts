import PDFDocument from 'pdfkit';
import type { Renderer, RenderContext } from '../../domain/ports/Renderer';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { ResolvedBlockStyle, Theme } from '../../domain/models/Theme';
import type { ResolvedTypography, TypeRun } from '../../domain/models/ResolvedTypography';
import type { Content, Block, Chapter, Section } from '../../domain/models/Book';
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

      const pageStartBlockIds = new Set(
        book.pages.slice(1).map((page) => page.blocks[0]).filter((id): id is string => Boolean(id))
      );

      this.renderContent(
        doc,
        book.styledBook.book.mainContent,
        book.styledBook.theme,
        book.styledBook.blockStyles,
        book.styledBook.blockTypography,
        pageStartBlockIds,
        true
      );

      this.drawHeadersAndFooters(doc, book);

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
  private drawHeadersAndFooters(doc: PDFKit.PDFDocument, book: PaginatedBook): void {
    const runningHead = book.styledBook.theme.runningHead;
    const range = doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const { width, height, margins } = doc.page;
      const contentWidth = width - margins.left - margins.right;
      const savedBottom = margins.bottom;
      doc.page.margins.bottom = 0;

      if (runningHead?.show) {
        const domainPage = book.pages[Math.min(i, book.pages.length - 1)];
        const title = domainPage?.headerFooterTitle;
        if (title) {
          const text = runningHead.uppercase ? title.toUpperCase() : title;
          const align = runningHead.position === 'left' ? 'left' : 'right';
          doc.font(this.fonts.resolveDefault(false, false)).fontSize(runningHead.size ?? 9).fillColor('#000');
          doc.text(text, margins.left, 40, { width: contentWidth, align, lineBreak: false });
        }

        if (runningHead.pageNumber) {
          doc.font(this.fonts.resolveDefault(false, false)).fontSize(runningHead.size ?? 9).fillColor('#000');
          doc.text(`Page ${i + 1} of ${range.count}`, margins.left, height - 50, {
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
    pageStartBlockIds: Set<string>,
    isTopLevel: boolean
  ): void {
    for (const content of contents) {
      const firstBlockId = content.content[0]?.id;
      const breaksPage = isTopLevel && content.type === 'chapter' && firstBlockId !== undefined && pageStartBlockIds.has(firstBlockId);
      if (breaksPage && firstBlockId) pageStartBlockIds.delete(firstBlockId);

      if (breaksPage) doc.addPage();
      this.renderTitle(doc, content, theme);

      for (const block of content.content) {
        this.renderBlock(doc, block, theme, blockStyles[block.id], blockTypography, pageStartBlockIds);
      }

      if (content.type === 'chapter' && content.sections) {
        this.renderContent(doc, content.sections, theme, blockStyles, blockTypography, pageStartBlockIds, false);
      } else if (content.type === 'section' && content.subsections) {
        this.renderContent(doc, content.subsections, theme, blockStyles, blockTypography, pageStartBlockIds, false);
      }
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
    pageStartBlockIds: Set<string>
  ): void {
    if (pageStartBlockIds.has(block.id)) {
      doc.addPage();
      pageStartBlockIds.delete(block.id);
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
