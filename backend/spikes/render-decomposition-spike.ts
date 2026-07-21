/**
 * Performance (S13) — render decomposition ("Savoir avant de toucher", CTO 2026-07-21).
 * READ-ONLY: decomposes PDFRenderer's ~380ms into its real cost centres so the CTO can decide
 * whether a safe optimisation target even exists before any Design Review. No production code.
 * Run: npx tsx spikes/render-decomposition-spike.ts
 *
 * Method — two complementary decompositions of the SAME render (faith-alone, kdp-6x9, classic,
 * compress:true exactly as production):
 *
 *  A. PHASES (wall-clock, exact, no instrumentation overhead): the render splits cleanly at
 *     two seams read from PDFRenderer.ts: content (start -> drawHeadersAndFooters), chrome
 *     (the switchToPage loop, :257-:313), finalize (doc.end() -> 'end' event, :263 — font
 *     embedding/subsetting + zlib compression + page flush).
 *  B. METHODS (prototype wrapping, self-time attribution): PDFDocument.prototype methods are
 *     wrapped to accumulate time per category — text drawing (doc.text), font ops
 *     (font/fontSize), page ops (addPage/switchToPage), graphics state (fillColor/fill/stroke/
 *     save/restore/rect/moveTo/lineTo). Wrapping adds overhead (~µs per call), so B is
 *     attribution-quality, not exact; A is the honest total.
 *
 * The addPage-reconciliation interceptor (ADR-0051) is left in place — it is part of the real
 * render cost being measured.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import PDFDocument from 'pdfkit';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { getTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import type { PaginatedBook } from '../src/domain/models/PaginatedBook';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function buildPaginated(): Promise<PaginatedBook> {
  const raw = await new MammothParser().parse(readFileSync(FILE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const styled = new ThemeEngine().applyTheme(orderByRole(book), getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
}

type Cat = 'text' | 'fontOps' | 'pageOps' | 'graphics' | 'finalizeEnd';
const CATEGORIES: Record<Cat, string[]> = {
  text: ['text'],
  fontOps: ['font', 'fontSize'],
  pageOps: ['addPage', 'switchToPage'],
  graphics: ['fillColor', 'fill', 'stroke', 'save', 'restore', 'rect', 'moveTo', 'lineTo', 'moveDown'],
  finalizeEnd: ['end'],
};

interface MethodTotals {
  ms: Record<Cat, number>;
  calls: Record<Cat, number>;
}

/** Wraps the prototype methods for one render; returns totals + an unpatch function. */
function patchPrototype(): { totals: MethodTotals; phaseMarks: { chromeStart?: number }; unpatch: () => void } {
  const totals: MethodTotals = {
    ms: { text: 0, fontOps: 0, pageOps: 0, graphics: 0, finalizeEnd: 0 },
    calls: { text: 0, fontOps: 0, pageOps: 0, graphics: 0, finalizeEnd: 0 },
  };
  const phaseMarks: { chromeStart?: number } = {};
  const proto = PDFDocument.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
  const originals = new Map<string, (...args: unknown[]) => unknown>();

  for (const [cat, methods] of Object.entries(CATEGORIES) as [Cat, string[]][]) {
    for (const name of methods) {
      const orig = proto[name];
      if (typeof orig !== 'function') continue;
      originals.set(name, orig);
      proto[name] = function (this: unknown, ...args: unknown[]) {
        // The first switchToPage marks the content->chrome seam (drawHeadersAndFooters loop).
        if (name === 'switchToPage' && phaseMarks.chromeStart === undefined) {
          phaseMarks.chromeStart = performance.now();
        }
        const t = performance.now();
        const result = orig.apply(this, args);
        totals.ms[cat] += performance.now() - t;
        totals.calls[cat] += 1;
        return result;
      };
    }
  }
  return {
    totals,
    phaseMarks,
    unpatch: () => {
      for (const [name, orig] of originals) proto[name] = orig;
    },
  };
}

async function main() {
  const book = await buildPaginated();
  const origWarn = console.warn;
  console.warn = () => {};

  // ---- A. Phase decomposition (no instrumentation, exact wall-clock) ----
  // Seam capture: first switchToPage = chrome start; 'end' resolution = finalize end. doc.end()
  // is called synchronously right after chrome, so chrome end ~= render() sync return; the
  // remaining await is finalize (font embedding + compression + stream flush).
  const N = 9;
  const phases = { content: [] as number[], chrome: [] as number[], finalize: [] as number[], total: [] as number[] };
  for (let i = 0; i < N + 1; i++) {
    const { phaseMarks, unpatch } = patchPrototype(); // reuse the seam capture only
    const t0 = performance.now();
    const renderer = new PDFRenderer(); // compress:true — production
    const promise = renderer.render(book, { language: 'en' });
    // render() body is synchronous up to doc.end(); the promise resolves on 'end'.
    const tSync = performance.now(); // content+chrome done, finalize (stream) pending
    await promise;
    const t3 = performance.now();
    unpatch();
    if (i === 0) continue; // discard JIT run
    const chromeStart = phaseMarks.chromeStart ?? tSync;
    phases.content.push(chromeStart - t0);
    phases.chrome.push(tSync - chromeStart);
    phases.finalize.push(t3 - tSync);
    phases.total.push(t3 - t0);
  }

  // ---- B. Method attribution (one representative render, wrapped) ----
  const { totals, unpatch } = patchPrototype();
  const tB0 = performance.now();
  await new PDFRenderer().render(book, { language: 'en' });
  const tB1 = performance.now();
  unpatch();
  console.warn = origWarn;

  const pages = 158;
  console.log(`Render decomposition — faith-alone, kdp-6x9, classic, compress:true (production), ${pages} pages\n`);

  console.log(`A. PHASES (exact wall-clock, warm median of ${N}):`);
  const pc = (x: number) => `${((100 * x) / median(phases.total)).toFixed(0)}%`;
  console.log(`   content (blocks: text+fonts+breaks)     ${median(phases.content).toFixed(1).padStart(7)} ms  ${pc(median(phases.content))}`);
  console.log(`   chrome+end (headers/footers + doc.end)  ${median(phases.chrome).toFixed(1).padStart(7)} ms  ${pc(median(phases.chrome))}`);
  console.log(`   post-end tick ('end' event resolution)  ${median(phases.finalize).toFixed(1).padStart(7)} ms  ${pc(median(phases.finalize))}`);
  console.log(`   TOTAL                                   ${median(phases.total).toFixed(1).padStart(7)} ms`);
  console.log(`   NOTE: doc.end() (font embed + zlib) runs SYNCHRONOUSLY inside chrome+end — see B's`);
  console.log(`   finalizeEnd self-time for its isolated cost.\n`);

  console.log(`B. METHOD self-time within one wrapped render (${(tB1 - tB0).toFixed(0)} ms incl. wrap overhead):`);
  for (const cat of Object.keys(CATEGORIES) as Cat[]) {
    console.log(
      `   ${cat.padEnd(10)} ${totals.ms[cat].toFixed(1).padStart(8)} ms   ${String(totals.calls[cat]).padStart(6)} calls`
    );
  }
  const attributed = (Object.values(totals.ms) as number[]).reduce((a, b) => a + b, 0);
  console.log(`   (attributed ${attributed.toFixed(0)} ms of ${(tB1 - tB0).toFixed(0)} ms — the rest is renderer JS + finalize stream)`);
}

main();
