import PDFDocument from 'pdfkit';
import type { TextMeasurer, MeasureOptions } from '../../domain/ports/TextMeasurer';
import type { Theme } from '../../domain/models/Theme';
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

  lineHeight(fontSize: number, font?: { theme: Theme; heading?: boolean }): number {
    // The old comment here claimed line height was "a property of size, not family, to within
    // a point" — measured false on the real fonts (12.72 vs 13.96pt at body size, ~10%). When
    // the caller knows the face the renderer will draw with, we measure THAT face.
    if (font) {
      const face = font.heading
        ? this.fonts.resolveHeading(1, font.theme, true, false)
        : this.fonts.resolveBody(font.theme, false, false);
      this.doc.font(face);
    }
    this.doc.fontSize(fontSize);
    return this.doc.heightOfString('x', { width: 10_000 });
  }

  measureWidth(text: string, options: Omit<MeasureOptions, 'width'>): number {
    const font = options.heading
      ? this.fonts.resolveHeading(1, options.theme, true, false)
      : this.fonts.resolveBody(options.theme, false, false);
    this.doc.font(font).fontSize(options.fontSize);
    return this.doc.widthOfString(text);
  }

  capHeight(fontSize: number, font?: { theme: Theme; heading?: boolean }): number {
    if (font) {
      const face = font.heading
        ? this.fonts.resolveHeading(1, font.theme, true, false)
        : this.fonts.resolveBody(font.theme, false, false);
      this.doc.font(face);
    }
    // PDFKit exposes no PUBLIC font-metric accessor, and the metric that IS public
    // (heightOfString of one character) returns the LINE BOX, not the ink -- 34.91pt vs a real
    // 19.05pt on Gelasio-Bold at 27.5pt, an ~83% over-report. So this reads a private field.
    // Accepted risk, recorded in docs/DECISIONS.md rather than only here, because someone
    // debugging a broken export must find it without reading this file.
    const internal = this.doc as unknown as { _font?: { capHeight?: number; name?: string } };
    const perMille = internal._font?.capHeight;
    const capEm = typeof perMille === 'number' ? perMille / 1000 : Number.NaN;
    assertPlausibleCapHeight(capEm, internal._font?.name);
    return capEm * fontSize;
  }
}

/**
 * Cap height of a Latin face, in em. MEASURED across all twelve registered faces before this
 * range was chosen: 0.6929 (Gelasio) to 0.7300 (JetBrainsMono) -- so the bounds are not
 * calibrated on the one face drop caps happen to use, and carry margin on both sides.
 *
 * Outside this range the MEASUREMENT is wrong, not the font. This exists because the private
 * field above can be renamed or rescaled by a PDFKit upgrade, and a rescale is the dangerous
 * case: it returns a plausible-looking number that is quietly wrong. It already caught one real
 * error -- dividing by the inner font's unitsPerEm on top of PDFKit's per-mille value gave
 * 0.34 em, i.e. "no lines to indent", i.e. "no bug".
 */
export const PLAUSIBLE_CAP_HEIGHT_EM = { min: 0.6, max: 0.8 } as const;

export function assertPlausibleCapHeight(capEm: number, face?: string): void {
  if (!Number.isFinite(capEm) || capEm < PLAUSIBLE_CAP_HEIGHT_EM.min || capEm > PLAUSIBLE_CAP_HEIGHT_EM.max) {
    throw new Error(
      `TextMeasurer.capHeight: implausible cap height ${String(capEm)} em for face ` +
        `${face ?? '<unknown>'} - outside the physically reasonable range ` +
        `${PLAUSIBLE_CAP_HEIGHT_EM.min}-${PLAUSIBLE_CAP_HEIGHT_EM.max} em for a Latin face. ` +
        `This is a measurement failure (most likely PDFKit changed _font.capHeight), not a font ` +
        `property. Refusing to answer rather than return a wrong metric - see docs/DECISIONS.md.`
    );
  }
}
