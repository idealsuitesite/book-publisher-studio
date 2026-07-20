/**
 * How many lines does a drop cap actually span, and what wrap width do they really have?
 * (MINI_DR_DROPCAP_OVERLAP prerequisite, CTO-required: verify, do not assume it is only line 2.)
 * Measured against the real PDFKit document the renderer draws with, not computed from a constant.
 */
import PDFDocument from 'pdfkit';
import { PdfFontRegistry } from '../src/infrastructure/fonts/PdfFontRegistry';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP5x8PageLayout as L } from '../src/domain/layouts/KDP5x8PageLayout';

const DROP_CAP_SCALE = 2.5;
const theme = getTheme('classic');
const fontSize = theme.fontSizes.body;
const doc = new PDFDocument({ size: [L.width, L.height], margins: { top: L.marginTop, bottom: L.marginBottom, left: L.marginLeft, right: L.marginRight } });
const fonts = new PdfFontRegistry();
fonts.registerAll(doc);

const bodyLine = new PdfKitTextMeasurer().lineHeight(fontSize, { theme });

doc.font(fonts.resolveHeading(1, theme, true, false)).fontSize(fontSize * DROP_CAP_SCALE);
const glyphHeight = doc.heightOfString('E', { width: 10_000 });
const capAscent = doc.currentLineHeight(false);

const usableWidth = L.width - L.marginLeft - L.marginRight;
const glyphWidth = doc.widthOfString('E');

console.log(`body fontSize: ${fontSize}pt | body line height: ${bodyLine.toFixed(2)}pt`);
console.log(`drop cap fontSize: ${(fontSize * DROP_CAP_SCALE).toFixed(1)}pt`);
console.log(`drop cap glyph height: ${glyphHeight.toFixed(2)}pt | ascent box: ${capAscent.toFixed(2)}pt`);
console.log(`drop cap glyph WIDTH: ${glyphWidth.toFixed(2)}pt | column width: ${usableWidth.toFixed(2)}pt`);
console.log(`\nLINES SPANNED by the glyph: ${(glyphHeight / bodyLine).toFixed(2)} -> ${Math.ceil(glyphHeight / bodyLine)} lines`);
console.log(`Lines needing indent AFTER line 1: ${Math.ceil(glyphHeight / bodyLine) - 1}`);
console.log(`Their wrap width once indented: ${(usableWidth - glyphWidth).toFixed(2)}pt (${((1 - glyphWidth / usableWidth) * 100).toFixed(1)}% of the column)`);
