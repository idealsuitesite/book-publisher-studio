/**
 * Real rendered text measurement, for pagination that measures instead of guessing
 * (LAYOUT_FIDELITY.md Decision 6, from the §2bis underfill investigation).
 *
 * Exists because `LayoutEngine` priced blocks with `ceil(words / 12) × fontSize × 1.5` while
 * `PDFRenderer` drew them at the font's natural line height with real glyph widths — a
 * measured 1.43× overcharge that capped every page at ~71% fill and left chapter titles
 * (booked at 0pt) sitting above voids. The estimate was then *enforced*: the renderer forces
 * a page break wherever the estimator said one falls.
 *
 * A port rather than a concrete class (DEVELOPER_HANDBOOK.md's judgment rule) because a second
 * real implementation is already foreseeable: DOCX line metrics differ from PDF's, and a
 * DOCX-faithful pagination would implement this same interface with Word-metric behaviour.
 * The Domain stays free of PDFKit; Infrastructure owns it.
 */
import type { Theme } from '../models/Theme';

export interface MeasureOptions {
  fontSize: number;
  /** The real text column width — page width minus horizontal margins. */
  width: number;
  /** Measure in the theme's heading face rather than the body face. */
  heading?: boolean;
  /** The theme whose fonts the renderer will draw with. Passed per call, not fixed at
   * construction: the measurer serves whatever book is being paginated. */
  theme: Theme;
}

export interface TextMeasurer {
  /** Height this text will actually occupy at this size in this column, natural line height. */
  measureHeight(text: string, options: MeasureOptions): number;
  /**
   * Height of a single line at this size — for modelling `moveDown()` and blank-line spacing.
   *
   * Pass `font` whenever the renderer will draw in a themed face: the old assumption that
   * "line height is a property of size, not family" was MEASURED FALSE on the real book
   * fonts (RENDER_DRIFT.md follow-up: default 12.72pt vs Gelasio 13.96pt at body size —
   * ~10% under-charge on every split-page line, a steady source of silent overflow breaks).
   * Without `font`, the measurer's default face is used (kept for callers with no theme).
   */
  lineHeight(fontSize: number, font?: { theme: Theme; heading?: boolean }): number;
  /**
   * Advance width this text really occupies at this size in this face — NO wrapping.
   *
   * The counterpart of `measureHeight`, minus its `width`: an advance width has no column to
   * wrap in, so the option that means "the column" is deliberately absent rather than ignored.
   * A caller who wants a wrapped result wants `measureHeight`.
   */
  measureWidth(text: string, options: Omit<MeasureOptions, 'width'>): number;
  /**
   * Cap height — the real INK above the baseline — at this size, in points.
   *
   * NOT `measureHeight` of a single character. That returns the LINE BOX, which includes ascent
   * and descent the glyph never inks. Measured on Gelasio-Bold at 27.5pt: line box **34.91pt**
   * (2.50 body lines) versus real cap height **19.05pt** (1.36 body lines) — an ~83% over-report.
   * A caller who reaches for the obvious method reserves far too much space, and the result looks
   * plausible in both the render and the pricing, so nothing complains.
   *
   * This warning lives here, in the port, because this is the file the next caller will read.
   *
   * Implementations MUST refuse to answer rather than invent: a ratio outside a physically
   * reasonable range for the face is a measurement failure, not a font property, and must throw.
   * Deciding what a *product* does about that is the caller's job, not this port's
   * (see MINI_DR_TEXTMEASURER_PORT.md §5 — the port throws, the caller degrades).
   */
  capHeight(fontSize: number, font?: { theme: Theme; heading?: boolean }): number;
}
