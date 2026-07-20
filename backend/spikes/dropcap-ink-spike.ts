/**
 * REAL ink height of the drop-cap glyph (cap height from font metrics), not the line box.
 * CTO-required before any constant enters the code (MINI_DR_DROPCAP_OVERLAP §2).
 *
 * THE GUARD BELOW IS THE POINT OF THIS FILE AS MUCH AS THE NUMBER IS.
 * A first version of this measurement divided by the inner font's `unitsPerEm` (2048) on top of
 * PDFKit's already-per-mille `_font.capHeight`, yielding a 0.34 em cap height -> "0 lines to
 * indent" -> "there is no bug". Nothing in the toolchain objected; it was caught by eye, because
 * a capital letter is not a third of an em. An instrument whose wrong answer looks like a right
 * answer is worse than no instrument, so it now refuses physically absurd results the way the
 * parity test refuses a moved page count (CTO, 2026-07-21).
 */
import PDFDocument from 'pdfkit';
import { PdfFontRegistry } from '../src/infrastructure/fonts/PdfFontRegistry';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP5x8PageLayout as L } from '../src/domain/layouts/KDP5x8PageLayout';

/** Cap height of a standard Latin face, in em. Outside this, the MEASUREMENT is wrong, not the font. */
const PLAUSIBLE_CAP_EM = { min: 0.6, max: 0.8 };

function assertPlausibleCapHeight(capEm: number, label: string): void {
  if (capEm < PLAUSIBLE_CAP_EM.min || capEm > PLAUSIBLE_CAP_EM.max) {
    throw new Error(
      `IMPLAUSIBLE CAP HEIGHT (${label}): ${capEm.toFixed(3)} em is outside the physically ` +
        `reasonable range ${PLAUSIBLE_CAP_EM.min}-${PLAUSIBLE_CAP_EM.max} em for a Latin face. ` +
        `This is a measurement/conversion error, not a font property - do NOT use the result.`
    );
  }
}

const SCALE = 2.5;
const theme = getTheme('classic');
const size = theme.fontSizes.body;
const doc = new PDFDocument({ size: [L.width, L.height], margins: { top: L.marginTop, bottom: L.marginBottom, left: L.marginLeft, right: L.marginRight } });
new PdfFontRegistry().registerAll(doc);
const line = new PdfKitTextMeasurer().lineHeight(size, { theme });

doc.font('Gelasio-Bold').fontSize(size * SCALE);
const m = (doc as unknown as { _font: { capHeight: number; font: { unitsPerEm: number } } })._font;

// PDFKit normalises _font.capHeight to a 1000-unit em, so it converts with /1000.
const capEm = m.capHeight / 1000;
assertPlausibleCapHeight(capEm, 'per-mille conversion');
const capPt = capEm * size * SCALE;
const box = doc.heightOfString('E', { width: 10_000 });

console.log(`body line height      : ${line.toFixed(2)}pt`);
console.log(`glyph LINE BOX        : ${box.toFixed(2)}pt -> ${(box / line).toFixed(2)} lines  (over-reports)`);
console.log(`glyph REAL INK (cap)  : ${capPt.toFixed(2)}pt (${capEm.toFixed(3)} em) -> ${(capPt / line).toFixed(2)} lines`);
console.log(`LINES TO INDENT beyond line 1: ${Math.max(0, Math.ceil(capPt / line) - 1)}`);

// The guard must actually bite: replay the original wrong conversion and prove it is rejected.
const wrongEm = m.capHeight / m.font.unitsPerEm;
try {
  assertPlausibleCapHeight(wrongEm, 'original buggy conversion');
  console.log(`\nGUARD FAILED TO BITE - it accepted ${wrongEm.toFixed(3)} em`);
  process.exit(1);
} catch {
  console.log(`\nguard verified: the original buggy conversion (${wrongEm.toFixed(3)} em) is REJECTED.`);
}
