/**
 * FOUNDER_TRAVERSAL 3≡4 confirmation (read-only). The CTO's image 5: "INTRODUCTION" at the top,
 * then an almost-empty page, the text only on the NEXT page. Question: is that offset FULLY
 * explained by 0-word chapters (→ 3≡4 proven), or is there residual spacing once over-segmentation
 * is accounted for (→ a distinct finding 4-bis)? Paginate the founder book and, per page, report
 * the owning title and the real body content on it — so every "almost-empty" page can be matched
 * to an empty chapter, or flagged as residual. Also measure a CONTENT chapter's title→first-content
 * gap vs the theme's declared title spacing (a residual render offset would show there).
 * Run: npx tsx spikes/founder2-offset-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP6x9PageLayout } from '../src/domain/layouts/KDP6x9PageLayout';
import type { Book, Content, Block } from '../src/domain/models/Book';

const PROJECT_ID = '1784760982271-w4n3yjxxw';

function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const agg = JSON.parse((db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(PROJECT_ID) as { aggregate: string }).aggregate);
  db.close();
  const storedBook = agg.book as Book;
  const book: Book = { ...storedBook, frontMatter: storedBook.frontMatter ?? new FrontMatterBuilder().build(storedBook) };

  // Map every block id -> the words in that block, and every content's title -> its first block id.
  const wordsOf = (b: Block) => ((b as { text?: string }).text ? (b as { text: string }).text.trim().split(/\s+/).filter(Boolean).length : 0);
  const blockWords = new Map<string, number>();
  const contentByFirstBlock = new Map<string, { title: string; ownWords: number }>();
  const walk = (c: Content) => {
    let own = 0;
    for (const b of c.content as Block[]) { blockWords.set(b.id, wordsOf(b)); own += wordsOf(b); }
    const first = (c.content as Block[])[0];
    if (c.title) contentByFirstBlock.set(first ? first.id : c.id, { title: c.title, ownWords: own });
    if (c.type === 'chapter') (c.sections ?? []).forEach(walk); else (c.subsections ?? []).forEach(walk);
  };
  (book.mainContent as Content[]).forEach(walk);

  const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP6x9PageLayout);

  console.log(`paginated: ${paginated.pages.length} model pages. First 16:\n`);
  let almostEmpty = 0, emptyExplained = 0;
  paginated.pages.slice(0, 16).forEach((page, i) => {
    const pageWords = page.blocks.reduce((n, id) => n + (blockWords.get(id) ?? 0), 0);
    const titlesStarting = page.blocks.map((id) => contentByFirstBlock.get(id)?.title).filter(Boolean);
    // A page is "almost empty" if it carries <= 5 words of body.
    const isAlmostEmpty = pageWords <= 5;
    if (isAlmostEmpty) {
      almostEmpty += 1;
      // Explained if a title starts here AND that title's content is empty (0-word chapter/section).
      const explained = page.blocks.some((id) => (contentByFirstBlock.get(id)?.ownWords ?? 1) === 0) || titlesStarting.length > 0;
      if (explained) emptyExplained += 1;
    }
    console.log(`  page ${String(i + 1).padStart(2)}: ${String(pageWords).padStart(4)} body words  ${isAlmostEmpty ? '[ALMOST EMPTY]' : ''}  titles: ${JSON.stringify(titlesStarting.map((t) => (t ?? '').slice(0, 30)))}`);
  });

  console.log(`\nAcross the first 16 pages: almost-empty pages ${almostEmpty}, of which explained by a starting/empty title ${emptyExplained}.`);
  console.log(`→ ${almostEmpty === emptyExplained ? '3≡4 supported so far: every almost-empty page is a title/empty-chapter page (no residual seen)' : 'RESIDUAL: an almost-empty page with NO starting/empty title — a candidate finding 4-bis'}`);
  console.log(`(Full test needs the whole run; this is the first-pages view where image 5 lives.)`);
}

main();
