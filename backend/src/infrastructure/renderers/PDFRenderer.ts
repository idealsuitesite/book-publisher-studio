import PDFDocument from 'pdfkit';
import type { Renderer, RenderContext } from '../../domain/ports/Renderer';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { ResolvedBlockStyle } from '../../domain/models/Theme';
import type { Content, Block, Chapter, Section } from '../../domain/models/Book';

const PAGE_SIZE: PDFKit.PDFDocumentOptions['size'] = 'LETTER';
const MARGIN = 72;

// PDFKit ships only the 14 standard PDF fonts (Helvetica/Times/Courier + variants) - no
// theme font (e.g. Georgia) actually exists as embeddable glyph data yet (ADR-0019, finding 1;
// a real font asset to ship is an open TODO). Until then, map theme font family names onto the
// closest standard family by name heuristic, matching bold/italic combinations PDFKit ships.
const SERIF_PATTERN = /times|georgia|serif|garamond|palatino|cambria|book antiqua|minion/i;
const MONO_PATTERN = /courier|mono|consolas/i;

function resolveFont(fontFamily: string, bold: boolean, italic: boolean): string {
  if (MONO_PATTERN.test(fontFamily)) {
    if (bold && italic) return 'Courier-BoldOblique';
    if (bold) return 'Courier-Bold';
    if (italic) return 'Courier-Oblique';
    return 'Courier';
  }
  if (SERIF_PATTERN.test(fontFamily)) {
    if (bold && italic) return 'Times-BoldItalic';
    if (bold) return 'Times-Bold';
    if (italic) return 'Times-Italic';
    return 'Times-Roman';
  }
  if (bold && italic) return 'Helvetica-BoldOblique';
  if (bold) return 'Helvetica-Bold';
  if (italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

export class PDFRenderer implements Renderer<Buffer> {
  // compress defaults to true for real output; tests pass false so the content stream stays
  // plain text and its rendered text can be extracted for assertions (see
  // test-utils/extractPdfText.ts - PDFKit encodes text as hex-string TJ/Tj operands, not the
  // literal-string runs a format like DOCX's XML would have, so a compressed stream can't be
  // grepped for content at all).
  constructor(private options: { compress?: boolean } = {}) {}

  async render(book: PaginatedBook, context: RenderContext): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // bufferPages defers writing pages to the output stream until flushed - see
      // drawHeadersAndFooters() below for why this is the right approach here.
      const doc = new PDFDocument({
        size: PAGE_SIZE,
        margin: MARGIN,
        bufferPages: true,
        compress: this.options.compress ?? true,
        info: {
          ...(context.metadata?.title ? { Title: context.metadata.title } : {}),
          ...(context.metadata?.author ? { Author: context.metadata.author } : {}),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));

      const pageStartBlockIds = new Set(
        book.pages.slice(1).map((page) => page.blocks[0]).filter((id): id is string => Boolean(id))
      );

      this.renderContent(doc, book.styledBook.book.mainContent, book.styledBook.blockStyles, pageStartBlockIds, true);

      this.drawHeadersAndFooters(doc);

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
  private drawHeadersAndFooters(doc: PDFKit.PDFDocument): void {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const { width, height } = doc.page;
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(9).fillColor('#000');
      doc.text('Book Publisher Studio', MARGIN, 40, { width: width - MARGIN * 2, align: 'left', lineBreak: false });
      doc.text(`Page ${i + 1} of ${range.count}`, MARGIN, height - 50, {
        width: width - MARGIN * 2,
        align: 'center',
        lineBreak: false,
      });
      doc.page.margins.bottom = savedBottom;
    }
  }

  private renderContent(
    doc: PDFKit.PDFDocument,
    contents: Content[],
    blockStyles: Record<string, ResolvedBlockStyle>,
    pageStartBlockIds: Set<string>,
    isTopLevel: boolean
  ): void {
    for (const content of contents) {
      const firstBlockId = content.content[0]?.id;
      const breaksPage = isTopLevel && content.type === 'chapter' && firstBlockId !== undefined && pageStartBlockIds.has(firstBlockId);
      if (breaksPage && firstBlockId) pageStartBlockIds.delete(firstBlockId);

      if (breaksPage) doc.addPage();
      this.renderTitle(doc, content);

      for (const block of content.content) {
        this.renderBlock(doc, block, blockStyles[block.id], pageStartBlockIds);
      }

      if (content.type === 'chapter' && content.sections) {
        this.renderContent(doc, content.sections, blockStyles, pageStartBlockIds, false);
      } else if (content.type === 'section' && content.subsections) {
        this.renderContent(doc, content.subsections, blockStyles, pageStartBlockIds, false);
      }
    }
  }

  private renderTitle(doc: PDFKit.PDFDocument, content: Chapter | Section): void {
    const size = content.type === 'chapter' ? 24 : Math.max(12, 22 - content.level * 2);
    doc.font('Helvetica-Bold').fontSize(size).fillColor('#000').text(content.title);
    doc.moveDown();
  }

  private renderBlock(
    doc: PDFKit.PDFDocument,
    block: Block,
    style: ResolvedBlockStyle | undefined,
    pageStartBlockIds: Set<string>
  ): void {
    if (pageStartBlockIds.has(block.id)) {
      doc.addPage();
      pageStartBlockIds.delete(block.id);
    }

    const fontFamily = style?.fontFamily ?? 'Helvetica';
    const fontSize = style?.fontSize ?? 11;
    const color = style?.color ?? '#000000';
    const spaceAfter = style?.spaceAfter ?? 8;

    switch (block.type) {
      case 'heading': {
        const headingSize = Math.max(12, 28 - block.level * 3);
        doc.font(resolveFont(fontFamily, true, false)).fontSize(headingSize).fillColor(color).text(block.text);
        doc.moveDown(0.5);
        return;
      }

      case 'paragraph':
        doc.font(resolveFont(fontFamily, false, false)).fontSize(fontSize).fillColor(color).text(block.text, {
          align: block.align === 'justify' ? 'justify' : (block.align ?? 'left'),
        });
        doc.moveDown(spaceAfter / fontSize);
        return;

      case 'quote':
      case 'scripture':
        doc
          .font(resolveFont(fontFamily, false, true))
          .fontSize(fontSize)
          .fillColor(color)
          .text(block.text, { indent: 36 });
        doc.moveDown(spaceAfter / fontSize);
        return;

      case 'list':
        doc.font(resolveFont(fontFamily, false, false)).fontSize(fontSize).fillColor(color);
        block.items.forEach((item, index) => {
          const prefix = block.ordered ? `${index + 1}. ` : '• ';
          doc.text(`${prefix}${item}`, { indent: 18 });
        });
        doc.moveDown(spaceAfter / fontSize);
        return;

      case 'table':
        this.renderTable(doc, block.headers, block.rows, fontSize);
        return;

      case 'footnote':
        doc
          .font(resolveFont(fontFamily, false, false))
          .fontSize(Math.max(7, fontSize - 2))
          .fillColor(color)
          .text(`[${block.number}] ${block.content}`);
        return;

      case 'image':
        if (block.base64) {
          doc.image(Buffer.from(block.base64, 'base64'), {
            fit: [doc.page.width - MARGIN * 2, block.height ?? 300],
          });
        } else {
          // No embedded data - never fetch remote URLs at render time (no hidden network I/O
          // in a renderer, same rule DOCXRenderer follows). Falls back to a text placeholder.
          doc.font('Helvetica-Oblique').fontSize(fontSize).text(`[Image: ${block.caption ?? block.url}]`);
        }
        doc.moveDown(0.5);
        return;

      case 'page-break':
        doc.addPage();
        return;

      case 'divider':
        doc.font('Helvetica').fontSize(fontSize).fillColor(color).text('* * *', { align: 'center' });
        doc.moveDown(0.5);
        return;

      default: {
        const _exhaustive: never = block;
        throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
      }
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
  private renderTable(doc: PDFKit.PDFDocument, headers: string[], rows: (string | null)[][], fontSize: number): void {
    const columnCount = headers.length > 0 ? headers.length : (rows[0]?.length ?? 0);
    if (columnCount === 0) return;

    const usableWidth = doc.page.width - MARGIN * 2;
    const colWidth = usableWidth / columnCount;
    const cellPad = 4;
    const startX = doc.x;

    const rowHeight = (cells: string[]): number =>
      Math.max(...cells.map((text) => doc.heightOfString(text, { width: colWidth - cellPad * 2 }))) + cellPad * 2;

    const drawRow = (cells: string[], bold: boolean): void => {
      if (cells.length === 0) return;
      const h = rowHeight(cells);
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(Math.max(8, fontSize - 1));
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
