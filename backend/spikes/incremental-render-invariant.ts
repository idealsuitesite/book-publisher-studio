/**
 * INCREMENTAL_RENDER (P1) — the THREE-PAGE FIDELITY INVARIANT, run together (DR §3.2, §5 n=2 ruling).
 * The committed unit tests prove page-region ≡ page-export on the corpus (faith-alone) under Classic and
 * Novel. This behavioural probe additionally proves it on the FOUNDER's book 3 — a private manuscript that
 * is NOT committed (PRIVATE_MANUSCRIPT_FIXTURES) — reading its stored aggregate READ-ONLY, never writing.
 *
 * The three pages the CTO named:
 *   • faith-alone drop-cap  — a Novel chapter opening (the 1c chrome), from the committed corpus.
 *   • book-3 median (171)   — a clean mid-content page of the edited book 3 (the 1b path on the real book).
 *   • book-3 continuation   — a split-tail page of book 3 (the 1d seam on the real book, its long paragraphs).
 *
 * The invariant is the subset-INVARIANT geometry signature (extractPdfPageSignatures): a region page's
 * signature must equal the same page's signature in the full export, and must NOT equal a neighbour's.
 * This is decode-independent (the honest guarantee); no reliance on the text extractor, which mangles
 * embedded-font subsets (see the 1c commit / fidelity test).
 *
 * Run: npx tsx spikes/incremental-render-invariant.ts   (read-only; the founder store is never written.)
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
import { ManualLayoutSelector } from '../src/domain/services/ManualLayoutSelector';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { extractPdfPageSignatures, countPdfPages, extractPdfRunsByPage } from '../src/test-utils/extractPdfText';
import type { Book, Content } from '../src/domain/models/Book';
import type { PageLayout } from '../src/domain/models/PageLayout';
import type { TypographyOverride } from '../src/domain/models/Project';
import type { PaginatedBook } from '../src/domain/models/PaginatedBook';

const BOOK3 = '1784812181217-cy7m12l0w';

const themeEngine = new ThemeEngine();
const typo = new TypographyResolver();
const layout = new LayoutEngine(new PdfKitTextMeasurer());

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
};

const layoutSelector = new ManualLayoutSelector();

/**
 * Paginate exactly as ExportManuscriptUseCase.renderBook does (the shared render tail): resolveTheme over
 * the named theme with the per-project accent + typography overrides, orderByRole, applyTheme, resolve,
 * paginate against the project's real PageLayout. So the region-vs-export comparison runs on the SAME
 * bytes the studio would produce for this project — not a stand-in config.
 */
function paginateBook(
  book: Book,
  themeName: string,
  pageLayout: PageLayout = KDP6x9PageLayout,
  accentOverride?: string,
  typographyOverride?: TypographyOverride
): PaginatedBook {
  const withFront = { ...book, frontMatter: new FrontMatterBuilder().build(book) };
  const theme = resolveTheme(themeName, accentOverride, typographyOverride);
  const styled = themeEngine.applyTheme(orderByRole(withFront), theme);
  return layout.paginate(typo.resolve(styled), pageLayout);
}

/** Physical index of the full export's page numbered `n` — located by its footer (ground truth). */
function physicalIndexOf(full: Buffer, n: number, total: number): number {
  const pages = extractPdfRunsByPage(full).map((p) => p.map((r) => r.text).join(''));
  return pages.findIndex((t) => t.includes(`Page ${n} of ${total}`));
}

async function assertRegionEqualsExport(label: string, paginated: PaginatedBook): Promise<void> {
  // Suppress the ADR-0051 reconciliation notices the under-structured book prints.
  const realWarn = console.warn;
  console.warn = () => {};
  const renderer = new PDFRenderer({ compress: false });
  const full = (await renderer.render(paginated, { language: paginated.styledBook.book.metadata.language })).output;
  const total = countPdfPages(full);
  const exportSig = extractPdfPageSignatures(full);

  const chapterStarts = new Set<string>();
  const collect = (cs: Content[]) => cs.forEach((c) => {
    if (c.type === 'chapter' && c.content[0]) chapterStarts.add(c.content[0].id);
    if (c.type === 'chapter' && c.sections) collect(c.sections);
    if (c.type === 'section' && c.subsections) collect(c.subsections);
  });
  collect(paginated.styledBook.book.mainContent as Content[]);

  // The clean median: a mid-content page nearest the middle that is not a chapter opening, not a
  // continuation, and does not split its own tail (so [n,n] is one page).
  const middle = Math.round(paginated.pages.length / 2);
  const isClean = (i: number) => {
    const p = paginated.pages[i];
    return !!p && p.blocks.length > 0 && !p.startsWithContinuation && !p.splitAfterLines &&
      !(p.blankPagesBefore ?? 0) && !chapterStarts.has(p.blocks[0]!);
  };
  let medianIdx = -1;
  for (let d = 0; d < paginated.pages.length; d++) {
    if (isClean(middle + d)) { medianIdx = middle + d; break; }
    if (isClean(middle - d)) { medianIdx = middle - d; break; }
  }

  // A continuation page whose split completes on it (region = one page).
  const contPage = paginated.pages.find(
    (p) => p.startsWithContinuation && !p.splitAfterLines && p.blocks.length > 0 && !chapterStarts.has(p.blocks[0]!)
  );

  const one = async (kind: string, n: number) => {
    const region = (await renderer.renderPageRange(paginated, { language: paginated.styledBook.book.metadata.language }, n, n, total)).output;
    const regionSig = extractPdfPageSignatures(region);
    const idx = physicalIndexOf(full, n, total);
    const ok = countPdfPages(region) === 1 && regionSig.length === 1 && idx >= 0 &&
      regionSig[0] === exportSig[idx] && regionSig[0] !== exportSig[idx - 1] && regionSig[0] !== exportSig[idx + 1];
    check(`${label} — ${kind} page ${n} (of ${total}) region ≡ export`, ok);
  };

  console.log(`\n[${label}] ${paginated.pages.length} domain pages, ${total} physical`);
  // The DR named page 171 as the book-3 median (an earlier state). The founder edited book 3 since, so
  // the pagination shifted; test 171 LITERALLY anyway — the invariant must hold on any page type — and
  // also the current clean median, so the "median 171" line is honoured AND the drift is visible.
  if (paginated.pages.length >= 171) {
    const p171 = paginated.pages[170];
    const kind = p171.startsWithContinuation ? 'continuation' : (chapterStarts.has(p171.blocks[0] ?? '') ? 'opening' : 'clean');
    await one(`DR-named 171 [now ${kind}]`, 171);
  }
  if (medianIdx >= 0) await one('current clean median', paginated.pages[medianIdx].number);
  else check(`${label} — a clean median page exists`, false);
  if (contPage) await one('continuation', contPage.number);
  else check(`${label} — a continuation page exists`, false);

  console.warn = realWarn;
}

