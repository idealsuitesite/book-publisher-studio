import { describe, it, expect } from 'vitest';
import PDFDocument from 'pdfkit';
import { PdfFontRegistry } from './PdfFontRegistry';
import type { Theme } from '../../domain/models/Theme';

function themeWithFonts(heading: string, body: string): Theme {
  return {
    name: 'test',
    fonts: { heading, body },
    fontSizes: { h1: 28, h2: 22, h3: 18, h4: 16, h5: 14, h6: 12, body: 11, small: 9 },
    colors: { text: '#000000', accent: '#4A4A4A' },
    spacing: { paragraphSpacing: 8, headingSpacing: 16, lineHeight: 1.4 },
  };
}

describe('PdfFontRegistry', () => {
  const registry = new PdfFontRegistry();

  it('resolves the body role from a serif theme font (e.g. Georgia) to Gelasio', () => {
    const theme = themeWithFonts('Georgia', 'Georgia');
    expect(registry.resolveBody(theme, false, false)).toBe('Gelasio');
    expect(registry.resolveBody(theme, true, false)).toBe('Gelasio-Bold');
    expect(registry.resolveBody(theme, false, true)).toBe('Gelasio-Italic');
    expect(registry.resolveBody(theme, true, true)).toBe('Gelasio-BoldItalic');
  });

  it('resolves the heading role independently from the body role', () => {
    const theme = themeWithFonts('Georgia', 'Arial');
    expect(registry.resolveHeading(1, theme, true, false)).toBe('Gelasio-Bold');
    expect(registry.resolveBody(theme, false, false)).toBe('Inter');
  });

  it('resolves the body/heading role to JetBrains Mono for a monospace theme font', () => {
    const theme = themeWithFonts('Consolas', 'Courier New');
    expect(registry.resolveBody(theme, false, false)).toBe('JetBrainsMono');
    expect(registry.resolveHeading(2, theme, true, false)).toBe('JetBrainsMono-Bold');
  });

  it('resolves a sans-serif theme font, or an unrecognized one, to Inter (default)', () => {
    const theme = themeWithFonts('Arial', 'SomeUnknownFontName');
    expect(registry.resolveHeading(1, theme, false, false)).toBe('Inter');
    expect(registry.resolveBody(theme, true, true)).toBe('Inter-BoldItalic');
  });

  it('resolves the monospace role to JetBrains Mono, independent of any theme', () => {
    expect(registry.resolveMonospace(false, false)).toBe('JetBrainsMono');
    expect(registry.resolveMonospace(true, true)).toBe('JetBrainsMono-BoldItalic');
  });

  it('resolves the default role to Inter, independent of any theme', () => {
    expect(registry.resolveDefault(false, false)).toBe('Inter');
    expect(registry.resolveDefault(true, false)).toBe('Inter-Bold');
  });

  it('registers all 12 family/weight/style variants on a real PDFDocument without throwing', () => {
    const doc = new PDFDocument({ compress: false });
    expect(() => registry.registerAll(doc)).not.toThrow();
  });
});
