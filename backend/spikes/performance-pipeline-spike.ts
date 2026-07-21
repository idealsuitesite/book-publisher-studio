/**
 * Performance (S13) scoping measurement — where does the export time actually go?
 * Produces data, decides nothing. Run:
 *   npx tsx spikes/performance-pipeline-spike.ts
 *
 * Times every stage of the REAL export pipeline (ExportManuscriptUseCase.execute +
 * renderBook) on each real corpus manuscript, so the ~600ms figure (Sprint 7 Commit 10)
 * can be split across parse / normalize / build / theme / typography / paginate / render.
 *
 * Method:
 *  - Each file is run N+1 times on one layout. Run 0 is COLD (font registration, JIT warmup,
 *    module init). Runs 1..N are WARM; we report the warm MEDIAN per stage (robust to GC blips).
 *  - Nothing is cached between runs on purpose: a fresh PdfKitTextMeasurer + PDFRenderer per run,
 *    exactly as a real request builds them — so the font-registration cost is INSIDE the numbers,
 *    attributed to the stage that pays it (measurer construction -> paginate; renderer -> render).
 *  - Secondary sweep: the largest book across all 6 layouts, total export only, to show how the
 *    cost scales with page count (the render/paginate stages are page-bound).
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
import { countBookWords } from '../src/domain/services/countBookWords';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';
import { A4PageLayout } from '../src/domain/layouts/A4PageLayout';
import { A5PageLayout } from '../src/domain/layouts/A5PageLayout';
import { KDP5x8PageLayout } from '../src/domain/layouts/KDP5x8PageLayout';
import { KDP5_5x8_5PageLayout } from '../src/domain/layouts/KDP5_5x8_5PageLayout';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import type { PageLayout } from '../src/domain/models/PageLayout';
import type { Chapter } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus');

const FILES = [
  'generated-unstyled-3060w.docx',
  'pm-notes-unstyled-fr.docx',
  'art-of-captivating-list-dense.docx',
  'faith-alone-styled.docx',
];

const LAYOUTS: Array<[string, PageLayout]> = [
  ['letter', LetterPageLayout],
  ['a4', A4PageLayout],
  ['a5', A5PageLayout],
  ['kdp-5x8', KDP5x8PageLayout],
  ['kdp-5.5x8.5', KDP5_5x8_5PageLayout],
  ['kdp-6x9', KDP6x9PageLayout],
];

const WARM_RUNS = 6;
const STAGES = ['parse', 'normalize', 'build', 'frontMatter', 'applyTheme', 'typography', 'paginate', 'render'] as const;
type Stage = (typeof STAGES)[number];
type Timing = Record<Stage, number> & { total: number; pages: number };

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const silenceWarn = async <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = orig;
  }
};

/** One full export, timed per stage. Mirrors ExportManuscriptUseCase.execute + renderBook exactly. */
async function runOnce(buffer: Buffer, filename: string, layout: PageLayout): Promise<Timing> {
  const t: Partial<Timing> = {};
  let mark = performance.now();
  const lap = (s: Stage) => {
    const now = performance.now();
    t[s] = now - mark;
    mark = now;
  };

  const raw = await new MammothParser().parse(buffer);
  lap('parse');
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: filename });
  lap('normalize');
  const built = new ASTBuilder().build(normalized);
  lap('build');
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  lap('frontMatter');

  const theme = getTheme('classic');
  const styled = new ThemeEngine().applyTheme(orderByRole(book), theme);
  lap('applyTheme');
  const typeset = new TypographyResolver().resolve(styled);
  lap('typography');
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, layout);
  lap('paginate');
  const result = await silenceWarn(() => new PDFRenderer().render(paginated, { language: book.metadata.language }));
  lap('render');

  const total = STAGES.reduce((sum, s) => sum + (t[s] ?? 0), 0);
  return { ...(t as Record<Stage, number>), total, pages: result.metrics.pageCount ?? 0 };
}

async function main() {
  console.log(`Performance pipeline measurement — Node ${process.version}, ${WARM_RUNS} warm runs, layout kdp-6x9\n`);
  console.log('Per-stage WARM median (ms). Cold = run 0 (font load + JIT). All on classic theme.\n');

  const header =
    'file'.padEnd(30) +
    'words'.padStart(8) +
    'pages'.padStart(7) +
    STAGES.map((s) => s.padStart(11)).join('') +
    'total'.padStart(10) +
    'cold'.padStart(9);
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const file of FILES) {
    const buffer = readFileSync(join(CORPUS, file));

    // build a Book once just for the word/chapter count label (not timed)
    const raw = await new MammothParser().parse(buffer);
    const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: file }));
    const words = countBookWords(built);
    const chapters = built.mainContent.filter((c) => c.type === 'chapter').length;

    const cold = await runOnce(buffer, file, KDP6x9PageLayout);
    const warm: Timing[] = [];
    for (let i = 0; i < WARM_RUNS; i++) warm.push(await runOnce(buffer, file, KDP6x9PageLayout));

    const med = (s: Stage) => median(warm.map((w) => w[s]));
    const medTotal = median(warm.map((w) => w.total));
    const label = `${file.replace('.docx', '').slice(0, 24)} (${chapters}ch)`;
    console.log(
      label.padEnd(30) +
        words.toLocaleString('en-US').padStart(8) +
        String(cold.pages).padStart(7) +
        STAGES.map((s) => med(s).toFixed(1).padStart(11)).join('') +
        medTotal.toFixed(1).padStart(10) +
        cold.total.toFixed(0).padStart(9)
    );
  }

  // Secondary: largest book across all layouts — how does total export scale with page count?
  console.log('\nScaling with page count (faith-alone, warm median total ms per layout):\n');
  const big = readFileSync(join(CORPUS, 'faith-alone-styled.docx'));
  console.log('layout'.padEnd(14) + 'pages'.padStart(7) + 'paginate'.padStart(11) + 'render'.padStart(9) + 'total'.padStart(9));
  console.log('-'.repeat(50));
  for (const [name, layout] of LAYOUTS) {
    const warm: Timing[] = [];
    for (let i = 0; i < WARM_RUNS; i++) warm.push(await runOnce(big, 'faith-alone-styled.docx', layout));
    console.log(
      name.padEnd(14) +
        String(warm[warm.length - 1].pages).padStart(7) +
        median(warm.map((w) => w.paginate)).toFixed(1).padStart(11) +
        median(warm.map((w) => w.render)).toFixed(1).padStart(9) +
        median(warm.map((w) => w.total)).toFixed(1).padStart(9)
    );
  }
}

main();
