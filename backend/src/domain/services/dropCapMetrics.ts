/**
 * The drop-cap geometry, computed ONCE and consumed by both the pagination model and the PDF
 * renderer (`DROPCAP_TEXT_OVERLAP`, MINI_DR_DROPCAP_OVERLAP.md).
 *
 * This module exists to make one claim structural instead of aspirational: **the model and the
 * renderer cannot disagree about a drop cap's geometry, because they run the same arithmetic on
 * the same measured inputs.** The alternative — each computing its own band from the same
 * constants — is precisely the charged-vs-consumed disagreement class RENDER_DRIFT closed.
 *
 * What is NOT here, deliberately: how the glyph width and cap height are obtained. Those are
 * measurements (`TextMeasurer.measureWidth` / `.capHeight` for the model, the live document for
 * the renderer) and they must stay measurements — never derived from `DROP_CAP_SCALE` arithmetic,
 * the reasoning that produced the list-prefix under-charge.
 */

/**
 * The v1 approximation's scale: an enlarged first character, no true wrap-around ornament
 * (BOOK_PRESENTATION.md §4 row 4 as amended). Previously duplicated as a private constant in
 * both PDFRenderer and DOCXRenderer; it lives here so the model can price what they draw.
 *
 * NOT theme-declared yet: making scale a theme value belongs to the drop-cap capability, which
 * stays frozen until this defect is fixed (`MINI_DR_DROP_CAPS.md`).
 */
export const DROP_CAP_SCALE = 2.5;

/** Breathing room between the glyph and the text beside it, in em of the BODY size. Mirrors the EPUB stylesheet's `padding-right: 0.08em`, so the three formats space the ornament alike. */
export const DROP_CAP_GUTTER_EM = 0.08;

export interface DropCapGeometry {
  /** Horizontal space the glyph reserves: its own width plus the gutter. */
  indentPt: number;
  /** Column width available to the lines running beside the glyph. */
  narrowWidth: number;
  /** How many body lines the glyph's INK spans — the lines that must be indented. */
  bandLines: number;
  /** The glyph's real ink height above the baseline, in points. */
  capPt: number;
}

/**
 * The letter SIZE (in points) whose cap-height ink spans exactly `lines` body lines — the
 * arithmetic Word itself applies to its native drop caps (spike Finding B: Word auto-sized the
 * letter to 64.5pt for lines=3 over an 11pt body — this same computation from ITS font metrics).
 * The DOCX renderer is this function's consumer (MINI_DR_DROP_CAPS §6 commit 1), making the
 * letter sizing SHARED across formats rather than three divergent calculations: PDF sizes by
 * scale and derives the band; DOCX sizes by band (lines) and derives the letter — both through
 * this one module, both from MEASURED inputs (capHeightEm from TextMeasurer.capHeight, never a
 * constant; the §-top rule).
 */
export function dropCapLetterSizePt(params: { lines: number; bodyLinePt: number; capHeightEm: number }): number {
  const { lines, bodyLinePt, capHeightEm } = params;
  return (lines * bodyLinePt) / capHeightEm;
}

/**
 * @param glyphWidth MEASURED advance width of the drop-cap character at its enlarged size.
 * @param capPt      MEASURED cap height (real ink) at that enlarged size — never the line box,
 *                   which over-reports by ~83% (34.91pt vs 19.05pt on Gelasio-Bold at 27.5pt).
 * @param bodyLine   MEASURED line height of the body text.
 */
export function dropCapGeometry(params: {
  fontSize: number;
  usableWidth: number;
  glyphWidth: number;
  capPt: number;
  bodyLine: number;
}): DropCapGeometry {
  const { fontSize, usableWidth, glyphWidth, capPt, bodyLine } = params;
  const indentPt = glyphWidth + fontSize * DROP_CAP_GUTTER_EM;
  return {
    indentPt,
    narrowWidth: Math.max(1, usableWidth - indentPt),
    // Ceil, not round: a glyph inking into part of a line still covers that line's start.
    // Measured on Classic at kdp-5x8: 19.05pt of ink over a 13.96pt line = 1.36 -> 2 lines,
    // i.e. line 1 (which already sits beside the glyph) plus exactly one more to indent.
    bandLines: Math.max(1, Math.ceil(capPt / bodyLine)),
    capPt,
  };
}
