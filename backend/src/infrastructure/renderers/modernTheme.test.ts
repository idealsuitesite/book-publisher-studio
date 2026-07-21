/**
 * Modern theme (SECOND_THEME.md) — its OWN parity lock + tri-format accent/font verification, on
 * the real corpus. The second theme owes its own numbers (never Classic's) and must exercise
 * colors.accent end to end — the field Classic leaves unused (accent === text). Classic must stay
 * byte-unaffected. Numbers measured on faith-alone; a change here means Modern's R2 contract moved.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { PDFRenderer } from './PDFRenderer';
import { DOCXRenderer } from './DOCXRenderer';
import { EPUBRenderer } from './EPUBRenderer';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { KDP6x9PageLayout } from '../../domain/layouts/KDP6x9PageLayout';
import { getTheme } from '../../domain/themes/getTheme';
import type { Book } from '../../domain/models/Book';
import type { PageLayout } from '../../domain/models/PageLayout';

const CORPUS = join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');
const ACCENT = '1D4E68';

describe('Modern theme — parity lock + tri-format accent/fonts (real corpus)', () => {
  let faith: Book;
  beforeAll(async () => {
    const raw = await new MammothParser().parse(readFileSync(CORPUS));
    const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'faith-alone-styled.docx' });
    const built = new ASTBuilder().build(normalized);
    faith = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  }, 30_000);

  function paginate(themeName: string, layout: PageLayout) {
    const styled = new ThemeEngine().applyTheme(faith, getTheme(themeName));
    const typeset = new TypographyResolver().resolve(styled);
    return new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, layout);
  }

  it('the theme is real and distinct: accent is visible (accent !== text), reused from Classic-untouched', () => {
    const modern = getTheme('modern');
    expect(modern.colors.accent).toBe('#1D4E68');
    expect(modern.colors.accent).not.toBe(modern.colors.text); // the defining difference vs Classic
    expect(getTheme('classic').colors.accent).toBe(getTheme('classic').colors.text); // Classic unchanged
  });

  it('R2 parity — Modern on faith-alone holds its own charged==consumed numbers', async () => {
    // Re-locked CONSCIOUSLY for MINI_DR_SUBTITLE_SPACING: renderTitle now spends flat
    // titleSpaceBefore/titleSpaceAfter (Modern 14/6) in lock-step with titleHeightOf, and skips
    // spacing for empty titles. On Modern the corpus counts shift (letter 90 -> 88); reconciliations
    // drop letter 2 -> 1 (the empty-title guard closed a latent drift whose reconciliation happened
    // to fall on a letter page boundary) but stay 2 on kdp-6x9 (there the untitled section's spacing
    // did not straddle a page break, so no reconciliation was riding on it). Both remain <= 2.
    const letter = await new PDFRenderer().render(paginate('modern', LetterPageLayout), { language: 'en' });
    expect(letter.metrics.pageCount).toBe(88);
    expect(letter.metrics.unplannedPageBreaks).toBe(1);

    const kdp = await new PDFRenderer().render(paginate('modern', KDP6x9PageLayout), { language: 'en' });
    expect(kdp.metrics.pageCount).toBe(158); // Modern's own number (Classic is 159 — tighter heading spacing)
    expect(kdp.metrics.unplannedPageBreaks).toBe(2);
  }, 30_000); // renders the 40k-word corpus twice — needs headroom under full-suite parallel load

  it('the accent reaches all three formats (colors.accent exercised by a real theme)', async () => {
    const paginated = paginate('modern', LetterPageLayout);
    const docx = await new DOCXRenderer().render(paginated, { language: 'en' });
    const dstyles = await (await JSZip.loadAsync(docx.output)).file('word/styles.xml')!.async('string');
    expect(dstyles).toContain(ACCENT);
    expect(dstyles).toContain('Helvetica'); // sans heading font

    const epub = await new EPUBRenderer().render(paginated, { language: 'en' });
    const ez = await JSZip.loadAsync(epub.output);
    const css = await ez.file(Object.keys(ez.files).find((n) => n.endsWith('.css'))!)!.async('string');
    expect(css).toMatch(new RegExp(ACCENT, 'i'));
  }, 30_000);

  it('Classic stays byte-unaffected — its export never carries Modern\'s accent', async () => {
    const classicDocx = await new DOCXRenderer().render(paginate('classic', LetterPageLayout), { language: 'en' });
    const cstyles = await (await JSZip.loadAsync(classicDocx.output)).file('word/styles.xml')!.async('string');
    expect(cstyles).not.toContain(ACCENT);
  }, 30_000);
});
