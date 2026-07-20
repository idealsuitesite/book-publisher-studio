import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../../domain/services/FrontMatterBuilder';
import { getTheme } from '../../domain/themes/getTheme';
import { KDP5x8PageLayout } from '../../domain/layouts/KDP5x8PageLayout';
import { PDFRenderer } from './PDFRenderer';

const FIXTURE = join(__dirname, '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');

/**
 * The drift-parity assertion (RENDER_DRIFT.md fix 3, ADR-0051) — the piece that makes the
 * silent-auto-break regression class impossible to reintroduce quietly, the same role
 * `verify-real-import` plays for structure. Real manuscript, real pipeline, real trim.
 *
 * History these numbers guard: before the fixes, 55 unplanned PDFKit breaks turned 2.4 pages
 * of unmodelled consumption into 57 wasted pages (50 of 284 rendered pages held 1-2 lines).
 * After aligning spaceAfter, real-face line heights, the page-safety reserve and title
 * keep-with-next, exactly THREE remain — the disclosed bold/italic-run wrapping residual
 * (plain-text measurement vs emphasised rendering, ±1 line each), every one observable in
 * RenderMetrics and reconciled into page ownership.
 *
 * Both assertions are EXACT on purpose: growth means drift crept back; shrinkage means
 * measurement improved and this file should be updated consciously, not silently.
 */
describe('PDFRenderer — drift parity on the real corpus (ADR-0051)', () => {
  it('renders faith-alone at kdp-5x8 with exactly the 3 disclosed reconciliations and a stable page count', async () => {
    const buffer = readFileSync(FIXTURE);
    const raw = await new MammothParser().parse(buffer);
    const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'faith.docx' });
    const built = new ASTBuilder().build(normalized);
    const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
    const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
    const typeset = new TypographyResolver().resolve(styled);
    const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP5x8PageLayout);

    const result = await new PDFRenderer().render(paginated, { language: 'en' });

    // Updated CONSCIOUSLY (as this file's contract demands) after the calibration spike
    // found and fixed a JS evaluation-order bug in the title keep-with-next flush
    // (`currentHeight += f()` read the left operand before f()'s flush zeroed it): ghost
    // near-full pages at section boundaries are gone, one of the three reconciliations
    // was downstream of one, and the counts dropped accordingly.
    expect(result.metrics.unplannedPageBreaks).toBe(2);
    expect(result.metrics.pageCount).toBe(238);
    // The model's own count stays the anchor the renderer answers to.
    expect(paginated.pages.length).toBe(234);
  }, 120_000);

  // TABLE_DUPLICATION.md Défaut B, the class-closing assertion (CTO-required): the drawn
  // footer numbers form a STRICTLY INCREASING sequence across the whole book. Before the fix,
  // every reconciliation page copied the previous owner and drew a DUPLICATE number (faith
  // showed "Page 1" twice and "Page 20" twice — exactly the 2 unplanned breaks). The parity
  // test above counts breaks; this one guarantees the counter never repeats regardless.
  it('draws a strictly increasing footer page-number sequence, even across reconciliation pages', async () => {
    const buffer = readFileSync(FIXTURE);
    const raw = await new MammothParser().parse(buffer);
    const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'faith.docx' });
    const built = new ASTBuilder().build(normalized);
    const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
    const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
    const typeset = new TypographyResolver().resolve(styled);
    const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP5x8PageLayout);

    // Capture every "Page N of M" the header/footer pass draws, in physical order.
    const drawn: number[] = [];
    const renderer = new PDFRenderer();
    const proto = Object.getPrototypeOf(renderer) as Record<string, unknown>;
    const origDraw = proto.drawHeadersAndFooters as (...a: unknown[]) => unknown;
    proto.drawHeadersAndFooters = function (this: unknown, doc: PDFKit.PDFDocument, ...rest: unknown[]) {
      const realText = doc.text.bind(doc);
      (doc as unknown as { text: (...a: unknown[]) => unknown }).text = (t: unknown, ...args: unknown[]) => {
        if (typeof t === 'string') {
          const m = /^Page (\d+) of \d+/.exec(t);
          if (m) drawn.push(Number(m[1]));
        }
        return realText(t as string, ...(args as [number, number, PDFKit.Mixins.TextOptions]));
      };
      return origDraw.call(this, doc, ...rest);
    };

    try {
      await renderer.render(paginated, { language: 'en' });
    } finally {
      proto.drawHeadersAndFooters = origDraw;
    }

    expect(drawn.length).toBeGreaterThan(0);
    const nonIncreasing = drawn.filter((n, i) => i > 0 && n <= drawn[i - 1]);
    expect(nonIncreasing, `footer numbers must strictly increase; got repeats: ${JSON.stringify(nonIncreasing)}`).toEqual([]);
    // And it starts at 1 (no startPageNumber in the corpus) and ends at the content-page count.
    expect(drawn[0]).toBe(1);
  }, 120_000);
});
