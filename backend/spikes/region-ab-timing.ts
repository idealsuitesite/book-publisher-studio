/**
 * M2 timing A/B (AUTHOR_EXPERIENCE_DR M2 graven gate point 3, CTO ruling 2026-07-24) — ENGINE-ONLY
 * decomposition of the post-edit region cost (paginate + region render), on real faith-alone, so the
 * number is comparable to P1's engine-only 155 ms baseline (region render 31 ms + paginate 122 ms on
 * book 3). No HTTP, no PDF.js paint. Paginate is COLD each iteration (no cache) — the real
 * "after an edit the book changed" state. tsx runtime. The dist twin (scratchpad) is byte-identical
 * logic against the COMPILED engine.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { resolveTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';

async function main(): Promise<void> {
  const corpus = join(process.cwd(), 'verification', 'corpus', 'faith-alone-styled.docx');
  const raw = await new MammothParser().parse(readFileSync(corpus));
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'faith.docx' });
  const built = new ASTBuilder().build(normalized);

  const themeEngine = new ThemeEngine();
  const typo = new TypographyResolver();
  const layout = new LayoutEngine(new PdfKitTextMeasurer());
  const renderer = new PDFRenderer();

  const paginate = () => {
    const withFront = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
    const theme = resolveTheme('classic', undefined, undefined);
    const styled = themeEngine.applyTheme(orderByRole(withFront), theme);
    return layout.paginate(typo.resolve(styled), KDP6x9PageLayout);
  };

  // Warm (JIT + font parse) once, off the clock.
  {
    const p = paginate();
    await renderer.render(p, { language: 'en' });
    await renderer.renderPageRange(p, { language: 'en' }, 40, 42, p.pages.length);
  }

  const N = 5;
  const tPag: number[] = [], tReg: number[] = [], tFull: number[] = [];
  let total = 0;
  for (let i = 0; i < N; i++) {
    let t = performance.now();
    const p = paginate(); // COLD paginate — no cache (the post-edit state)
    tPag.push(performance.now() - t);
    total = p.pages.length;
    const mid = Math.max(1, Math.round(total / 2));
    t = performance.now();
    await renderer.renderPageRange(p, { language: 'en' }, mid, Math.min(total, mid + 2), total);
    tReg.push(performance.now() - t);
    t = performance.now();
    await renderer.render(p, { language: 'en' });
    tFull.push(performance.now() - t);
  }
  const med = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const engine = med(tPag) + med(tReg);
  const r = (a: number[]) => a.map((x) => Math.round(x)).join(', ');
  console.log(`\n=== region A/B — ${process.env.RUNTIME_LABEL ?? 'tsx (dev)'} — faith-alone ${total}pg ===`);
  console.log(`paginate (cold)    median ${Math.round(med(tPag))}ms   [${r(tPag)}]`);
  console.log(`region render      median ${Math.round(med(tReg))}ms   [${r(tReg)}]`);
  console.log(`ENGINE (pag+reg)   ${Math.round(engine)}ms   (P1 baseline 155ms; threshold ≤300ms)`);
  console.log(`full render        median ${Math.round(med(tFull))}ms   ratio full/region ${(med(tFull) / med(tReg)).toFixed(1)}x`);
  console.log(engine <= 300 ? 'ENGINE ≤300ms: PASS' : 'ENGINE ≤300ms: OVER');
}

void main();
