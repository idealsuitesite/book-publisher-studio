/**
 * STRUCTURE_CLEANUP — the JUDGE (STRUCTURE_CLEANUP_DR.md §5, the CTO's mandatory end-stop).
 * Re-measured on the CURRENT state (fresh re-import through today's pipeline, non-negotiable #7).
 * Read-only, in-memory (never persists). Run: npx tsx spikes/structure-cleanup-judge.ts
 *
 *  - POLE OVER (book 2): the detector fires — count, kind split, and the DUPLICATE CHAPTER 3 paired
 *    correctly (build condition 2). The gesture counter: N collapses by hand + the hunt → 1.
 *  - Apply every collapse → the detector is then SILENT (a clean book), and — the founder's OWN
 *    visual judge — the near-blank marker pages are GONE (the render offset of image 5).
 *  - POLE UNDER (book 1): the detector is SILENT (the bidirectional mirror).
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { BookEditingService } from '../src/domain/services/BookEditingService';
import { CleanupSuggester } from '../src/domain/services/structureCleanup/CleanupSuggester';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import type { Book, Content, Section, Block } from '../src/domain/models/Book';

const BOOK1 = '1784744671298-h9o6o9tn2';
const BOOK2 = '1784760982271-w4n3yjxxw';

async function importOf(id: string, db: DatabaseSync): Promise<Book | undefined> {
  const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(id) as { bytes: Buffer | Uint8Array } | undefined;
  if (!blob) return undefined;
  const raw = await new MammothParser().parse(Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes));
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'x.docx' }));
}

const wordsOf = (b: Block) => ((b as { text?: string }).text ? (b as { text: string }).text.trim().split(/\s+/).filter(Boolean).length : 0);

// Count pages carrying (almost) no body words — the title-only marker pages the founder saw.
function nearBlankPages(book: Book): { total: number; nearBlank: number } {
  const blockWords = new Map<string, number>();
  const walk = (c: Content) => {
    for (const b of c.content as Block[]) blockWords.set(b.id, wordsOf(b));
    (c.type === 'chapter' ? (c.sections ?? []) : ((c as Section).subsections ?? [])).forEach(walk);
  };
  (book.mainContent as Content[]).forEach(walk);
  const withFront: Book = { ...book, frontMatter: book.frontMatter ?? new FrontMatterBuilder().build(book) };
  const styled = new ThemeEngine().applyTheme(withFront, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);
  let nearBlank = 0;
  for (const page of paginated.pages) {
    const w = page.blocks.reduce((n, id) => n + (blockWords.get(id) ?? 0), 0);
    if (w <= 5) nearBlank += 1;
  }
  return { total: paginated.pages.length, nearBlank };
}

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const svc = new BookEditingService();
  const suggester = new CleanupSuggester();

  // ===== POLE OVER — book 2 =====
  const over = await importOf(BOOK2, db);
  if (over) {
    const s = suggester.suggest(over);
    const numbered = s.filter((x) => x.kind === 'numbered');
    const editorial = s.filter((x) => x.kind === 'editorial');
    console.log('== POLE OVER — book 2 "The Secret Of Spiritual Protection" ==');
    console.log(`  top-level entries: ${over.mainContent.length}`);
    console.log(`  cleanup suggestions: ${s.length}  (numbered ${numbered.length}, editorial ${editorial.length})`);

    // Build condition 2 — the duplicate CHAPTER 3 pairs correctly (each marker → its OWN follower).
    const ch3 = s.filter((x) => /^chapter\s+3$/i.test(x.markerText.trim()));
    console.log(`  duplicate "CHAPTER 3" suggestions: ${ch3.length} → ${JSON.stringify(ch3.map((x) => `${x.markerId.slice(-4)}→"${x.targetTitle.slice(0, 20)}"`))}`);
    const distinctTargets = new Set(ch3.map((x) => x.targetChapterId)).size;
    console.log(`  the two CHAPTER 3 markers pair with DISTINCT followers: ${distinctTargets === ch3.length ? 'YES (never mis-paired)' : 'NO — investigate'}`);

    // The gesture counter.
    console.log(`  GESTURE COUNT — by hand: ${s.length} collapses + the hunt through ${over.mainContent.length} entries (and no clean manual op exists today)`);
    console.log(`  GESTURE COUNT — with cleanup: 1 ("Collapse all")   →  ${s.length} + hunt  ⟶  1`);

    // Apply every collapse (in-memory), then re-measure.
    let cleaned = over;
    for (const x of s) cleaned = svc.collapseMarker(cleaned, x.markerId);
    const after = suggester.suggest(cleaned);
    console.log(`  after collapsing all: top-level ${cleaned.mainContent.length} (was ${over.mainContent.length}, −${over.mainContent.length - cleaned.mainContent.length}); detector now proposes ${after.length} → ${after.length === 0 ? 'CLEAN (idempotent)' : 'UNEXPECTED'}`);

    // The founder's visual judge — the near-blank marker pages are gone.
    const before = nearBlankPages(over);
    const afterPages = nearBlankPages(cleaned);
    console.log(`  NEAR-BLANK PAGES (≤5 body words): ${before.nearBlank}/${before.total} pages  →  ${afterPages.nearBlank}/${afterPages.total} pages`);
    console.log(`  → the founder's "almost blank" marker pages: ${before.nearBlank - afterPages.nearBlank} fewer after cleanup${afterPages.nearBlank < before.nearBlank ? '  ✓ the image-5 offset is repaired' : ''}\n`);
  }

  // ===== POLE UNDER — book 1 =====
  const under = await importOf(BOOK1, db);
  if (under) {
    const s = suggester.suggest(under);
    console.log('== POLE UNDER — book 1 (under-structured, the assist\'s pole) ==');
    console.log(`  top-level entries: ${under.mainContent.length}`);
    console.log(`  cleanup suggestions: ${s.length} → ${s.length === 0 ? 'SILENT = success (its markers are body TEXT, not empty headings)' : 'UNEXPECTED — investigate'}`);
  }
  db.close();
}

main();
