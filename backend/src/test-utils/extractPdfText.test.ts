import { describe, it, expect } from 'vitest';
import PDFDocument from 'pdfkit';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPdfText } from './extractPdfText';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMBEDDED_FONT_PATH = join(__dirname, '..', '..', 'assets', 'fonts', 'Gelasio-Regular.ttf');

function renderPdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));
    build(doc);
    doc.end();
  });
}

describe('extractPdfText', () => {
  it('decodes text shown with a standard-14 font (single-byte WinAnsi, no ToUnicode CMap)', async () => {
    const buffer = await renderPdf((doc) => {
      doc.font('Helvetica').fontSize(12).text('Hello standard.');
    });

    expect(extractPdfText(buffer)).toContain('Hello standard.');
  });

  it('decodes text shown with an embedded TrueType font (2-byte Identity-H CIDs via /ToUnicode)', async () => {
    const buffer = await renderPdf((doc) => {
      doc.registerFont('Embedded', EMBEDDED_FONT_PATH);
      doc.font('Embedded').fontSize(12).text('Hello embedded.');
    });

    const raw = buffer.toString('latin1');
    // Confirms this test is actually exercising the Identity-H path, not silently
    // falling back to a standard-14 font PDFKit happened to substitute.
    expect(raw).toContain('/Identity-H');
    expect(raw).toContain('/ToUnicode');
    expect(extractPdfText(buffer)).toContain('Hello embedded.');
  });

  it('decodes correctly when a single PDF mixes standard-14 and embedded-font text (the exact real-world shape PDFRenderer produces: embedded body text + standard-14 page chrome)', async () => {
    const buffer = await renderPdf((doc) => {
      doc.registerFont('Embedded', EMBEDDED_FONT_PATH);
      doc.font('Helvetica').fontSize(10).text('Standard chrome.');
      doc.font('Embedded').fontSize(12).text('Embedded body.');
      doc.font('Helvetica-Bold').fontSize(10).text('Standard again.');
    });

    const text = extractPdfText(buffer);
    expect(text).toContain('Standard chrome.');
    expect(text).toContain('Embedded body.');
    expect(text).toContain('Standard again.');
  });

  it('does not mix up CIDs between two different embedded font subsets (each keeps its own ToUnicode CMap)', async () => {
    const otherFontPath = join(__dirname, '..', '..', 'assets', 'fonts', 'Inter-Regular.ttf');
    const buffer = await renderPdf((doc) => {
      doc.registerFont('FontA', EMBEDDED_FONT_PATH);
      doc.registerFont('FontB', otherFontPath);
      doc.font('FontA').fontSize(12).text('Alpha text.');
      doc.font('FontB').fontSize(12).text('Beta text.');
    });

    const text = extractPdfText(buffer);
    expect(text).toContain('Alpha text.');
    expect(text).toContain('Beta text.');
  });
});
