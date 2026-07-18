/**
 * Pagination-fill spike — quantifies the CTO's reported underfill (2026-07-18).
 * Throwaway, NOT part of src/, NOT test-covered. Run: npx tsx spikes/pagination-fill-spike.ts
 *
 * Measures, on the real canonical fixture through the real pipeline:
 *   1. LayoutEngine's estimated height per block vs PDFKit's REAL rendered height at the same
 *      width and font — the estimator error, block by block.
 *   2. The fill ratio of each domain page under the current fit-whole-or-flush algorithm.
 *   3. What the estimator never counts at all (chapter/section titles, inter-block spacing).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { getTheme } from '../src/domain/themes/getTheme';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';
import type { Block, Content } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORDS_PER_LINE = 12; // LayoutEngine.ts:7 — the constant under test

async function main() {
  const buffer = readFileSync(join(__dirname, '..', 'verification', 'large-book.docx'));
  const raw = await new MammothParser().parse(buffer);
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'large-book.docx' });
  const book = new ASTBuilder().build(normalized);
  const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine().paginate(typeset, LetterPageLayout);

  const layout = LetterPageLayout;
  const usableWidth = layout.width - layout.marginLeft - layout.marginRight;
  const usableHeight = layout.height - layout.marginTop - layout.marginBottom;

  // A real PDFKit document with the same default font the renderer's body text uses.
  const doc = new PDFDocument({ size: [layout.width, layout.height] });

  const blocks = new Map<string, Block>();
  const collect = (contents: Content[]): void => {
    for (const c of contents) {
      for (const b of c.content) blocks.set(b.id, b);
      if (c.type === 'chapter' && c.sections) collect(c.sections as unknown as Content[]);
      else if (c.type === 'section' && c.subsections) collect(c.subsections as unknown as Content[]);
    }
  };
  collect(typeset.styledBook ? [] : []); // placeholder, replaced below
  collect((typeset as unknown as { book: { mainContent: Content[] } }).book.mainContent);

  const estimate = (b: Block): number => {
    const style = (typeset as unknown as { blockStyles: Record<string, { fontSize?: number }> }).blockStyles[b.id];
    const fontSize = style?.fontSize ?? 11;
    const lineHeight = 1.5;
    const text = 'text' in b ? (b.text as string) : '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return Math.max(1, Math.ceil(words / WORDS_PER_LINE)) * fontSize * lineHeight;
  };

  const real = (b: Block): number => {
    const style = (typeset as unknown as { blockStyles: Record<string, { fontSize?: number; spaceAfter?: number }> }).blockStyles[b.id];
    const fontSize = style?.fontSize ?? 11;
    doc.fontSize(fontSize);
    const text = 'text' in b ? (b.text as string) : '';
    if (!text) return fontSize * 1.5;
    // NO lineGap: PDFRenderer.renderBlock passes none (line 402-406), so real body lines sit at
    // the font's natural height (~1.15x), not the theme's 1.5 the estimator assumes. Plus
    // moveDown(spaceAfter/fontSize) once per block (line 408).
    return doc.heightOfString(text, { width: usableWidth }) + (style?.spaceAfter ?? 8);
  };

  // 1. Estimator error over text blocks
  let over = 0, under = 0, totalEst = 0, totalReal = 0, n = 0;
  for (const b of blocks.values()) {
    if (!('text' in b) || !(b.type === 'paragraph' || b.type === 'quote' || b.type === 'scripture' || b.type === 'heading')) continue;
    const e = estimate(b), r = real(b);
    totalEst += e; totalReal += r; n++;
    if (e > r * 1.05) over++;
    else if (r > e * 1.05) under++;
  }
  console.log(`Blocks measured: ${n}`);
  console.log(`Estimator vs real (PDFKit heightOfString, same width/size, spaceAfter included):`);
  console.log(`  total estimated: ${Math.round(totalEst)}pt   total real: ${Math.round(totalReal)}pt   ratio est/real: ${(totalEst / totalReal).toFixed(2)}`);
  console.log(`  blocks overestimated >5%: ${over}   underestimated >5%: ${under}`);

  // 2. Per-page fill ratio using REAL heights against the pages the estimator built
  console.log(`\nDomain pages: ${paginated.pages.length}   usable height: ${Math.round(usableHeight)}pt`);
  const ratios: number[] = [];
  for (const page of paginated.pages) {
    const realHeight = page.blocks.reduce((s, id) => {
      const b = blocks.get(id);
      return s + (b ? real(b) : 0);
    }, 0);
    ratios.push(realHeight / usableHeight);
  }
  const underHalf = ratios.filter((r) => r < 0.5).length;
  const under70 = ratios.filter((r) => r < 0.7).length;
  console.log(`  mean real fill: ${(100 * ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(0)}%`);
  console.log(`  pages < 70% full: ${under70}/${ratios.length}   pages < 50% full: ${underHalf}/${ratios.length}`);
  console.log(`  worst 8 pages: ${ratios.map((r, i) => [r, i + 1] as const).sort((a, b) => a[0] - b[0]).slice(0, 8).map(([r, p]) => `p${p}:${(100 * r).toFixed(0)}%`).join('  ')}`);

  // 3. What the estimator never counts
  const chapters = (typeset as unknown as { book: { mainContent: Content[] } }).book.mainContent.filter((c) => c.type === 'chapter');
  console.log(`\nNever estimated at all:`);
  console.log(`  ${chapters.length} chapter titles (renderTitle draws them ~24pt + spacing; LayoutEngine counts 0pt)`);
  console.log(`  inter-block spaceAfter (renderer adds ~8pt/block; estimator adds 0) x ${n} blocks = ~${Math.round(n * 8)}pt = ~${(n * 8 / usableHeight).toFixed(1)} pages of unmodelled space`);

  // 4. The atomicity effect on VARIED prose, which the uniform canonical fixture cannot show.
  // A real book's paragraph lengths vary widely; large-book.docx repeats near-identical ones.
  // Simulate the CURRENT algorithm (fit-whole-or-flush, estimated heights decide, renderer
  // obeys) against a realistic length distribution and measure the fill of the REAL heights.
  console.log('\n=== Varied-prose simulation (what the uniform fixture cannot show) ===');
  // Deterministic pseudo-random (mulberry32) so the spike is reproducible.
  let seed = 42;
  const rand = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Log-normal-ish paragraph lengths: many short, some very long - the shape of real prose.
  const paragraphWords = () => Math.max(8, Math.round(Math.exp(3.2 + 1.0 * (rand() + rand() + rand() - 1.5))));
  const fontSize = 11;
  const estLine = fontSize * 1.5;                       // what the estimator charges per line
  doc.fontSize(fontSize);
  const realLine = doc.heightOfString('x', { width: usableWidth }); // what a line really costs
  const word = 'considération '; // ~13-14 chars incl. space, representative French prose word

  let simPages: number[] = [];
  let cur = 0, curReal = 0, wasted: number[] = [];
  for (let i = 0; i < 600; i++) {
    const words = paragraphWords();
    const estH = Math.max(1, Math.ceil(words / WORDS_PER_LINE)) * estLine;
    const realH = doc.heightOfString(word.repeat(words), { width: usableWidth }) + 8;
    if (cur + estH > usableHeight && cur > 0) {
      simPages.push(curReal / usableHeight);
      cur = 0; curReal = 0;
    }
    cur += estH; curReal += realH;
  }
  if (cur > 0) simPages.push(curReal / usableHeight);
  simPages.forEach((r) => { if (r < 0.7) wasted.push(r); });
  const mean = (100 * simPages.reduce((a, b) => a + b, 0) / simPages.length).toFixed(0);
  console.log(`  600 varied paragraphs -> ${simPages.length} pages, mean REAL fill ${mean}%`);
  console.log(`  pages < 70% full: ${wasted.length}/${simPages.length}`);
  console.log(`  worst 8: ${simPages.map((r, i) => [r, i + 1] as const).sort((a, b) => a[0] - b[0]).slice(0, 8).map(([r, p]) => `p${p}:${(100 * r).toFixed(0)}%`).join('  ')}`);
  console.log(`  per-line cost: estimator ${estLine.toFixed(1)}pt vs real ${realLine.toFixed(1)}pt (${(100 * (estLine / realLine - 1)).toFixed(0)}% overcharge per line)`);
}

main();
