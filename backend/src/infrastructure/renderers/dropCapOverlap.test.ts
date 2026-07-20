import { describe, it, expect } from 'vitest';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { PDFRenderer } from './PDFRenderer';
import { getTheme } from '../../domain/themes/getTheme';
import { KDP5x8PageLayout } from '../../domain/layouts/KDP5x8PageLayout';
import { createBook } from '../../domain/models/Book';
import type { Paragraph } from '../../domain/models/Book';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';

/**
 * `DROPCAP_TEXT_OVERLAP` — the fix, asserted on the property that was violated.
 *
 * The defect: the drop-cap glyph was drawn with `{ continued: true }` and the following lines
 * wrapped at the FULL column, starting at the left margin underneath it — "carries" rendered as
 * "ies", four characters painted over and unreadable on every drop-cap paragraph.
 *
 * These tests assert the geometry directly (where text is really placed on the page) rather than
 * a proxy like a page count, because the page count did NOT move: the band is ~9% narrower over
 * two lines, which displaces about 0.18 of a line. A test that watched page counts would have
 * passed both before and after the fix.
 */
const TEXT =
  'Every paragraph in this measurement carries the same words so that the only variable left ' +
  'between the two runs is the drop cap itself, which is exactly what has to be isolated here.';

function paginate(opts: { dropCap: boolean; align?: 'justify'; count?: number }): PaginatedBook {
  const now = new Date();
  const blocks: Paragraph[] = Array.from({ length: opts.count ?? 6 }, (_, i) => ({
    type: 'paragraph' as const,
    id: `p${i}`,
    text: TEXT,
    inlines: [],
    ...(opts.align ? { align: opts.align } : {}),
    ...(opts.dropCap ? { dropCap: true } : {}),
  }));
  const book = createBook({ title: 'Drop Cap', author: 'Test', language: 'en' }, [
    { type: 'chapter' as const, id: 'c1', number: 1, title: 'One', content: blocks, createdAt: now, updatedAt: now },
  ]);
  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, getTheme('classic')));
  return new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP5x8PageLayout);
}

/** Every x coordinate at which the renderer positioned a run of text (PDFKit emits `a b c d x y Tm`). */
function textOriginsX(pdf: Buffer): number[] {
  const raw = pdf.toString('latin1');
  return [...raw.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)].map((m) => Number(m[1]));
}

describe('DROPCAP_TEXT_OVERLAP — the fix', () => {
  it('indents the band beside the glyph: text is placed to the RIGHT of the left margin', async () => {
    const rendered = await new PDFRenderer({ compress: false }).render(paginate({ dropCap: true }), { language: 'en' });
    const margin = KDP5x8PageLayout.marginLeft;
    const origins = textOriginsX(rendered.output);

    // The glyph itself still sits ON the margin...
    expect(origins.some((x) => Math.abs(x - margin) < 0.5)).toBe(true);
    // ...and the band beside it does NOT. This is the assertion the defect would fail: before the
    // fix EVERY line began at the margin, which is why the glyph covered the start of line 2.
    const indented = origins.filter((x) => x > margin + 1);
    expect(indented.length, 'no text was placed beside the glyph - the band is not indented').toBeGreaterThan(0);
  });

  it('places the band far enough right to clear the glyph entirely', async () => {
    const rendered = await new PDFRenderer({ compress: false }).render(paginate({ dropCap: true }), { language: 'en' });
    const measurer = new PdfKitTextMeasurer();
    const theme = getTheme('classic');
    const glyphWidth = measurer.measureWidth('E', { fontSize: theme.fontSizes.body * 2.5, heading: true, theme });
    const margin = KDP5x8PageLayout.marginLeft;

    const indented = textOriginsX(rendered.output).filter((x) => x > margin + 1);
    // Every indented origin must clear the glyph's own advance width - otherwise the ink still
    // overlaps the text, which is the defect itself rather than a smaller version of it.
    for (const x of indented) expect(x).toBeGreaterThanOrEqual(margin + glyphWidth);
  });

  it('charged equals consumed: the model plans no page the renderer does not honour', async () => {
    // R2, measured against OUR post-fix renderer -- deliberately NOT against Word, whose +1 page
    // comes from growing line boxes (its own degraded strategy), not from wrapping text.
    const paginated = paginate({ dropCap: true, count: 120 });
    const rendered = await new PDFRenderer().render(paginated, { language: 'en' });

    expect(rendered.metrics.unplannedPageBreaks).toBe(0);
    expect(rendered.metrics.pageCount).toBe(paginated.pages.length);
    expect(rendered.metrics.degradedDropCaps).toBe(0);
  });

  it('justification survives the drop-cap path, and the band is still indented', async () => {
    // The risk the fix creates: a mid-block width change on justified text. The baseline was
    // clean BEFORE the fix only because no width change existed, so this must be asserted after.
    //
    // Method note, recorded because the first attempt was wrong: this originally asserted a `Tw`
    // word-spacing operator. Measured, PDFKit emits NO `Tw` at all -- for justified or ragged
    // text, with or without a drop cap. It justifies through per-glyph adjustments inside TJ
    // arrays instead, which is visible as a LARGER content stream, not as a new operator. The
    // assertion below tests the property (alignment reaches this path and does real work) rather
    // than the mechanism I had assumed.
    const render = async (align: 'justify' | undefined) =>
      (await new PDFRenderer({ compress: false }).render(paginate({ dropCap: true, align }), { language: 'en' }))
        .output;

    const justified = await render('justify');
    const ragged = await render(undefined);
    const plainJustified = (
      await new PDFRenderer({ compress: false }).render(paginate({ dropCap: false, align: 'justify' }), { language: 'en' })
    ).output;
    const plainRagged = (
      await new PDFRenderer({ compress: false }).render(paginate({ dropCap: false }), { language: 'en' })
    ).output;

    // Alignment must still reach the drop-cap path: justifying changes what is drawn.
    expect(justified.length, 'align was dropped on the drop-cap path').toBeGreaterThan(ragged.length);
    // And it must do comparable work to the ordinary path -- not a token effect on line 1 only.
    const dropDelta = justified.length - ragged.length;
    const plainDelta = plainJustified.length - plainRagged.length;
    expect(dropDelta).toBeGreaterThan(plainDelta * 0.5);

    // The band is still indented under justification.
    expect(textOriginsX(justified).some((x) => x > KDP5x8PageLayout.marginLeft + 1)).toBe(true);
  });
});
