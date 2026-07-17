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
  async render(book: PaginatedBook, context: RenderContext): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: PAGE_SIZE,
        margin: MARGIN,
        info: {
          ...(context.metadata?.title ? { Title: context.metadata.title } : {}),
          ...(context.metadata?.author ? { Author: context.metadata.author } : {}),
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));

      const totalPages = book.pages.length;
      this.setupHeaderFooter(doc, totalPages);

      const pageStartBlockIds = new Set(
        book.pages.slice(1).map((page) => page.blocks[0]).filter((id): id is string => Boolean(id))
      );

      this.renderContent(doc, book.styledBook.book.mainContent, book.styledBook.blockStyles, pageStartBlockIds, true);

      doc.end();
    });
  }

  // ADR-0019 finding 6: writing header/footer text below the margin-defined content box
  // triggers PDFKit's own overflow-based auto-pagination from inside the 'pageAdded' handler
  // that's drawing it, causing unbounded recursion. Fix: suppress the bottom-margin overflow
  // check for the duration of this draw by temporarily zeroing it.
  //
  // Second gotcha (reproduced): doc.text(str, x, y, opts) moves PDFKit's internal cursor
  // (doc.x/doc.y) to just below the text it wrote. Since the footer is drawn near the bottom
  // of the page, that leaves the cursor there - and every subsequent block render call that
  // omits explicit x/y (paragraphs, headings, etc.) continues writing FROM that cursor, so it
  // overflows onto a new page almost immediately. Observed effect: a 9-page document rendered
  // as 212 pages. Fix: explicitly reset the cursor to the top margin after each header/footer
  // draw, before content resumes.
  private setupHeaderFooter(doc: PDFKit.PDFDocument, totalPages: number): void {
    let pageNum = 1;
    const draw = (n: number): void => {
      const { width, height } = doc.page;
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(9).fillColor('#000');
      doc.text('Book Publisher Studio', MARGIN, 40, { width: width - MARGIN * 2, align: 'left', lineBreak: false });
      doc.text(`Page ${n} of ${totalPages}`, MARGIN, height - 50, {
        width: width - MARGIN * 2,
        align: 'center',
        lineBreak: false,
      });
      doc.page.margins.bottom = savedBottom;
      doc.x = MARGIN;
      doc.y = doc.page.margins.top;
    };

    doc.on('pageAdded', () => {
      pageNum += 1;
      draw(pageNum);
    });
    draw(1); // the document's own first page never fires 'pageAdded'
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
  private renderTable(doc: PDFKit.PDFDocument, headers: string[], rows: (string | null)[][], fontSize: number): void {
    const usableWidth = doc.page.width - MARGIN * 2;
    const colWidth = usableWidth / headers.length;
    const cellPad = 4;
    const startX = doc.x;

    const rowHeight = (cells: string[]): number =>
      Math.max(...cells.map((text) => doc.heightOfString(text, { width: colWidth - cellPad * 2 }))) + cellPad * 2;

    const drawRow = (cells: string[], bold: boolean): void => {
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

    drawRow(headers, true);
    for (const row of rows) drawRow(row.map((cell) => cell ?? ''), false);
    doc.moveDown();
  }
}