async function main() {
  console.log('# INCREMENTAL_RENDER — three-page fidelity invariant (region ≡ export), run together');

  // faith-alone drop-cap opening (Novel) — the committed corpus proof, replayed here for the "together" gate.
  const faithPath = join(process.cwd(), 'verification', 'corpus', 'faith-alone-styled.docx');
  if (existsSync(faithPath)) {
    const raw = await new MammothParser().parse(readFileSync(faithPath));
    const built = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'faith.docx' }));
    const paginated = paginateBook(built, 'novel');
    // drop-cap opening: the invariant on the exact 1c page (first clean drop-cap chapter opening).
    const renderer = new PDFRenderer({ compress: false });
    const full = (await renderer.render(paginated, { language: 'en' })).output;
    const total = countPdfPages(full);
    const exportSig = extractPdfPageSignatures(full);
    const dropCap = paginated.styledBook.blockTypography ?? {};
    const chapterFirst = new Set<string>();
    const collect = (cs: Content[]) => cs.forEach((c) => {
      if (c.type === 'chapter' && c.content[0]) chapterFirst.add(c.content[0].id);
      if (c.type === 'chapter' && c.sections) collect(c.sections);
      if (c.type === 'section' && c.subsections) collect(c.subsections);
    });
    collect(paginated.styledBook.book.mainContent as Content[]);
    const opening = paginated.pages.find((p) => {
      const f = p.blocks[0];
      return !!f && chapterFirst.has(f) && !!(dropCap[f] as { dropCap?: boolean } | undefined)?.dropCap &&
        !p.splitAfterLines && !(p.blankPagesBefore ?? 0) && !p.startsWithContinuation;
    });
    console.log(`\n[faith-alone Novel] ${paginated.pages.length} domain pages, ${total} physical`);
    if (opening) {
      const n = opening.number;
      const region = (await renderer.renderPageRange(paginated, { language: 'en' }, n, n, total)).output;
      const regionSig = extractPdfPageSignatures(region);
      const idx = physicalIndexOf(full, n, total);
      check(`faith-alone drop-cap opening page ${n} region ≡ export`,
        countPdfPages(region) === 1 && regionSig[0] === exportSig[idx] && regionSig[0] !== exportSig[idx + 1]);
    } else check('faith-alone drop-cap opening exists', false);
  }

  // book 3 — the founder's edited stored aggregate (his structured state, read-only).
  const storePath = join(process.cwd(), 'data', 'studio.db');
  if (existsSync(storePath)) {
    const db = new DatabaseSync(storePath, { readOnly: true });
    const rec = db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(BOOK3) as { aggregate: string } | undefined;
    const ver = db.prepare('SELECT COUNT(*) AS n FROM versions WHERE project_id = ?').get(BOOK3) as { n: number } | undefined;
    db.close();
    if (rec) {
      const parsed = JSON.parse(rec.aggregate);
      const stored = parsed.book as Book;
      const s = parsed.settings ?? {};
      console.log(`\n(book 3 loaded read-only; version rows = ${ver?.n ?? '?'}; settings ${JSON.stringify(s)})`);
      // Render with the founder's OWN settings — theme/layout/typography/accent — so the invariant runs
      // on the exact bytes the studio produces for book 3, not a stand-in config.
      const pageLayout = layoutSelector.select({ requestedLayoutName: s.layoutName });
      await assertRegionEqualsExport(
        `book 3 (${s.themeName ?? 'classic'}/${s.layoutName ?? 'letter'})`,
        paginateBook(stored, s.themeName ?? 'classic', pageLayout, s.accentOverride, s.typographyOverride)
      );
    } else {
      check('book 3 present in store', false);
    }
  } else {
    console.log('\n(no store at data/studio.db — book 3 invariant skipped)');
  }

  console.log(`\n${failures === 0 ? 'ALL GREEN' : `${failures} FAILURE(S)`} — read-only; the founder store was never written.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
