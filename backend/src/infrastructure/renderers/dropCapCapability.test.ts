import { describe, it, expect } from 'vitest';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { PDFRenderer } from './PDFRenderer';
import { getTheme } from '../../domain/themes/getTheme';
import { KDP5x8PageLayout } from '../../domain/layouts/KDP5x8PageLayout';
import { createBook } from '../../domain/models/Book';
import type { Chapter, Paragraph } from '../../domain/models/Book';
import type { Theme } from '../../domain/models/Theme';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';

/**
 * MINI_DR_DROP_CAPS §3 — the capability's instruments (§6 commit 3).
 *
 * 1. PRICING, measured against the renderer (§3.1): a drop-cap book is priced strictly higher
 *    than the same book without the ornament, and the renderer honours every planned page at a
 *    deliberately NON-DEFAULT declared scale. The scale is chosen so that any consumer still
 *    reading the DROP_CAP_SCALE constant — model or renderer — would disagree with the other
 *    side by whole pages and fail here loudly. Charged == consumed is asserted on the real PDF,
 *    never derived from scale arithmetic (the list-prefix lesson, the CTO's closure point).
 *
 * 2. ATOMICITY, made observable (§3.2 — the DROPCAP_PARAGRAPH_ATOMICITY debt): a drop-cap
 *    paragraph longer than a full page cannot split (LayoutEngine excludes it from Phase B,
 *    deliberately); the overflow must surface as a MEASURED reconciliation — counted in
 *    RenderMetrics.unplannedPageBreaks and exactly attributed — never a silent one. The debt
 *    stays uncorrected (CTO decision); this test is the ADR-0051 letter: loud, not fixed.
 *
 * 3. Parity byte-stability (§3.3): the shipped themes declare scope 'none' (pinned in
 *    TypographyResolver.test.ts) and the corpus parity suite re-ran green in this commit's gate;
 *    the resolver-level leak guard below closes the loop inside this file.
 */

const SENTENCE =
  'Every paragraph in this instrument carries the same measured words so the only variable ' +
  'between the priced run and the rendered run is the drop cap itself. ';

/** A deliberately NON-DEFAULT scale (the constant is 2.5): both sides must follow the theme. */
const DECLARED_SCALE = 5;

function themedClassic(scope: 'none' | 'chapterOpening', scale = DECLARED_SCALE): Theme {
  return { ...getTheme('classic'), name: 'dropcap-instrument', presentation: { dropCap: { scope, scale } } };
}

function paginateWith(theme: Theme, chapters: Chapter[]): PaginatedBook {
  const book = createBook({ title: 'Instrument', author: 'Test', language: 'en' }, chapters);
  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, theme));
  return new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP5x8PageLayout);
}

function chapterOf(blocks: Paragraph[]): Chapter {
  const now = new Date();
  return { type: 'chapter', id: 'c1', number: 1, title: 'One', content: blocks, createdAt: now, updatedAt: now };
}

function paragraphs(count: number, opts: { dropCap?: boolean } = {}): Paragraph[] {
  return Array.from({ length: count }, (_, i) => ({
    type: 'paragraph' as const,
    id: `p${i}`,
    text: SENTENCE.trim(),
    ...(opts.dropCap ? { dropCap: true as const } : {}),
  }));
}

