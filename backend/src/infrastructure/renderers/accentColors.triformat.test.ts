import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { inflateSync } from 'node:zlib';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { getTheme, resolveTheme } from '../../domain/themes/getTheme';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { PDFRenderer } from './PDFRenderer';
import { DOCXRenderer } from './DOCXRenderer';
import { EPUBRenderer } from './EPUBRenderer';
import { createBook } from '../../domain/models/Book';
import type { Theme } from '../../domain/models/Theme';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';

/**
 * Phase 3 capability 1 — accent colours, tri-format proof (BOOK_PRESENTATION.md §4 row 1,
 * ADR-0050, MINI_DR_ACCENT_COLORS.md §4).
 *
 * `Theme.colors.accent` existed since the Theme model did and was read by NOTHING — a declared
 * capability that rendered nowhere. It is now consumed by heading blocks (ThemeEngine) and by
 * chapter/section titles in all three renderers. Because Classic deliberately declares its accent
 * to BE its text colour (the shipped theme must not change appearance — that aspect decision is
 * reserved for the second theme's screenshot loop), Classic cannot prove anything. So the proof
 * uses a TEST theme with a distinct accent, and asserts the declared value reaches each format's
 * NATIVE mechanism — the fidelity standard fixed in BOOK_PRESENTATION §6 Q3, not pixel parity.
 */
const ACCENT = '#1D4E68';
const TEST_THEME: Theme = {
  ...getTheme('classic'),
  name: 'accent-proof',
  colors: { text: '#000000', accent: ACCENT },
};

/** Inflate every Flate-compressed stream object so the real drawing operators are visible. */
function inflateContentStreams(pdf: Buffer): string {
  const START = Buffer.from('stream');
  const END = Buffer.from('endstream');
  let out = '';
  let idx = 0;
  while ((idx = pdf.indexOf(START, idx)) !== -1) {
    let start = idx + START.length;
    while (pdf[start] === 0x0d || pdf[start] === 0x0a) start++;
    const end = pdf.indexOf(END, start);
    if (end === -1) break;
    try {
      out += inflateSync(pdf.subarray(start, end)).toString('latin1');
    } catch {
      /* not a deflate stream (fonts, images) - skip */
    }
    idx = end + END.length;
  }
  return out;
}

function paginateWith(theme: Theme): PaginatedBook {
  const now = new Date();
  const book = createBook({ title: 'Accent Proof', author: 'Test', language: 'en' }, [
    {
      type: 'chapter' as const,
      id: 'c1',
      number: 1,
      title: 'A Chapter Title In Accent',
      content: [
        { type: 'heading' as const, id: 'h1', level: 2, text: 'A Heading Block In Accent', inlines: [] },
        { type: 'paragraph' as const, id: 'p1', text: 'Body text stays the text colour.', inlines: [] },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const styled = new ThemeEngine().applyTheme(book, theme);
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, LetterPageLayout);
}

describe('accent colours — tri-format (Phase 3 capability 1, ADR-0050)', () => {
  it('ThemeEngine resolves heading blocks to the declared accent, body to text', () => {
    const styled = new ThemeEngine().applyTheme(
      createBook({ title: 'T', author: 'A', language: 'en' }, [
        {
          type: 'chapter' as const,
          id: 'c1',
          number: 1,
          title: 'One',
          content: [
            { type: 'heading' as const, id: 'h1', level: 1, text: 'H', inlines: [] },
            { type: 'paragraph' as const, id: 'p1', text: 'P', inlines: [] },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      TEST_THEME
    );
    expect(styled.blockStyles['h1'].color).toBe(ACCENT);
    expect(styled.blockStyles['p1'].color).toBe('#000000');
  });

  it('PDF emits a fill-colour operator matching the declared accent', async () => {
    const result = await new PDFRenderer().render(paginateWith(TEST_THEME), { language: 'en' });
    // PDFKit Flate-compresses its content streams, so the drawing operators are NOT in the raw
    // bytes — inflate them rather than weaken the assertion into something that would pass
    // without the colour ever being drawn.
    const pdf = inflateContentStreams(result.output);

    // Precision-agnostic on purpose: assert a fill-colour operator whose PARSED RGB really is
    // the declared accent, rather than guessing PDFKit's decimals. Measured, PDFKit emits `sc`
    // (colour-space set-colour), not the `rg` shorthand — accept either rather than encode a
    // brittle assumption about which one a future version picks.
    const expected = [0x1d / 255, 0x4e / 255, 0x68 / 255];
    const operators = [...pdf.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (?:rg|sc|scn)\b/g)].map((m) =>
      [m[1], m[2], m[3]].map(Number)
    );
    const found = operators.some((rgb) => rgb.every((v, i) => Math.abs(v - expected[i]) < 0.002));
    expect(found, `no rg operator matched the declared accent ${ACCENT}`).toBe(true);
  });

  it('DOCX carries the accent in the heading style definitions (styles.xml)', async () => {
    const result = await new DOCXRenderer().render(paginateWith(TEST_THEME), { language: 'en' });
    const zip = await JSZip.loadAsync(result.output);
    const styles = await zip.file('word/styles.xml')!.async('string');
    // Word's own default Heading-N styles carry the colour — which is why this single source
    // covers Heading blocks AND chapter/section titles at once.
    expect(styles).toContain('1D4E68');
  });

  it('EPUB declares the accent on headings in its stylesheet', async () => {
    const result = await new EPUBRenderer().render(paginateWith(TEST_THEME), { language: 'en' });
    const zip = await JSZip.loadAsync(result.output);
    const cssName = Object.keys(zip.files).find((n) => n.endsWith('.css'));
    const css = await zip.file(cssName!)!.async('string');
    expect(css).toMatch(/h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{\s*color:\s*#1D4E68/i);
  });

  it('Classic stays visually stable: its accent IS its text colour', () => {
    const classic = getTheme('classic');
    expect(classic.colors.accent).toBe(classic.colors.text);
  });

  // MINI_DR_PER_THEME_ACCENT: the real override function, on real output. Classic's own accent is
  // invisible black, so a visible override reaching the PDF proves the whole chain works, and the
  // page count staying put proves the override is colour-only (R2-free), not geometry.
  it('a per-project accent override (resolveTheme) recolours Classic and moves no pages (R2-free)', async () => {
    const overridden = resolveTheme('classic', ACCENT);
    expect(paginateWith(overridden).pages.length).toBe(paginateWith(getTheme('classic')).pages.length);

    const pdf = inflateContentStreams((await new PDFRenderer().render(paginateWith(overridden), { language: 'en' })).output);
    const expected = [0x1d / 255, 0x4e / 255, 0x68 / 255];
    const operators = [...pdf.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (?:rg|sc|scn)\b/g)].map((m) => [m[1], m[2], m[3]].map(Number));
    expect(operators.some((rgb) => rgb.every((v, i) => Math.abs(v - expected[i]) < 0.002))).toBe(true);
  });
});
