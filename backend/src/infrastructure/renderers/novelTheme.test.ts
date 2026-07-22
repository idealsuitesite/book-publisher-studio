/**
 * Novel theme (THIRD_THEME_NOVEL.md) — its OWN parity lock + tri-format verification on the real
 * corpus. The third theme owes its own numbers (never Classic's or Modern's) — and it is the
 * FIRST theme born with drop caps LIT (`chapterOpening` @2.5), so its lock includes the
 * ornament's priced height on all 17 faith-alone openings from day one. Classic and Modern must
 * stay byte-unaffected. A change here means Novel's R2 contract moved.
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
import { CALLOUT_RULE_PT } from '../../domain/services/calloutMetrics';
import type { Book } from '../../domain/models/Book';
import type { PageLayout } from '../../domain/models/PageLayout';

const CORPUS = join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');
const ACCENT = '6E3B2F'; // CTO-VALIDATED on the real page (2026-07-22 screenshot loop): "chaud et sobre", B&W-safe — LOCKED

describe('Novel theme — parity lock (drop caps lit) + tri-format (real corpus)', () => {
  let faith: Book;
  beforeAll(async () => {
    const raw = await new MammothParser().parse(readFileSync(CORPUS));
    const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'faith-alone-styled.docx' });
    const built = new ASTBuilder().build(normalized);
    faith = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  }, 30_000);

  function typesetNovel() {
    return new TypographyResolver().resolve(new ThemeEngine().applyTheme(faith, getTheme('novel')));
  }
  function paginate(themeName: string, layout: PageLayout) {
    const styled = new ThemeEngine().applyTheme(faith, getTheme(themeName));
    const typeset = new TypographyResolver().resolve(styled);
    return new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, layout);
  }

  it('the theme is real and distinct: drop caps LIT (the first), rule-only callouts, chapterTitle running head', () => {
    const novel = getTheme('novel');
    expect(novel.presentation?.dropCap).toEqual({ scope: 'chapterOpening', scale: 2.5 }); // the defining choice
    expect(novel.presentation?.callout).toEqual({ tint: 'none' });
    expect(novel.runningHead?.content).toBe('chapterTitle'); // the first consumer of this value
    // The other residents keep the capability dark — their locks below depend on it.
    expect(getTheme('classic').presentation?.dropCap?.scope).toBe('none');
    expect(getTheme('modern').presentation?.dropCap?.scope).toBe('none');
  });

  it('the trigger fires on all 17 faith-alone openings under Novel — and on ZERO under the other residents', () => {
    const fired = Object.values(typesetNovel().blockTypography ?? {}).filter((t) => t.dropCap).length;
    expect(fired).toBe(17);
  });

  it('R2 parity — Novel on faith-alone holds its own charged==consumed numbers WITH the ornament priced', async () => {
    // Measured 2026-07-22 (PUBLICATION_QUALITY_BAR §10.5), re-locked the same day for
    // MINI_DR_BLOCKLESS_TITLES: charging the blockless §3 section's title (~36pt) re-flowed
    // chapter 3 onward and the ±1-line residual that used to straddle a boundary on both
    // anchors no longer does — letter 90/1 -> 89/0, kdp 161/1 -> 160/0. The residual class is
    // MOVED out of the unlucky straddle by the re-flow, not cured (Modern's kdp anchor still
    // carries its own, same class, still counted). The ornament stays live on all 17 openings,
    // degraded 0 on both anchors.
    // Re-locked CONSCIOUSLY for FOUNDER_TRAVERSAL defect 2: faith-alone has no author, so the
    // synthesised "© Unknown" copyright page is gone — one planned front-matter page fewer in the
    // rendered count (letter 89 -> 88, kdp 160 -> 159). The ornament and reconciliations unchanged.
    const letter = await new PDFRenderer().render(paginate('novel', LetterPageLayout), { language: 'en' });
    expect(letter.metrics.pageCount).toBe(88);
    expect(letter.metrics.unplannedPageBreaks).toBe(0);
    expect(letter.metrics.degradedDropCaps).toBe(0);

    const kdp = await new PDFRenderer().render(paginate('novel', KDP6x9PageLayout), { language: 'en' });
    expect(kdp.metrics.pageCount).toBe(159);
    expect(kdp.metrics.unplannedPageBreaks).toBe(0);
    expect(kdp.metrics.degradedDropCaps).toBe(0);
  }, 60_000); // renders the 40k-word corpus twice under full-suite parallel load

  it('tri-format: Gelasio names + the warm accent + 17 native DOCX drop-cap frames + the EPUB float CSS', async () => {
    const paginated = paginate('novel', LetterPageLayout);

    const docx = await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginated, { language: 'en' });
    const zip = await JSZip.loadAsync(docx.output);
    const styles = await zip.file('word/styles.xml')!.async('string');
    expect(styles).toContain(ACCENT);
    expect(styles).toContain('Georgia'); // both roles serif — the literary identity
    const documentXml = await zip.file('word/document.xml')!.async('string');
    const frames = documentXml.match(/<w:framePr[^>]*w:dropCap="drop"[^>]*\/>/g) ?? [];
    expect(frames).toHaveLength(17); // Word's own drop-cap construct on every opening
    for (const frame of frames) expect(frame).not.toMatch(/w:(w|h|x|y)=/); // the attribute-free native shape

    const epub = await new EPUBRenderer().render(paginated, { language: 'en' });
    const ez = await JSZip.loadAsync(epub.output);
    const css = await ez.file(Object.keys(ez.files).find((n) => n.endsWith('.css'))!)!.async('string');
    expect(css).toMatch(new RegExp(ACCENT, 'i'));
    expect(css).toContain('font-size: 2.5em'); // the declared drop-cap scale reaching the reflowable format
    // Rule-only callout policy: the rule inked in Novel's accent, and NO background rule at all.
    expect(css).toContain(`border-left: ${CALLOUT_RULE_PT}pt solid #${ACCENT}`);
    expect(css).not.toContain('.callout { background');
  }, 30_000);

  it('Classic and Modern stay byte-unaffected — no warm accent, no drop-cap frames in their exports', async () => {
    for (const other of ['classic', 'modern']) {
      const docx = await new DOCXRenderer({ measurer: new PdfKitTextMeasurer() }).render(paginate(other, LetterPageLayout), { language: 'en' });
      const zip = await JSZip.loadAsync(docx.output);
      expect(await zip.file('word/styles.xml')!.async('string')).not.toContain(ACCENT);
      expect(await zip.file('word/document.xml')!.async('string')).not.toContain('w:framePr');
    }
  }, 60_000);
});
