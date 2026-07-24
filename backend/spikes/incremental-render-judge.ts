/**
 * INCREMENTAL_RENDER (P1) — the JUDGE's ENGINE-TIMING measurement (DR §3 point 1): the engine
 * contribution of "edit → visible" (paginate + region render, EXCLUDING the 500 ms debounce and the
 * frontend transfer/paint) must be ≤ 300 ms hot on the EDITED founder book 3. Read-only on the store.
 *
 * The "real gesture" is a CONTENT edit: it invalidates the pagination cache by construction (the book's
 * md5 changes), so the honest engine cost is a fresh paginate (cache MISS) + a region render of the
 * visible window (visible ± 1). We measure exactly that, and print the FULL-render cost beside it as the
 * "before" the chantier set out to beat. Three-page fidelity is the sibling probe
 * (incremental-render-invariant.ts); page identity is not re-measured here.
 *
 * Run: npx tsx spikes/incremental-render-judge.ts   (read-only; the founder store is never written.)
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { resolveTheme } from '../src/domain/themes/getTheme';
import { orderByRole } from '../src/domain/services/orderByRole';
import { ManualLayoutSelector } from '../src/domain/services/ManualLayoutSelector';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { countPdfPages } from '../src/test-utils/extractPdfText';
import type { Book } from '../src/domain/models/Book';
import type { PageLayout } from '../src/domain/models/PageLayout';
import type { PaginatedBook } from '../src/domain/models/PaginatedBook';

const BOOK3 = '1784812181217-cy7m12l0w';
const THRESHOLD_MS = 300;
const ms = (t: bigint) => Number(t) / 1e6;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const themeEngine = new ThemeEngine();
const typo = new TypographyResolver();
const layout = new LayoutEngine(new PdfKitTextMeasurer());
const renderer = new PDFRenderer();

async function main() {
  console.log(`# INCREMENTAL_RENDER — engine-timing judge (edit → visible ≤ ${THRESHOLD_MS} ms, excl. debounce)`);
  const storePath = join(process.cwd(), 'data', 'studio.db');
  if (!existsSync(storePath)) {
    console.log('(no store — book 3 unavailable; run where the founder store exists)');
    process.exit(2);
  }
  const db = new DatabaseSync(storePath, { readOnly: true });
  const rec = db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(BOOK3) as { aggregate: string } | undefined;
  db.close();
  if (!rec) { console.log('book 3 not in store'); process.exit(2); }

  const parsed = JSON.parse(rec.aggregate);
  const book = parsed.book as Book;
  const s = parsed.settings ?? {};
  const themeName: string = s.themeName ?? 'classic';
  const pageLayout: PageLayout = new ManualLayoutSelector().select({ requestedLayoutName: s.layoutName });
  const theme = resolveTheme(themeName, s.accentOverride, s.typographyOverride);
  console.log(`book 3 settings: ${JSON.stringify(s)}`);

  // The pipeline tail (what ExportManuscriptUseCase.paginate does), timed as ONE unit = a cache MISS.
  const withFront = { ...book, frontMatter: new FrontMatterBuilder().build(book) };
  const paginate = (): PaginatedBook => {
    const styled = themeEngine.applyTheme(orderByRole(withFront), theme);
    return layout.paginate(typo.resolve(styled), pageLayout);
  };

  // One full render up front: the true physical total (the caller's `total`) AND the "before" baseline.
  const warm = paginate();
  const total = warm.pages.length;
  const fullBuf = (await renderer.render(warm, { language: book.metadata.language })).output;
  const physical = countPdfPages(fullBuf);

  // The median page and its visible window (visible ± 1) — the region a mid-book edit repaints.
  const mid = Math.round(total / 2);
  const start = Math.max(1, mid - 1);
  const end = Math.min(total, mid + 1);

  // WARM the JIT + font measurer before timing: the threshold is "HOT on book 3" (the living edit loop).
  // The FIRST render in a fresh process is the cold ~1–2 s case that is COLD_RENDER_FIRST_OPEN (welcome,
  // explicitly out of P1 scope) — measuring cold would measure the wrong thing.
  for (let w = 0; w < 3; w++) {
    await renderer.render(paginate(), { language: book.metadata.language });
    await renderer.renderPageRange(paginate(), { language: book.metadata.language }, start, end, physical);
  }

  const N = 9;
  const fullMs: number[] = [];
  const engineMs: number[] = [];
  const paginateMs: number[] = [];
  const regionMs: number[] = [];
  for (let i = 0; i < N; i++) {
    // FULL render (paginate miss + whole-book render) — the "before".
    let t = process.hrtime.bigint();
    const pFull = paginate();
    await renderer.render(pFull, { language: book.metadata.language });
    fullMs.push(ms(process.hrtime.bigint() - t));

    // ENGINE for edit → visible: paginate (cache MISS, as a content edit forces) + region render.
    t = process.hrtime.bigint();
    const pReg = paginate();
    const tRegionStart = process.hrtime.bigint();
    paginateMs.push(ms(tRegionStart - t)); // the paginate share of the engine
    await renderer.renderPageRange(pReg, { language: book.metadata.language }, start, end, physical);
    const now = process.hrtime.bigint();
    regionMs.push(ms(now - tRegionStart)); // the region-render share (candidate 1's own contribution)
    engineMs.push(ms(now - t));
  }

  const fullMed = median(fullMs);
  const engMed = median(engineMs);
  const pagMed = median(paginateMs);
  const regMed = median(regionMs);
  console.log(`\nbook 3: ${total} domain pages, ${physical} physical; window [${start}..${end}] (visible ±1)`);
  console.log(`  FULL render (the "before")            : ${fullMed.toFixed(1)} ms (median of ${N})`);
  console.log(`  ENGINE edit→visible (paginate+region) : ${engMed.toFixed(1)} ms (median of ${N})`);
  console.log(`     ├─ paginate (cache MISS)           : ${pagMed.toFixed(1)} ms  <- pre-existing cost; candidate-3 territory (D5)`);
  console.log(`     └─ region render (candidate 1)     : ${regMed.toFixed(1)} ms  <- the chantier's own contribution`);
  console.log(`  full-render speed-up                  : ${(fullMed / engMed).toFixed(1)}×`);
  console.log(`  engine spread (min…max)               : ${Math.min(...engineMs).toFixed(1)}…${Math.max(...engineMs).toFixed(1)} ms`);
  const pass = engMed <= THRESHOLD_MS;
  console.log(`\n${pass ? 'PASS' : 'FAIL'} — engine ${engMed.toFixed(1)} ms ${pass ? '≤' : '>'} ${THRESHOLD_MS} ms (read-only; store never written).`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
