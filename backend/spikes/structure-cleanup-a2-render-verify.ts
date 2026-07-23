/**
 * STRUCTURE_CLEANUP — the CTO's two pre-engraving verifications of the A2 subtitle variant, on REAL
 * pages, before it is graved (STRUCTURE_CLEANUP_DR.md §6.3, D3). Read-only, in-memory: applies
 * collapseMarker to the founder book-2 editorial markers and renders under Novel (the theme that
 * lights drop caps). STOP-and-report if either fails, never adjust.
 *   Check 1 — the subtitle (the follower's descriptive title) renders on real pages for both chapters.
 *   Check 2 — the drop cap falls on the PROSE under the subtitle in Novel (the case locked yesterday,
 *             MINI_DR_SUBTITLE_FIELD) — the subtitle never steals the ornament.
 * Run: npx tsx spikes/structure-cleanup-a2-render-verify.ts
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
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import { extractPdfRuns } from '../src/test-utils/extractPdfText';
import { blockTypographyKey } from '../src/shared/utils/typographyKeys';
import type { Book, Content, Chapter, Section, Paragraph } from '../src/domain/models/Book';

const BOOK2 = '1784760982271-w4n3yjxxw';

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(BOOK2) as { bytes: Buffer | Uint8Array } | undefined;
  db.close();
  if (!blob) { console.log('book 2 blob not found'); return; }
  const raw = await new MammothParser().parse(Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes));
  let book: Book = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'x.docx' }));

  // Apply the A2 (editorial) collapses in memory — the only two the subtitle variant touches.
  const svc = new BookEditingService();
  const editorial = new CleanupSuggester().suggest(book).filter((s) => s.kind === 'editorial');
  console.log(`A2 editorial collapses to apply: ${editorial.length} — ${JSON.stringify(editorial.map((e) => `${e.markerText}→${e.targetTitle.slice(0, 24)}`))}\n`);
  const a2ChapterIds: string[] = [];
  for (const e of editorial) {
    book = svc.collapseMarker(book, e.markerId);
    a2ChapterIds.push(e.targetChapterId); // the follower keeps its id through the collapse
  }

  const novel = getTheme('novel');
  console.log(`Novel dropCap scope: ${JSON.stringify(novel.presentation?.dropCap?.scope)} (must be 'chapterOpening' for the ornament to light)\n`);

  const withFront: Book = { ...book, frontMatter: book.frontMatter ?? new FrontMatterBuilder().build(book) };
  const styled = new ThemeEngine().applyTheme(withFront, novel);
  const resolved = new TypographyResolver().resolve(styled);
  const dropCapOf = (blockId: string): boolean => resolved.blockTypography[blockTypographyKey(blockId)]?.dropCap === true;

  const firstProse = (ch: Chapter): { where: string; para: Paragraph | undefined } => {
    const own = (ch.content as Paragraph[]).find((b) => b.type === 'paragraph' && b.text.trim());
    if (own) return { where: 'own body (content[0])', para: own };
    const sec = (ch.sections ?? [])[0] as Section | undefined;
    const secPara = sec ? (sec.content as Paragraph[]).find((b) => b.type === 'paragraph' && b.text.trim()) : undefined;
    return { where: sec ? 'under a Heading 2 section' : '(no prose)', para: secPara };
  };

  // ---- Check 2: drop cap on the prose, per A2 chapter (model-level, deterministic — drives all renderers) ----
  console.log('── Check 2: the resolved drop-cap flag on each A2 chapter (Novel) ──');
  const a2Chapters = (book.mainContent as Content[]).filter((c): c is Chapter => c.type === 'chapter' && a2ChapterIds.includes(c.id));
  for (const ch of a2Chapters) {
    const fp = firstProse(ch);
    const subtitleDropCap = ch.subtitle ? '(subtitle is a title-block field, never a drop-cap candidate)' : '';
    console.log(`  "${ch.title}"  subtitle="${ch.subtitle ?? '(none)'}"`);
    console.log(`     first prose: ${fp.where}  "${fp.para?.text.slice(0, 40) ?? '(none)'}"`);
    console.log(`     drop cap on that prose: ${fp.para ? dropCapOf(fp.para.id) : 'N/A (no prose paragraph)'}  ${subtitleDropCap}`);
  }

  // ---- Check 1: the subtitle renders on real pages (Novel PDF), each A2 chapter rendered SOLO ----
  // Solo render removes the whole-book confounders (this book repeats "JESUS CHRIST, OUR PASSOVER…"
  // across many chapters/sections, and cross-page running heads interleave in a whole-doc concat).
  // Each chapter carries its REAL post-collapse title/subtitle/content — a faithful per-chapter proof.
  console.log('\n── Check 1: the subtitle on real rendered pages (each A2 chapter rendered solo, Novel) ──');
  const alnum = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const ch of a2Chapters) {
    if (!ch.subtitle) continue;
    const solo: Book = { ...withFront, mainContent: [ch], frontMatter: {} };
    const soloResolved = new TypographyResolver().resolve(new ThemeEngine().applyTheme(solo, novel));
    const soloPaginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(soloResolved, KDP6x9PageLayout);
    const warn = console.warn; console.warn = () => {};
    const pdf = (await new PDFRenderer({ compress: false }).render(soloPaginated, { language: 'en' })).output as Buffer;
    console.warn = warn;
    const T = alnum(extractPdfRuns(pdf).map((r) => r.text).join(''));
    console.log(`  "${ch.title}" subtitle (${ch.subtitle.length} chars) present in full: ${T.includes(alnum(ch.subtitle))}`);
  }
}

main();
