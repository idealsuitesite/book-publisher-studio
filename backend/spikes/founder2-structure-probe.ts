/**
 * FOUNDER_TRAVERSAL second traversal — read-only structural analysis of "The Secret Of Spiritual
 * Protection" for findings 2, 3, 4. Reads the stored aggregate (SELECT only), never writes.
 *   - Finding 2: is "FOREWORD" adjacent to the book title in the AST? (import-side view)
 *   - Findings 3/4: 0-word chapters, and whether content is orphaned from its title
 *     (a titled chapter with empty content, its text living under a sibling) — measured, not assumed.
 * Run: npx tsx spikes/founder2-structure-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const PROJECT_ID = '1784760982271-w4n3yjxxw'; // The Secret Of Spiritual Protection

interface Block { type: string; text?: string }
interface Content { type: string; id: string; title?: string; number?: number; content?: Block[]; sections?: Content[]; partOpener?: true }

function words(blocks: Block[] | undefined): number {
  return (blocks ?? []).reduce((n, b) => n + (b.text ? b.text.trim().split(/\s+/).filter(Boolean).length : 0), 0);
}
function firstText(blocks: Block[] | undefined): string {
  const b = (blocks ?? []).find((x) => x.text && x.text.trim());
  return b?.text?.slice(0, 60) ?? '(none)';
}

function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const row = db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(PROJECT_ID) as { aggregate: string } | undefined;
  if (!row) { console.log('project not found'); db.close(); return; }
  const agg = JSON.parse(row.aggregate);
  const book = agg.book;
  console.log(`metadata: title="${book.metadata.title}"  author=${JSON.stringify(book.metadata.author)}  language=${JSON.stringify(book.metadata.language)}`);
  console.log(`frontMatter.titlePage: ${JSON.stringify(book.frontMatter?.titlePage)}`);
  console.log(`mainContent: ${book.mainContent.length} top-level entries\n`);

  let empty = 0, orphanCandidates = 0;
  const flat = (book.mainContent as Content[]);
  flat.forEach((c, i) => {
    const w = words(c.content);
    const secCount = c.sections?.length ?? 0;
    const secWords = (c.sections ?? []).reduce((n, s) => n + words(s.content) + (s.sections ?? []).reduce((m, ss) => m + words(ss.content), 0), 0);
    const tag = c.partOpener ? 'PART-OPENER' : c.type;
    const flags: string[] = [];
    if (w === 0 && secCount === 0 && !c.partOpener) { empty += 1; flags.push('0-WORD-CHAPTER'); }
    if (w === 0 && secCount > 0) flags.push(`empty-own-body,${secWords}w-in-${secCount}-sections`);
    console.log(`  [${i}] ${tag} "${(c.title ?? '(untitled)').slice(0, 45)}"  ownWords=${w}  sections=${secCount}  ${flags.join(' ')}`);
    if (w > 0) console.log(`        firstText: "${firstText(c.content)}"`);
    // Orphan check: is there a sibling whose title looks like a heading but body empty, while the NEXT sibling holds prose with no title?
    (c.sections ?? []).forEach((s) => {
      const sw = words(s.content);
      if (sw === 0 && (s.sections?.length ?? 0) === 0) orphanCandidates += 1;
      console.log(`        └ section "${(s.title ?? '(untitled)').slice(0, 40)}"  words=${sw}`);
    });
  });

  console.log(`\nSUMMARY: ${flat.length} top-level; 0-word top-level chapters: ${empty}; empty sections: ${orphanCandidates}`);

  // Finding 2: FOREWORD adjacency to the title. Is the FIRST top-level title "FOREWORD" (or does a
  // title concatenation exist in the AST)?
  const titles = flat.map((c) => c.title ?? '');
  console.log(`\nFinding 2 — title-boundary check:`);
  console.log(`  book title: "${book.metadata.title}"`);
  console.log(`  first top-level titles: ${JSON.stringify(titles.slice(0, 4))}`);
  const concat = titles.find((t) => /protection/i.test(t) && /foreword/i.test(t));
  console.log(`  any AST title containing BOTH 'protection' and 'foreword' (import-merged): ${concat ? `YES → "${concat}"` : 'NO (so the concatenation is NOT in the AST — likely a render-side adjacency)'}`);

  db.close();
}

main();
