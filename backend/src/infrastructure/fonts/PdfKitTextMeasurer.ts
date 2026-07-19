import PDFDocument from 'pdfkit';
import type { TextMeasurer, MeasureOptions } from '../../domain/ports/TextMeasurer';
import { PdfFontRegistry } from './PdfFontRegistry';

/**
 * `TextMeasurer` on PDFKit's own `heightOfString`, with the SAME embedded fonts the renderer
 * draws with (`PdfFontRegistry`) — so pagination prices a block at exactly what `PDFRenderer`
 * will emit. This is the figure ADR-0019 finding 6C already trusts for the footer's "of TOTAL";
 * Decision 6 makes it the pagination input as well.
 *
 * Holds one never-rendered PDFDocument purely as a measuring instrument. Same options the
 * renderer uses: no `lineGap` (natural line height), real glyph widths, real font.
 */
export class PdfKitTextMeasurer implements TextMeasurer {
  private readonly doc: PDFKit.PDFDocument;
  private readonly fonts = new PdfFontRegistry();

  constructor() {
    this.doc = new PDFDocument({ autoFirstPage: false });
    this.fonts.registerAll(this.doc);
  }

  measureHeight(text: string, options: MeasureOptions): number {
    if (!text.trim()) return this.lineHeight(options.fontSize);
    const font = options.heading
      ? this.fonts.resolveHeading(1, options.theme, true, false)
      : this.fonts.resolveBody(options.theme, false, false);
    this.doc.font(font).fontSize(options.fontSize);
    return this.doc.heightOfString(text, { width: options.width });
  }

  lineHeight(fontSize: number): number {
    // Line height is a property of size, not family, to within a point at body sizes —
    // measured with the default font to avoid needing a theme for a spacing question.
    this.doc.fontSize(fontSize);
    return this.doc.heightOfString('x', { width: 10_000 });
  }
}
