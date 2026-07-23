/**
 * FOUNDER_TRAVERSAL_3 — read-only measurement of book 3 "Rachat et expiation bibliques 2"
 * (project 1784812181217-cy7m12l0w). The founder's reported findings (46 suggestions, "Conclusion"
 * ×11, a duplicate CHAPTER 8, an "Untitled" TOC entry, numbered sub-chapters 1–6) were seen on the
 * FRESH IMPORT before his 22 edits; his current stored state has already been restructured. So this
 * measures BOTH: the fresh re-import (what the panel showed him) and the current stored aggregate.
 * SELECT/blob read only; never a write. Run: npx tsx spikes/founder3-measure.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { CleanupSuggester } from '../src/domain/services/structureCleanup/CleanupSuggester';
import { StructureSuggester } from '../src/domain/services/structureAssist/StructureSuggester';
import { classifyMarker } from '../src/domain/services/structureAssist/structureTaxonomy';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import { createValidationEngine } from '../src/domain/services/validation/createValidationEngine';
import type { Book, Content, Section, Block, TableOfContents } from '../src/domain/models/Book';

const BOOK3 = '1784812181217-cy7m12l0w';
const words = (b: Block[] | undefined) => (b ?? []).reduce((n, x) => n + ((x as { text?: string }).text ? (x as { text: string }).text.trim().split(/\s+/).filter(Boolean).length : 0), 0);

async function importFrom(buffer: Buffer): Promise<Book> {
  const raw = await new MammothParser().parse(buffer);
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'book3.docx' }));
}

function tocOf(book: Book): { level: number; title: string }[] {
  const toc: TableOfContents = { generateAutomatically: true, entries: [] };
  const withToc: Book = { ...book, frontMatter: { ...book.frontMatter, toc } };
  const styled = new ThemeEngine().applyTheme(withToc, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  const warn = console.warn; console.warn = () => {};
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
  console.warn = warn;
  return (paginated.tableOfContents ?? []).map((e) => ({ level: e.level, title: e.title }));
}

function dumpStructure(label: string, book: Book) {
  const entries = book.mainContent as Content[];
  console.log(`\n---- ${label}: ${entries.length} top-level entries ----`);
  entries.forEach((c, i) => {
    const m = classifyMarker(c.title ?? '');
    const secs = (c as { sections?: Section[] }).sections?.length ?? 0;
    const titleShown = c.title === '' ? '«empty»' : (c.title === undefined ? '«undefined»' : `"${c.title.slice(0, 34)}"`);
    console.log(`  [${String(i).padStart(2)}] ${titleShown}  ownW=${words(c.content)} sec=${secs}  marker=${m ? m.kind : '-'}`);
  });
}

function suggestReport(label: string, book: Book) {
  const s = new CleanupSuggester().suggest(book);
  const byText = new Map<string, number>();
  for (const x of s) byText.set(x.markerText.trim(), (byText.get(x.markerText.trim()) ?? 0) + 1);
  const repeated = [...byText.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  console.log(`\n[${label}] cleanup suggestions: ${s.length}; distinct texts: ${byText.size}; repeated: ${JSON.stringify(repeated)}`);
  const concl = s.filter((x) => /^conclusion$/i.test(x.markerText.trim()));
  if (concl.length) {
    console.log(`  "Conclusion" ×${concl.length} — a real book has ONE; each → its following title:`);
    concl.slice(0, 12).forEach((x) => console.log(`     → "${x.targetTitle.slice(0, 44)}"`));
  }
  return s.length;
}

function tocReport(label: string, book: Book) {
  const toc = tocOf(book);
  const counts = new Map<string, number>();
  for (const e of toc) counts.set(e.title.trim(), (counts.get(e.title.trim()) ?? 0) + 1);
  const dups = [...counts.entries()].filter(([, n]) => n > 1);
  const blank = toc.filter((e) => !e.title || !e.title.trim() || /^untitled$/i.test(e.title.trim()));
  console.log(`\n[${label}] TOC entries: ${toc.length}; DUPLICATE titles: ${JSON.stringify(dups.slice(0, 12))}`);
  console.log(`  blank/untitled TOC entries: ${blank.length} ${blank.length ? JSON.stringify(blank.slice(0, 6)) : ''}`);
  // Origin of a blank entry: a whitespace (truthy) title passes the `if (content.title)` gate.
  const wsTitles = (book.mainContent as Content[]).filter((c) => c.title && !c.title.trim()).length;
  console.log(`  source top-level titles that are whitespace-only (truthy but blank → a TOC row): ${wsTitles}`);
}

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const rec = db.prepare('SELECT aggregate, version_count FROM projects WHERE id = ?').get(BOOK3) as { aggregate: string; version_count: number };
  const blobRow = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(BOOK3) as { bytes: Buffer | Uint8Array } | undefined;
  db.close();
  const storedBook = JSON.parse(rec.aggregate).book as Book;

  console.log(`book 3 "${storedBook.metadata.title}" — stored version_count=${rec.version_count}`);

  // ===== The FRESH IMPORT (what the founder's panel showed BEFORE his edits) =====
  let fresh: Book | undefined;
  if (blobRow) {
    fresh = await importFrom(Buffer.isBuffer(blobRow.bytes) ? blobRow.bytes : Buffer.from(blobRow.bytes));
    dumpStructure('FRESH IMPORT (pre-edit state)', fresh);
    // Book 3 imports UNDER-structured (1 entry, ~46k words) → the ASSIST suggester is what the
    // founder's "Make chapter" panel ran (46 suggestions, "Conclusion" ×11), NOT cleanup.
    console.log('\n════ A2 — SUGGESTION_PRECISION_ON_BOOK_3 — the ASSIST suggester on the fresh import ════');
    const assist = new StructureSuggester().suggest(fresh);
    const byEv = new Map<string, number>();
    for (const s of assist) byEv.set(s.proposedTitle.trim(), (byEv.get(s.proposedTitle.trim()) ?? 0) + 1);
    const rep = [...byEv.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
    console.log(`ASSIST suggestions: ${assist.length}; distinct proposed titles: ${byEv.size}; REPEATED: ${JSON.stringify(rep)}`);
    const byKind: Record<string, number> = {};
    for (const s of assist) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    console.log(`  kind split: ${JSON.stringify(byKind)}`);
    // Genuine vs likely-false: a book has ONE Introduction/Conclusion; repeated editorial names are
    // per-chapter sub-headings (sub-structure), NOT book-level chapters → chapter-level false positives.
    const editorialRepeats = rep.filter(([t]) => classifyMarker(t)?.kind === 'editorial');
    const falseFromRepeats = editorialRepeats.reduce((n, [, c]) => n + (c - 1), 0);
    console.log(`  repeated EDITORIAL names (a book has one each): ${JSON.stringify(editorialRepeats)} → ~${falseFromRepeats} chapter-level FALSE positives from these alone`);
    console.log(`  → PRECISION: of ${assist.length} proposals, the CHAPTER n markers are genuine chapters; the repeated editorial names + bare numbered sub-items are sub-structure the author does NOT want as separate chapters (Lot B).`);
    console.log('\n════ A4 — TOC_DUPLICATE_AND_UNTITLED (fresh import) ════');
    tocReport('fresh', fresh);
  } else {
    console.log('no source blob — cannot reproduce the fresh-import state');
  }

  // ===== The CURRENT stored state (after his 22 edits) =====
  console.log('\n════ CURRENT STORED STATE (after 22 edits) ════');
  dumpStructure('CURRENT stored', storedBook);
  suggestReport('current', storedBook);
  tocReport('current', storedBook);

  // ===== B5 — subchapter signals: what the ASSIST proposes to promote, categorised =====
  console.log('\n════ B5 — SUBCHAPTER_PROMOTION (signals, cadrage) ════');
  if (fresh) {
    const assist = new StructureSuggester().suggest(fresh);
    const chapterN = assist.filter((s) => classifyMarker(s.proposedTitle)?.kind === 'numbered-chapter');
    const editorial = assist.filter((s) => classifyMarker(s.proposedTitle)?.kind === 'editorial');
    // Is a proposal a BARE numbered sub-item ("1.", "2 …", "A.") rather than "CHAPTER n"?
    const bareSub = assist.filter((s) => /^\s*(\d{1,2}|[A-Za-z])\s*[.)]/.test(s.evidence.trim()) && classifyMarker(s.proposedTitle)?.kind !== 'numbered-chapter');
    console.log(`  assist proposals: ${assist.length} — CHAPTER n (chapter-level): ${chapterN.length}; editorial names: ${editorial.length}; bare numbered/lettered sub-items: ${bareSub.length}`);
    console.log(`  sample CHAPTER n evidences: ${JSON.stringify(chapterN.slice(0, 4).map((s) => s.evidence.slice(0, 18)))}`);
    console.log(`  sample editorial evidences: ${JSON.stringify(editorial.slice(0, 6).map((s) => s.evidence.slice(0, 18)))}`);
    console.log(`  sample bare-sub evidences: ${JSON.stringify(bareSub.slice(0, 8).map((s) => s.evidence.slice(0, 18)))}`);
    console.log(`  → DISTINGUISHING SIGNALS the founder means: (1) lexical form — "CHAPTER n" vs a bare "1."/"A." vs an editorial NAME; (2) an editorial name REPEATED (11× "Conclusion") is per-chapter sub-structure, never 11 book chapters; (3) position — a sub-item sits in a RUN after a chapter marker. A "make sub-section instead of chapter" proposal is feasible on (1)+(2); (3) needs the chapter context.`);
  }

  // ===== A1 — the per-mutation validation cost (the latency source) =====
  console.log('\n════ A1 — per-mutation ValidationEngine cost (GetProjectUseCase, every edit) ════');
  const engine = createValidationEngine();
  const runs = [0, 0, 0].map(() => { const t = performance.now(); engine.validate({ book: storedBook }); return performance.now() - t; });
  console.log(`  ValidationEngine.validate on the ${storedBook.mainContent.length}-entry book: ${runs.map((r) => r.toFixed(0) + 'ms').join(', ')}`);
  console.log(`  every mutation return recomputes this on the whole book; "Collapse all" = N sequential round-trips + a ~${Math.round(rec.aggregate.length / 1024)}KB save each.`);
}

main();
