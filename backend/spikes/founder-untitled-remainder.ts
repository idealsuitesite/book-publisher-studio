/**
 * FOUNDER_TRAVERSAL_3 A4 — the untitled preamble / "Untitled" EPUB label (read-only measurement).
 * Three distinct questions (CTO):
 *   Q3 ROOT — does the untitled preamble exist OUTSIDE promotion? (an import whose doc starts with
 *      prose before the first heading). If yes, the defect is older/broader than our operation.
 *   Q1 — what SHOULD the remainder be? Measure the preamble CONTENT on the real books — front matter,
 *      a real nameable chapter, or a valueless artifact — do NOT assume one answer.
 *   Q2 — is "Untitled" a format necessity or a lib default? Does epub-gen REQUIRE a non-empty title?
 * SELECT/blob read + in-memory only; never a write. Run: npx tsx spikes/founder-untitled-remainder.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import JSZip from 'jszip';
import * as epubModule from 'epub-gen-memory';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import type { Book, Content, Section, Block } from '../src/domain/models/Book';

const BOOKS = [
  { id: '1784744671298-h9o6o9tn2', label: 'book 1 (under-structured)' },
  { id: '1784760982271-w4n3yjxxw', label: 'book 2 (over-structured)' },
  { id: '1784812181217-cy7m12l0w', label: 'book 3 (under-structured, the traversal-3 book)' },
];
const words = (b: Block[] | undefined) => (b ?? []).reduce((n, x) => n + ((x as { text?: string }).text ? (x as { text: string }).text.trim().split(/\s+/).filter(Boolean).length : 0), 0);
const firstLines = (b: Block[] | undefined, n = 6) => (b ?? []).map((x) => (x as { text?: string }).text?.trim()).filter((t): t is string => !!t).slice(0, n);

// Front-matter signals in the preamble text (title page / copyright / dedication / ISBN).
function frontMatterScent(lines: string[]): string[] {
  const hits: string[] = [];
  const joined = lines.join(' ¶ ').toLowerCase();
  if (/©|copyright|tous droits|all rights reserved/.test(joined)) hits.push('copyright');
  if (/isbn/.test(joined)) hits.push('isbn');
  if (/dedicat|dédicac|for my|pour /.test(joined)) hits.push('dedication?');
  if (/edition|édition|publish|éditions/.test(joined)) hits.push('publisher/edition');
  if (lines[0] && lines[0].length < 60 && lines[0] === lines[0].toUpperCase()) hits.push('short-caps-titleish-first-line');
  return hits;
}

async function importFrom(buffer: Buffer): Promise<Book> {
  const raw = await new MammothParser().parse(buffer);
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'x.docx' }));
}

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blobs = new Map<string, Buffer>(), aggs = new Map<string, Book>();
  for (const b of BOOKS) {
    const bl = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(b.id) as { bytes: Buffer | Uint8Array } | undefined;
    if (bl) blobs.set(b.id, Buffer.isBuffer(bl.bytes) ? bl.bytes : Buffer.from(bl.bytes));
    const ag = db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(b.id) as { aggregate: string } | undefined;
    if (ag) aggs.set(b.id, JSON.parse(ag.aggregate).book as Book);
  }
  db.close();

  // ===== Q3 — is an untitled preamble an IMPORT artifact (independent of promotion)? =====
  console.log('════ Q3 — does the untitled preamble come from IMPORT, not just promotion? ════');
  // Synthetic: a document that BEGINS with prose, then a heading. No promotion involved.
  const synth = new ASTBuilder().build(new HtmlNormalizer().normalize(
    '<p>This preamble prose comes before any heading at all.</p><p>A second opening line.</p><h1>Chapter One</h1><p>Chapter body.</p>',
    { fileName: 's.docx' }
  ));
  const synthFirst = synth.mainContent[0] as Content;
  console.log(`  synthetic "prose-before-heading" import → first top-level entry: type=${synthFirst.type}, title=${JSON.stringify(synthFirst.title)}, level=${(synthFirst as Section).level ?? '-'}, words=${words(synthFirst.content)}`);
  console.log(`  ⇒ ${!synthFirst.title ? 'AN UNTITLED PREAMBLE IS CREATED AT IMPORT (ASTBuilder, no promotion) — the artifact is older/broader than promoteToChapter' : 'no untitled preamble at import'}`);

  // ===== Q1 — what the preamble CONTAINS on the real books =====
  console.log('\n════ Q1 — what the untitled remainder CONTAINS (real books) ════');
  for (const b of BOOKS) {
    const book = aggs.get(b.id);
    if (!book) continue;
    // The real artifact: a top-level entry with an empty/whitespace title (the stored state — what the author has).
    const untitled = (book.mainContent as Content[]).filter((c) => !c.title || !c.title.trim());
    console.log(`  ${b.label}: ${untitled.length} untitled top-level entr${untitled.length === 1 ? 'y' : 'ies'} in the STORED book`);
    for (const u of untitled) {
      const lines = firstLines(u.content);
      console.log(`     type=${u.type} words=${words(u.content)}  scent=[${frontMatterScent(lines).join(', ') || 'none → looks like ordinary prose'}]`);
      console.log(`     first lines: ${JSON.stringify(lines.map((l) => l.slice(0, 46)))}`);
    }
  }

  // ===== Q2 — does epub-gen REQUIRE a non-empty title? (format necessity vs lib default) =====
  console.log('\n════ Q2 — does epub-gen require a non-empty chapter title? ════');
  const resolved = ((): ((o: unknown, c: unknown) => Promise<Buffer>) => {
    const m = epubModule as unknown as Record<string, unknown>;
    for (const cand of [m.default, m.epub, m]) if (typeof cand === 'function') return cand as never;
    if (m.default && typeof (m.default as Record<string, unknown>).default === 'function') return (m.default as Record<string, unknown>).default as never;
    throw new Error('cannot resolve epub fn');
  })();
  const opts = { title: 'T', author: 'A', lang: 'en' };
  for (const [name, title] of [['empty string', ''], ['a real label', 'Introduction']] as const) {
    try {
      const buf = await resolved(opts, [{ title, content: '<p>Body text of the untitled preamble.</p>' }]);
      const zip = await JSZip.loadAsync(buf);
      const navName = Object.keys(zip.files).find((f) => /nav\.xhtml$/.test(f)) ?? Object.keys(zip.files).find((f) => /\.ncx$/.test(f));
      const nav = navName ? await zip.files[navName].async('string') : '';
      // What label did the nav get for our chapter?
      const navHasIntro = /Introduction/.test(nav);
      const emptyNavEntry = /<a[^>]*>\s*<\/a>|<text>\s*<\/text>/.test(nav);
      console.log(`  title=${name}: epub-gen ${'✓ generated'} (${buf.length}b); nav=${navName?.split('/').pop()}; empty-label-entry-present=${emptyNavEntry}; 'Introduction' in nav=${navHasIntro}`);
    } catch (e) {
      console.log(`  title=${name}: epub-gen THREW → ${(e as Error).message.slice(0, 80)}  ⇒ a non-empty title WOULD be a lib necessity`);
    }
  }
  console.log(`  ⇒ if the empty-string case GENERATED without throwing, "Untitled" is a CHOICE our adapter makes, not a format/lib necessity (the class question: same as the chased "Unknown").`);
}

main();
