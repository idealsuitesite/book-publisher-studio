import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MammothParser } from '../infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../domain/services/ASTBuilder';
import { ThemeEngine } from '../domain/services/ThemeEngine';
import { TypographyResolver } from '../domain/services/TypographyResolver';
import { LayoutEngine } from '../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../domain/services/FrontMatterBuilder';
import { getTheme } from '../domain/themes/getTheme';
import { KDP6x9PageLayout } from '../domain/layouts/KDP6x9PageLayout';
import { PDFRenderer } from '../infrastructure/renderers/PDFRenderer';
import { extractPdfRunsByPage, extractPdfPageSignatures, extractPdfText, countPdfPages } from './extractPdfText';

/**
 * POSITIVE CONTROL for extractPdfRunsByPage — the INCREMENTAL_RENDER fidelity invariant depends on
 * this instrument, so it proves itself FIRST (CTO guardrail 2, SOLO_RENDER_VERIFICATION in reverse):
 * an extractor that cannot tell page k from page k+1 would make the invariant green vacuously.
 */
const FIXTURE = join(__dirname, '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');

async function renderFaithAlone(): Promise<Buffer> {
  const raw = await new MammothParser().parse(readFileSync(FIXTURE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'faith.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
  // compress:false so the content streams stay plain text and are extractable (the parity-test rule).
  return (await new PDFRenderer({ compress: false }).render(paginated, { language: 'en' })).output;
}

describe('extractPdfRunsByPage — positive control (licensed before the invariant relies on it)', () => {
  it('groups by visual page, self-identical, page-distinct, and consistent with the whole-doc text', async () => {
    const pdf = await renderFaithAlone();
    const pages = extractPdfRunsByPage(pdf);

    // Count: one runs-group per rendered page.
    expect(pages.length).toBe(countPdfPages(pdf));
    expect(pages.length).toBeGreaterThan(20); // a real book, many pages

    // Self-identity: extracting again yields byte-identical page groups (deterministic instrument).
    const again = extractPdfRunsByPage(pdf);
    const textOf = (p: { text: string }[]) => p.map((r) => r.text).join('');
    const mid = Math.floor(pages.length / 2);
    expect(textOf(again[mid])).toBe(textOf(pages[mid]));

    // Difference: two different body pages are NOT the same text (the vacuous-green guard).
    expect(textOf(pages[mid])).not.toBe(textOf(pages[mid + 1]));
    expect(textOf(pages[mid]).length).toBeGreaterThan(0);

    // Grounding to reality: the per-page text, concatenated in page order, equals the whole-doc text
    // — so "page N" is genuinely page N in document order, not a scrambled index.
    expect(pages.map(textOf).join('')).toBe(extractPdfText(pdf));
  });

  it('the geometry SIGNATURE is per-page, self-identical, and page-distinct (the invariant instrument)', async () => {
    const pdf = await renderFaithAlone();
    const sigs = extractPdfPageSignatures(pdf);

    expect(sigs.length).toBe(countPdfPages(pdf));
    // self-identity: a second extraction is byte-identical (deterministic).
    expect(extractPdfPageSignatures(pdf)).toEqual(sigs);
    // page-distinct: two different body pages have different signatures (the vacuous-green guard —
    // an invariant that passed on identical signatures for every page would be meaningless).
    const mid = Math.floor(sigs.length / 2);
    expect(sigs[mid]).not.toBe(sigs[mid + 1]);
    expect(sigs[mid].length).toBeGreaterThan(0);
  });
});
