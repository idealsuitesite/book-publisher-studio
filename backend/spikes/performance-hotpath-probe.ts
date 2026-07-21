/**
 * Corrects performance-pipeline-spike.ts for the REAL server wiring: app.ts constructs ONE
 * PdfKitTextMeasurer + ONE LayoutEngine + ONE PDFRenderer at startup and reuses them across
 * every request. The pipeline spike built a fresh measurer/renderer per run, over-charging the
 * per-request cost with a font parse the singleton server pays only once.
 *
 * Mirrors the Proof/export hot path (ExportProjectUseCase.renderBook: paginate + render on the
 * already-parsed stored book). Run: npx tsx spikes/performance-hotpath-probe.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  // App-startup singletons (exactly app.ts:65, :108).
  const measurer = new PdfKitTextMeasurer();
  const layoutEngine = new LayoutEngine(measurer);
  const renderer = new PDFRenderer();
  const themeEngine = new ThemeEngine();
  const typo = new TypographyResolver();

  // Import once (the Proof never re-parses — ExportProjectUseCase renders the stored book).
  const raw = await new MammothParser().parse(readFileSync(FILE));
  const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' }));
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const theme = getTheme('classic');

  const origWarn = console.warn;
  console.warn = () => {};

  const N = 10;
  const pag: number[] = [];
  const ren: number[] = [];
  let pages = 0;
  for (let i = 0; i < N + 1; i++) {
    // renderBook tail, reusing the singletons — theme/typography are cheap and shared.
    const styled = themeEngine.applyTheme(orderByRole(book), theme);
    const typeset = typo.resolve(styled);

    let t = performance.now();
    const paginated = layoutEngine.paginate(typeset, KDP6x9PageLayout);
    const pMs = performance.now() - t;

    t = performance.now();
    const result = await renderer.render(paginated, { language: book.metadata.language });
    const rMs = performance.now() - t;
    pages = result.metrics.pageCount ?? 0;

    if (i > 0) {
      pag.push(pMs); // run 0 discarded (first-request font parse on the shared measurer)
      ren.push(rMs);
    }
  }
  console.warn = origWarn;

  console.log(`Real singleton wiring — faith-alone, kdp-6x9, ${pages} pages, warm median of ${N} (run 0 discarded)\n`);
  console.log(`  paginate (shared measurer, font parse amortized): ${median(pag).toFixed(1)} ms`);
  console.log(`  render   (fresh PDFDocument each call):           ${median(ren).toFixed(1)} ms`);
  console.log(`  hot-path total (Proof refresh):                   ${(median(pag) + median(ren)).toFixed(1)} ms`);
}

main();
