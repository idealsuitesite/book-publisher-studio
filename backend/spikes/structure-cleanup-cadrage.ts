/**
 * STRUCTURE_CLEANUP — the CADRAGE probe (read-only, stops at the constats). CTO directive
 * 2026-07-23. Measures the founder's book 2 ("The Secret Of Spiritual Protection", over-structured)
 * to answer four questions BEFORE any code, then a silence check on book 1:
 *
 *   Q1 — Of the 0-word top-level chapters, how many are EXACTLY the pattern
 *        "empty CHAPTER n marker followed by a real title" (pattern A, a cleanup target), and how
 *        many are something else — a real title whose prose lives one level down under Heading 2
 *        (pattern B, NOT a cleanup target)? Two distinct forms → two distinct treatments; the
 *        TABLE_DUPLICATION discipline: do not assume a shared cause.
 *   Q2 — The duplicate CHAPTER 3 seen at traversal 2: where is it, and what becomes of it at merge?
 *   Q3 — Does reusing the EXISTING mergeChapterIntoPrevious actually clean a pattern-A pair? Proven
 *        mechanically by SIMULATING the merge in memory (never persisted) and reading the result.
 *   Q4 — The §5 gesture counter: how many author gestures to clean this book by hand today, and
 *        how many after — the judge of the chantier, as for the assist.
 *   Silence — on book 1 (under-structured, now assisted) cleanup must find ~nothing (the bidirectional
 *        pole: cleanup PROPOSES on the over-structured, is SILENT on the under-structured).
 *
 * Read-only: fresh re-import from the stored blob bytes through TODAY'S pipeline (non-negotiable #7,
 * the §5 discipline — never a stale figure), plus a stored-aggregate cross-check. Never a write.
 * Run: npx tsx spikes/structure-cleanup-cadrage.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { BookEditingService } from '../src/domain/services/BookEditingService';
import { classifyMarker } from '../src/domain/services/structureAssist/structureTaxonomy';
import type { Book, Content, Section, Block } from '../src/domain/models/Book';

const BOOK1 = '1784744671298-h9o6o9tn2'; // under-structured (assist's pole)
const BOOK2 = '1784760982271-w4n3yjxxw'; // over-structured (cleanup's pole)

async function importFrom(buffer: Buffer): Promise<Book> {
  const raw = await new MammothParser().parse(buffer);
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'x.docx' }));
}

const wordsOf = (blocks: Block[] | undefined): number =>
  (blocks ?? []).reduce((n, b) => n + ((b as { text?: string }).text ? (b as { text: string }).text.trim().split(/\s+/).filter(Boolean).length : 0), 0);

const sectionWordsOf = (secs: Section[] | undefined): number =>
  (secs ?? []).reduce((n, s) => n + wordsOf(s.content) + sectionWordsOf(s.subsections), 0);

interface Row {
  i: number;
  type: string;
  title: string;
  isMarker: boolean;
  ownWords: number;
  secCount: number;
  secWords: number;
}

function rowsOf(book: Book): Row[] {
  return (book.mainContent as Content[]).map((c, i) => ({
    i,
    type: (c as { partOpener?: true }).partOpener ? 'part-opener' : c.type,
    title: c.title ?? '(untitled)',
    isMarker: !!classifyMarker(c.title ?? ''),
    ownWords: wordsOf(c.content),
    secCount: (c as { sections?: Section[] }).sections?.length ?? 0,
    secWords: sectionWordsOf((c as { sections?: Section[] }).sections),
  }));
}

async function measureBook2() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blob = (db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(BOOK2) as { bytes: Buffer | Uint8Array } | undefined);
  const storedAgg = (db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(BOOK2) as { aggregate: string } | undefined);
  db.close();
  if (!blob) { console.log('book 2 blob not found — cannot measure'); return; }

  const book = await importFrom(Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes));
  const rows = rowsOf(book);

  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('BOOK 2 — "The Secret Of Spiritual Protection" (fresh re-import, today\'s pipeline)');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`top-level entries: ${rows.length}`);
  if (storedAgg) {
    const stored = (JSON.parse(storedAgg.aggregate).book.mainContent as Content[]).length;
    console.log(`stored-aggregate top-level entries: ${stored}  ${stored === rows.length ? '(matches fresh re-import)' : '(DIVERGES — founder edited since import)'}`);
  }

  // ---- Q1 — the pattern split of 0-word top-level chapters ----
  const zeroWordZeroSec = rows.filter((r) => r.ownWords === 0 && r.secCount === 0 && r.type !== 'part-opener');
  const patternA = zeroWordZeroSec.filter((r) => r.isMarker);                 // empty marker heading
  const otherEmpty = zeroWordZeroSec.filter((r) => !r.isMarker);             // empty non-marker title
  const patternB = rows.filter((r) => r.ownWords === 0 && r.secCount > 0);    // real title, prose under H2

  console.log('\n── Q1 — pattern split of the empty top-level chapters ──');
  console.log(`  0-own-word AND 0-section entries: ${zeroWordZeroSec.length}`);
  console.log(`    · PATTERN A (empty MARKER heading — CHAPTER n / editorial name): ${patternA.length}  → cleanup targets`);
  console.log(`        ${JSON.stringify(patternA.map((r) => r.title.slice(0, 20)))}`);
  console.log(`    · OTHER empty (0-word non-marker title): ${otherEmpty.length}`);
  console.log(`        ${JSON.stringify(otherEmpty.map((r) => r.title.slice(0, 24)))}`);
  console.log(`  0-own-word but WITH H2 sections (PATTERN B — real title, prose one level down): ${patternB.length}  → NOT cleanup targets`);
  console.log(`        ${JSON.stringify(patternB.map((r) => `${r.title.slice(0, 18)}[${r.secWords}w/${r.secCount}s]`))}`);

  // For each pattern-A marker, classify the FOLLOWING sibling — this decides how (and whether) a
  // collapse can keep the prose and the real title.
  console.log('\n── Q1b — what FOLLOWS each empty marker (the collapse target) ──');
  const followKinds = { realTitleContent: 0, realTitleSections: 0, anotherMarker: 0, emptyNonMarker: 0, endOrOther: 0 };
  for (const m of patternA) {
    const next = rows[m.i + 1];
    let kind: keyof typeof followKinds;
    if (!next) kind = 'endOrOther';
    else if (next.isMarker) kind = 'anotherMarker';
    else if (next.ownWords === 0 && next.secCount === 0) kind = 'emptyNonMarker';
    else if (next.secCount > 0 && next.ownWords === 0) kind = 'realTitleSections';
    else if (next.ownWords > 0) kind = 'realTitleContent';
    else kind = 'endOrOther';
    followKinds[kind] += 1;
    console.log(`  [${String(m.i).padStart(3)}] "${m.title.slice(0, 16)}" → next [${m.i + 1}] "${(next?.title ?? '(end)').slice(0, 26)}"  ownW=${next?.ownWords ?? '-'} sec=${next?.secCount ?? '-'}  ⇒ ${kind}`);
  }
  console.log(`  follow-kind tally: ${JSON.stringify(followKinds)}`);

  // ---- Q2 — the duplicate CHAPTER 3 ----
  console.log('\n── Q2 — the duplicate CHAPTER 3 ──');
  const numberedTitles = rows.filter((r) => /^chapter\s+/i.test(r.title));
  const byLabel = new Map<string, Row[]>();
  for (const r of numberedTitles) {
    const key = r.title.trim().toLowerCase();
    (byLabel.get(key) ?? byLabel.set(key, []).get(key)!).push(r);
  }
  const dups = [...byLabel.entries()].filter(([, rs]) => rs.length > 1);
  if (!dups.length) console.log('  no duplicate CHAPTER n title found in this re-import');
  for (const [label, rs] of dups) {
    console.log(`  DUPLICATE "${label}" at indices ${JSON.stringify(rs.map((r) => r.i))}:`);
    for (const r of rs) {
      const next = rows[r.i + 1];
      console.log(`    [${r.i}] ownW=${r.ownWords} sec=${r.secCount} → next [${r.i + 1}] "${(next?.title ?? '(end)').slice(0, 30)}" (marker=${next?.isMarker})`);
    }
  }

  // ---- Q3 — does the EXISTING mergeChapterIntoPrevious clean a pattern-A pair? (simulate) ----
  console.log('\n── Q3 — SIMULATE the existing mergeChapterIntoPrevious on a pattern-A pair ──');
  // Pick the first pattern-A marker whose FOLLOWING sibling is a real title (the intended collapse).
  const svc = new BookEditingService(() => 'sim-id');
  const probe = patternA.find((m) => rows[m.i + 1] && !rows[m.i + 1].isMarker);
  if (!probe) {
    console.log('  no marker→real-title pair to simulate');
  } else {
    const markerIdx = probe.i;
    const target = book.mainContent[markerIdx + 1] as Content;   // the real title we WANT to keep
    const marker = book.mainContent[markerIdx] as Content;
    console.log(`  pair: marker [${markerIdx}] "${marker.title}"  +  real title [${markerIdx + 1}] "${target.title}"`);
    console.log(`  target holds: ownWords=${wordsOf(target.content)}  sections=${(target as { sections?: Section[] }).sections?.length ?? 0}  sectionWords=${sectionWordsOf((target as { sections?: Section[] }).sections)}`);
    // mergeChapterIntoPrevious merges the NAMED chapter into its previous sibling → call it on the
    // real title so it merges into the marker. In-memory only; `book` is never persisted.
    try {
      const after = svc.mergeChapterIntoPrevious(book, target.id);
      const merged = after.mainContent[markerIdx] as Content;
      console.log(`  RESULT chapter title after merge: "${merged.title}"  ${merged.title === marker.title ? '← the MARKER survived (real title demoted to a paragraph)' : ''}`);
      console.log(`  RESULT ownWords=${wordsOf(merged.content)}  sections=${(merged as { sections?: Section[] }).sections?.length ?? 0}  sectionWords=${sectionWordsOf((merged as { sections?: Section[] }).sections)}`);
      const targetSecs = (target as { sections?: Section[] }).sections?.length ?? 0;
      const mergedSecs = (merged as { sections?: Section[] }).sections?.length ?? 0;
      if (targetSecs > 0 && mergedSecs === 0) {
        console.log(`  ⚠ DATA LOSS: the real title carried ${targetSecs} H2 section(s) / ${sectionWordsOf((target as { sections?: Section[] }).sections)}w — the merge DROPPED them (it concatenates .content, never .sections).`);
      }
      if (merged.title === marker.title) {
        console.log(`  ⚠ WRONG SURVIVOR: the cleaned chapter kept the marker "${marker.title}", not the real title "${target.title}".`);
      }
    } catch (e) {
      console.log(`  merge threw: ${(e as Error).message}`);
    }
  }

  // ---- Q4 — the gesture counter ----
  console.log('\n── Q4 — the §5 gesture counter (cleanup) ──');
  const targets = patternA.length;
  console.log(`  cleanup targets (empty markers to collapse): ${targets}`);
  console.log(`  BY HAND today: ${targets} collapse gestures + the hunt through ${rows.length} top-level entries`);
  console.log(`  WITH cleanup: 1 "Collapse all markers" gesture (+ per-exception dismiss) — the ${targets}→1 of this chantier`);
  console.log(`  (contingent on Q3: a collapse op that keeps the real title AND its sections — the existing op does not, see above)`);
}

async function silenceCheckBook1() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blob = (db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(BOOK1) as { bytes: Buffer | Uint8Array } | undefined);
  db.close();
  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('BOOK 1 — silence check (under-structured, assist\'s pole; cleanup must be SILENT)');
  console.log('══════════════════════════════════════════════════════════════════════');
  if (!blob) { console.log('  book 1 blob not found'); return; }
  const book = await importFrom(Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes));
  const rows = rowsOf(book);
  const emptyMarkers = rows.filter((r) => r.isMarker && r.ownWords === 0 && r.secCount === 0 && r.type !== 'part-opener');
  console.log(`  top-level entries: ${rows.length}`);
  console.log(`  empty MARKER headings (cleanup targets): ${emptyMarkers.length}  → ${emptyMarkers.length === 0 ? 'SILENT = success (its markers are BODY TEXT, assist\'s job — not empty headings)' : 'UNEXPECTED — investigate'}`);
}

async function main() {
  await measureBook2();
  await silenceCheckBook1();
}

main();
