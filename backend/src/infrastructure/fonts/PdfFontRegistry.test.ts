import { describe, it, expect } from 'vitest';
import PDFDocument from 'pdfkit';
import { PdfFontRegistry } from './PdfFontRegistry';

describe('PdfFontRegistry', () => {
  const registry = new PdfFontRegistry();

  it('resolves a serif theme font (e.g. Georgia) to Gelasio', () => {
    expect(registry.resolve('Georgia', false, false)).toBe('Gelasio');
    expect(registry.resolve('Georgia', true, false)).toBe('Gelasio-Bold');
    expect(registry.resolve('Georgia', false, true)).toBe('Gelasio-Italic');
    expect(registry.resolve('Georgia', true, true)).toBe('Gelasio-BoldItalic');
  });

  it('resolves a monospace theme font to JetBrains Mono', () => {
    expect(registry.resolve('Courier New', false, false)).toBe('JetBrainsMono');
    expect(registry.resolve('Consolas', true, false)).toBe('JetBrainsMono-Bold');
  });

  it('resolves a sans-serif theme font, or an unrecognized one, to Inter (default)', () => {
    expect(registry.resolve('Arial', false, false)).toBe('Inter');
    expect(registry.resolve('SomeUnknownFontName', true, true)).toBe('Inter-BoldItalic');
  });

  it('registers all 12 family/weight/style variants on a real PDFDocument without throwing', () => {
    const doc = new PDFDocument({ compress: false });
    expect(() => registry.registerAll(doc)).not.toThrow();
  });
});
