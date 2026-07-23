/**
 * SUBCHAPTER_PROMOTION — the JUDGE (SUBCHAPTER_PROMOTION_DR §4 + §6b, the CTO's mandatory end-stop).
 * Read-only, in-memory (never persists). Two judges:
 *   (1) the GESTURE COUNTER — N recurring "Conclusion" → 1 "make all sub-sections" (labour saved);
 *   (2) the RENDERED PAGE — apply the collapses and verify on REAL pages that an end-of-chapter
 *       section does NOT break pagination, does NOT steal the next chapter's drop cap (Novel), and
 *       does NOT appear as a chapter (it is a level-2 section; the chapter count is unchanged).
 * Run on the founder's book 3 (stored state — chapters already promoted). PRIVATE_MANUSCRIPT_FIXTURES:
 * the real proof lives here in the probe, the CI lock is the synthetic tests.
 * Run: npx tsx spikes/structure-subchapter-judge.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { BookEditingService } from '../src/domain/services/BookEditingService';
import { SubchapterSuggester } from '../src/domain/services/structureSubchapter/SubchapterSuggester';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import { blockTypographyKey } from '../src/shared/utils/typographyKeys';
import type { Book, Content, Chapter, Section, Block } from '../src/domain/models/Book';

const BOOK3 = '1784812181217-cy7m12l0w';
const chapters = (b: Book) => (b.mainContent as Content[]).filter((c) => c.type === 'chapter' && !(c as { partOpener?: true }).partOpener).length;
const sections = (b: Book) => (b.mainContent as Content[]).reduce((n, c) => n + (c.type === 'chapter' ? (c.sections?.length ?? 0) : 0), 0);

function paginate(book: Book, themeName: string) {
  const withFront: Book = { ...book, frontMatter: book.frontMatter ?? new FrontMatterBuilder().build(book) };
  const styled = new ThemeEngine().applyTheme(withFront, getTheme(themeName));
  const resolved = new TypographyResolver().resolve(styled);
  const warn = console.warn; console.warn = () => {};
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(resolved, KDP6x9PageLayout);
  console.warn = warn;
  return { paginated, resolved };
}

function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const rec = db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(BOOK3) as { aggregate: string } | undefined;
  db.close();
  if (!rec) { console.log('book 3 not found'); return; }
  const before = JSON.parse(rec.aggregate).book as Book;

  // ---- (1) the gesture counter ----
  const suggestions = new SubchapterSuggester().suggest(before);
  console.log('════ SUBCHAPTER_PROMOTION judge — book 3 (stored) ════');
  console.log(`  recurring editorial sub-headings proposed: ${suggestions.length}  (${JSON.stringify([...new Set(suggestions.map((s) => s.proposedTitle))])})`);
  console.log(`  GESTURE COUNT — by hand: ${suggestions.length} promotions; with B5: 1 ("make all sub-sections")  →  ${suggestions.length} → 1`);

  // ---- apply every promotion in memory, REVERSE document order ----
  // promoteToSubsection is greedy (the marker's following prose migrates in), so a chapter with two
  // recurring markers would see the first swallow the second — going last-first keeps each clean, the
  // assist's "Make all" reverse-order pattern (the panel applies the same way).
  const svc = new BookEditingService();
  let after = before;
  for (const s of [...suggestions].reverse()) after = svc.promoteToSubsection(after, s.blockId);

  // ---- (2a) structure: the chapter count is UNCHANGED; the sections grew ----
  console.log(`\n  chapters: ${chapters(before)} → ${chapters(after)}  ${chapters(before) === chapters(after) ? '✓ UNCHANGED (no peer chapters minted — the founder\'s continuity)' : '✗ CHANGED — investigate'}`);
  console.log(`  sections: ${sections(before)} → ${sections(after)}  (+${sections(after) - sections(before)} the new per-chapter sections)`);

  // ---- (2b) pagination: does it break? compare page count + unplanned breaks ----
  const pBefore = paginate(before, 'classic').paginated;
  const pAfter = paginate(after, 'classic').paginated;
  const unplannedBefore = (pBefore as { renderMetrics?: { unplannedPageBreaks?: number } }).renderMetrics?.unplannedPageBreaks ?? 0;
  const unplannedAfter = (pAfter as { renderMetrics?: { unplannedPageBreaks?: number } }).renderMetrics?.unplannedPageBreaks ?? 0;
  console.log(`\n  pages: ${pBefore.pages.length} → ${pAfter.pages.length}  (a section is a title + its prose, so a modest change is expected, not an explosion)`);
  console.log(`  unplanned page breaks: ${unplannedBefore} → ${unplannedAfter}  ${unplannedAfter <= unplannedBefore + 2 ? '✓ no pagination blow-up' : '⚠ investigate'}`);

  // ---- (2c) drop cap (Novel): the chapter AFTER a new section keeps its own drop cap ----
  const { paginated: pNovel, resolved } = paginate(after, 'novel');
  void pNovel;
  const dropCapOf = (id: string) => resolved.blockTypography[blockTypographyKey(id)]?.dropCap === true;
  // For each chapter, its first own paragraph should still carry the drop cap (a preceding chapter's
  // trailing section must not steal it — the trigger fires on chapter.content[0], unaffected).
  const chaps = (after.mainContent as Content[]).filter((c): c is Chapter => c.type === 'chapter');
  let firstProseDropcaps = 0, checked = 0;
  for (const c of chaps) {
    const firstPara = (c.content as Block[]).find((b) => b.type === 'paragraph' && (b as { text: string }).text.trim());
    if (!firstPara) continue;
    checked += 1;
    if (dropCapOf(firstPara.id)) firstProseDropcaps += 1;
  }
  console.log(`\n  drop cap (Novel) on each chapter's own first prose: ${firstProseDropcaps}/${checked} chapters  (a trailing Conclusion section must not steal the NEXT chapter's ornament)`);
  // And a new Conclusion SECTION's title must NOT carry a chapter-opening drop cap.
  const firstNewSection = chaps.flatMap((c) => c.sections ?? []).find((s: Section) => s.title === 'Conclusion');
  const secFirstPara = firstNewSection ? (firstNewSection.content as Block[]).find((b) => b.type === 'paragraph') : undefined;
  console.log(`  a new "Conclusion" section's first prose drop cap: ${secFirstPara ? dropCapOf(secFirstPara.id) : 'n/a'}  (expected false — a mid-chapter section is not a chapter opening)`);
}

main();
