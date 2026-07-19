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

    expect(result.metrics.unplannedPageBreaks).toBe(3);
    expect(result.metrics.pageCount).toBe(246);
    // The model's own count stays the anchor the renderer answers to.
    expect(paginated.pages.length).toBe(241);
  }, 120_000);
});