describe('drop-cap capability instruments (MINI_DR_DROP_CAPS §3, commit 3)', () => {
  it('§3.1 pricing: a drop-cap book is priced strictly higher, and the renderer honours every planned page at the declared non-default scale', async () => {
    // 120 drop-cap paragraphs (the trigger fires the opener; the deprecated per-block flag,
    // union semantics pinned in commit 2, fires the rest — all at the ONE declared scale). At
    // scale 5 the band is ~3 lines in a column narrowed by the glyph, so each paragraph carries
    // a real extra charge; over 120 instances any model/renderer disagreement about the scale
    // compounds into whole pages and cannot hide in page slack.
    const priced = paginateWith(themedClassic('chapterOpening'), [chapterOf(paragraphs(120, { dropCap: true }))]);
    const plain = paginateWith(themedClassic('none'), [chapterOf(paragraphs(120))]);

    // Strictly higher: the ornament's height is REAL and charged (never free, the §4bis lesson —
    // the earlier "height invariance" was the overlap bug's signature, not evidence of no cost).
    expect(priced.pages.length).toBeGreaterThan(plain.pages.length);

    // Priced at what the renderer really draws — measured on the real PDF at the declared scale.
    const rendered = await new PDFRenderer({ compress: false }).render(priced, { language: 'en' });
    expect(rendered.metrics.unplannedPageBreaks).toBe(0);
    expect(rendered.metrics.pageCount).toBe(priced.pages.length);
    expect(rendered.metrics.degradedDropCaps).toBe(0);

    // The renderer's own side of the knob, pinned geometrically: the band must clear a glyph
    // drawn at the DECLARED scale. unplanned===0 alone would miss the overcharge direction
    // (model at 5, renderer still at 2.5 → underfull pages, no unplanned break); a scale-2.5
    // glyph is ~half this wide, so these origins would sit well short of the bound and fail.
    const margin = KDP5x8PageLayout.marginLeft;
    const theme = themedClassic('chapterOpening');
    const glyphWidth = new PdfKitTextMeasurer().measureWidth('E', {
      fontSize: theme.fontSizes.body * DECLARED_SCALE,
      heading: true,
      theme,
    });
    const origins = [...rendered.output.toString('latin1').matchAll(/1 0 0 1 ([\d.]+) [\d.]+ Tm/g)].map((m) => Number(m[1]));
    const indented = origins.filter((x) => x > margin + 1);
    expect(indented.length).toBeGreaterThan(0);
    for (const x of indented) expect(x).toBeGreaterThanOrEqual(margin + glyphWidth);
  });

  it('§3.2 atomicity: a drop-cap paragraph longer than a full page overflows as a MEASURED reconciliation, never a silent one', async () => {
    // One chapter whose OPENER (trigger-fired, no per-block flag anywhere) is ~3 pages of text.
    // It is excluded from Phase B splitting by design, so the model places it whole and the real
    // flow must exceed the plan — the accepted debt. ADR-0051 requires exactly one thing of it:
    // the overflow is counted and attributed, not silent.
    const longOpener: Paragraph = { type: 'paragraph', id: 'long', text: SENTENCE.repeat(28).trim() };
    const paginated = paginateWith(themedClassic('chapterOpening'), [chapterOf([longOpener])]);
    const rendered = await new PDFRenderer().render(paginated, { language: 'en' });

    expect(rendered.metrics.unplannedPageBreaks).toBeGreaterThanOrEqual(1); // loud…
    // …and exactly attributed: every real page beyond the plan is one counted reconciliation.
    expect(rendered.metrics.pageCount).toBe(paginated.pages.length + rendered.metrics.unplannedPageBreaks!);
    expect(rendered.metrics.degradedDropCaps).toBe(0); // the ornament rendered; the overflow is the debt, not a degradation

    // The debt's boundary, pinned from the other side: the SAME text without the drop-cap rule
    // splits line-granular (Phase B) and reconciles nothing. The theme rule's arrival is what
    // converts a splittable paragraph into the atomic case — that conversion must stay disclosed.
    const splittable = paginateWith(themedClassic('none'), [chapterOf([{ ...longOpener }])]);
    const renderedSplittable = await new PDFRenderer().render(splittable, { language: 'en' });
    expect(renderedSplittable.metrics.unplannedPageBreaks).toBe(0);
  });

  it('§3.3 leak guard: the SHIPPED themes resolve zero drop caps on an ordinary book', () => {
    // The corpus parity numbers are locked by PDFRenderer.parity.test.ts; this closes the same
    // loop at the resolver level — Classic and Modern, as shipped, grow no drop caps anywhere.
    for (const name of ['classic', 'modern']) {
      const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapterOf(paragraphs(3))]);
      const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, getTheme(name)));
      const fired = Object.values(typeset.blockTypography ?? {}).filter((t) => t.dropCap);
      expect(fired, `theme "${name}" grew a drop cap`).toHaveLength(0);
    }
  });
});
