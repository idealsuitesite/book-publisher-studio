import { describe, it, expect } from 'vitest';
import PDFDocument from 'pdfkit';
import { PdfFontRegistry } from './PdfFontRegistry';
import {
  PdfKitTextMeasurer,
  PLAUSIBLE_CAP_HEIGHT_EM,
  assertPlausibleCapHeight,
} from './PdfKitTextMeasurer';
import { getTheme } from '../../domain/themes/getTheme';

/**
 * The PRIMARY defence for the PDFKit private-field dependency (docs/DECISIONS.md).
 *
 * `capHeight` reads `doc._font.capHeight`, an internal PDFKit field, because the public metric
 * returns the line box and over-reports by ~83%. The danger is not removal (that breaks the
 * build, loudly) but a RESCALE: a plausible-looking number that is quietly wrong, producing a
 * wrong drop-cap indent that both renders and prices without complaint.
 *
 * That condition depends on the PDFKit version and the embedded faces -- fixed for a build,
 * never manuscript-dependent. It is a DEPLOYMENT defect, so this is where it must be caught:
 * in CI, before it can reach an author (MINI_DR_TEXTMEASURER_PORT.md §5, layer 1).
 */
describe('cap-height metric integrity (PDFKit private-field guard)', () => {
  it('every registered face reports a plausible cap height', () => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const registry = new PdfFontRegistry();
    registry.registerAll(doc);

    const faces = registry.registeredFaceNames();
    // Asserted, not assumed: a family added later must widen this automatically.
    expect(faces.length).toBeGreaterThanOrEqual(12);

    for (const face of faces) {
      doc.font(face);
      const capEm = (doc as unknown as { _font: { capHeight: number } })._font.capHeight / 1000;
      expect(
        capEm,
        `${face} reports ${capEm} em - PDFKit may have rescaled or renamed _font.capHeight`
      ).toBeGreaterThanOrEqual(PLAUSIBLE_CAP_HEIGHT_EM.min);
      expect(capEm).toBeLessThanOrEqual(PLAUSIBLE_CAP_HEIGHT_EM.max);
    }
  });

  it('the guard actually bites - it rejects the conversion error it exists for', () => {
    // The real error this caught: dividing by the inner font's unitsPerEm (2048) on top of
    // PDFKit's already-per-mille value gave 0.34 em -> "no lines to indent" -> "no bug".
    expect(() => assertPlausibleCapHeight(0.338, 'Gelasio-Bold')).toThrow(/implausible cap height/);
    expect(() => assertPlausibleCapHeight(Number.NaN, 'x')).toThrow(/implausible cap height/);
    expect(() => assertPlausibleCapHeight(0.693, 'Gelasio-Bold')).not.toThrow();
  });
});

describe('TextMeasurer additions - contract', () => {
  const theme = getTheme('classic');

  it('capHeight returns real ink, strictly less than the line box measureHeight reports', () => {
    const measurer = new PdfKitTextMeasurer();
    const size = 27.5;
    const ink = measurer.capHeight(size, { theme, heading: true });
    const lineBox = measurer.measureHeight('E', { fontSize: size, width: 10_000, theme, heading: true });

    // The property the port's doc comment warns about: these are NOT interchangeable.
    expect(ink).toBeLessThan(lineBox);
    expect(ink / size).toBeGreaterThanOrEqual(PLAUSIBLE_CAP_HEIGHT_EM.min);
    expect(ink / size).toBeLessThanOrEqual(PLAUSIBLE_CAP_HEIGHT_EM.max);
  });

  it('capHeight scales linearly with size', () => {
    const measurer = new PdfKitTextMeasurer();
    expect(measurer.capHeight(20, { theme })).toBeCloseTo(measurer.capHeight(10, { theme }) * 2, 6);
  });

  it('measureWidth grows with text length and with size, and never wraps', () => {
    const measurer = new PdfKitTextMeasurer();
    const opts = { fontSize: 11, theme };
    const one = measurer.measureWidth('E', opts);
    const many = measurer.measureWidth('EEEEEEEEEE', opts);

    expect(one).toBeGreaterThan(0);
    expect(many).toBeCloseTo(one * 10, 4); // no wrapping: ten glyphs are ten advances
    expect(measurer.measureWidth('E', { fontSize: 22, theme })).toBeCloseTo(one * 2, 6);
  });
});
