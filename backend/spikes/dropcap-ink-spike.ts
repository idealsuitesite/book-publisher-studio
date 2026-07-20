/**
 * (1) REAL ink height of the drop-cap glyph (cap height from font metrics), not the line box.
 * CTO-required before any constant enters the code (MINI_DR_DROPCAP_OVERLAP §2).
 *
 * Note on the metric: PDFKit normalises `_font.capHeight` to a 1000-unit em (1419 font units x
 * scale 0.48828125 = 692.87), so it converts with /1000, NOT with the inner font's unitsPerEm.
 * Dividing by 2048 as well gave 9.30pt -- a 0.34 em cap height, implausible on its face and
 * contradicted by the visual evidence. Recorded because the wrong figure was nearly published.
 */
import PDFDocument from 'pdfkit';
import { PdfFontRegistry } from '../src/infrastructure/fonts/PdfFontRegistry';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP5x8PageLayout as L } from '../src/domain/layouts/KDP5x8PageLayout';

const SCALE = 2.5;
const theme = getTheme('classic');
const size = theme.fontSizes.body;
const doc = new PDFDocument({ size: [L.width, L.height], margins: { top: L.marginTop, bottom: L.marginBottom, left: L.marginLeft, right: L.marginRight } });
new PdfFontRegistry().registerAll(doc);
const line = new PdfKitTextMeasurer().lineHeight(size, { theme });

doc.font('Gelasio-Bold').fontSize(size * SCALE);
const m = (doc as unknown as { _font: { capHeight: number; ascender: number } })._font;
const capPt = (m.capHeight / 1000) * size * SCALE;
const box = doc.heightOfString('E', { width: 10_000 });

console.log(`body line height      : ${line.toFixed(2)}pt`);
console.log(`glyph LINE BOX        : ${box.toFixed(2)}pt -> ${(box / line).toFixed(2)} lines  (over-reports)`);
console.log(`glyph REAL INK (cap)  : ${capPt.toFixed(2)}pt -> ${(capPt / line).toFixed(2)} lines`);
console.log(`LINES TO INDENT beyond line 1: ${Math.max(0, Math.ceil(capPt / line) - 1)}`);
