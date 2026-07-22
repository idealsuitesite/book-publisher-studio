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
    // Re-locked CONSCIOUSLY twice. MINI_DR_SUBTITLE_SPACING: flat title spacing (Modern 14/6)
    // in lock-step, empty titles skip spacing (letter 90 -> 88, reconciliations letter 2 -> 1).
    // Then MINI_DR_BLOCKLESS_TITLES: the blockless §3 section's title is now CHARGED (~38pt on
    // Modern) — the kdp reconciliation that fired *while rendering that title*, stranding an
    // 18pt heading at the bottom of real p.40 (TYPOGRAPHY_QUALITY_SCOPE §1), is GONE: kdp
    // 158/2 -> 157/1, the remaining 1 being paragraph-123's ±1-line bold-run residual — the
    // disclosed class surviving exactly where it genuinely fires. Letter drops 88/1 -> 87/0:
    // its reconciliation was riding the same uncharged title.
    // Re-locked CONSCIOUSLY for FOUNDER_TRAVERSAL defect 2: faith-alone has no author, so the
    // synthesised "© Unknown" copyright page is gone — one planned front-matter page fewer in the
    // rendered count (letter 87 -> 86, kdp 157 -> 156). Reconciliations unaffected.
    const letter = await new PDFRenderer().render(paginate('modern', LetterPageLayout), { language: 'en' });
    expect(letter.metrics.pageCount).toBe(86);
    expect(letter.metrics.unplannedPageBreaks).toBe(0);

    const kdp = await new PDFRenderer().render(paginate('modern', KDP6x9PageLayout), { language: 'en' });
    expect(kdp.metrics.pageCount).toBe(156); // Modern's own number, never Classic's
    expect(kdp.metrics.unplannedPageBreaks).toBe(1); // paragraph-123, the ±1-line residual class
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
