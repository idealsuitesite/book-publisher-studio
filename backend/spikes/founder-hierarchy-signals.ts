/**
 * FOUNDER_TRAVERSAL_3 — the JOINT signal probe (one sonde, three readings, CTO 2026-07-23).
 * Read-only on the founder's three real manuscripts (fresh re-import through today's pipeline).
 * The three readings all read the SAME text structure, so no double counting:
 *   R1 REPEATED_EDITORIAL_MARKERS — each canonical editorial name's frequency + position. Does the
 *      repetition distinguish a TRUE editorial part (one occurrence, at front/back) from a recurring
 *      section title (N occurrences, distributed)? The suggester is faithful; repetition is the signal.
 *   R2 TITLE_FROM_FOLLOWING_LINE — for each CHAPTER n marker, is the NEXT body line title-shaped?
 *      i.e. could the assist propose the descriptive following line instead of the marker text?
 *   R3 SUBCHAPTER_PROMOTION — the repeated names + descriptive sub-headings = the sub-structure;
 *      feasibility of a "make sub-section" proposal on the repetition signal.
 * Run: npx tsx spikes/founder-hierarchy-signals.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { classifyMarker } from '../src/domain/services/structureAssist/structureTaxonomy';
import type { Book, Content, Block, Paragraph } from '../src/domain/models/Book';

const BOOKS = [
  { id: '1784744671298-h9o6o9tn2', label: 'book 1 "Without religious performance" (under-structured)' },
  { id: '1784760982271-w4n3yjxxw', label: 'book 2 "The Secret Of Spiritual Protection" (over-structured)' },
  { id: '1784812181217-cy7m12l0w', label: 'book 3 "Rachat et expiation bibliques 2" (under-structured)' },
];

async function importFrom(buffer: Buffer): Promise<Book> {
  const raw = await new MammothParser().parse(buffer);
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'x.docx' }));
}

// The flat sequence of body paragraphs across all top-level containers (+ their sections), in order —
// exactly the flow an author reads and the assist scans.
function paragraphFlow(book: Book): Paragraph[] {
  const out: Paragraph[] = [];
  const walk = (c: Content) => {
    for (const b of c.content as Block[]) if (b.type === 'paragraph' && (b as Paragraph).text.trim()) out.push(b as Paragraph);
    (c.type === 'chapter' ? (c.sections ?? []) : ((c as { subsections?: Content[] }).subsections ?? [])).forEach(walk);
  };
  (book.mainContent as Content[]).forEach(walk);
  return out;
}

// A "title-shaped" line: short, no terminal sentence punctuation, not itself a marker. ALL-CAPS or
// Title-Case raises confidence but is not required (the founder's headings are ALL-CAPS).
function titleShaped(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 70) return false;
  if (/[.:;?!,]$/.test(t)) return false;
  if (classifyMarker(t)) return false; // the following line is another marker, not a title
  const words = t.split(/\s+/);
  return words.length <= 12;
}

async function measure(book: Book, label: string) {
  const flow = paragraphFlow(book);
  console.log(`\n════ ${label} — ${flow.length} body paragraphs ════`);

  // ---- R1: repeated editorial markers, with positions ----
  const editorialHits = new Map<string, number[]>(); // canonical label -> normalized positions
  flow.forEach((p, i) => {
    const m = classifyMarker(p.text);
    if (m?.kind === 'editorial') {
      const arr = editorialHits.get(m.label) ?? [];
      arr.push(+(i / Math.max(1, flow.length - 1)).toFixed(2));
      editorialHits.set(m.label, arr);
    }
  });
  console.log('  R1 REPEATED_EDITORIAL_MARKERS (name → count @ positions 0=start..1=end):');
  if (editorialHits.size === 0) console.log('     (none)');
  for (const [name, pos] of editorialHits) {
    const kind = pos.length === 1 ? 'UNIQUE → true editorial part' : `×${pos.length} DISTRIBUTED → recurring section title (sub-structure)`;
    console.log(`     ${name}: ×${pos.length} @ ${JSON.stringify(pos.slice(0, 12))}  ⇒ ${kind}`);
  }

  // ---- R2: CHAPTER n marker → is the following line a title? ----
  let markers = 0, withTitleNext = 0; const examples: string[] = [];
  flow.forEach((p, i) => {
    if (classifyMarker(p.text)?.kind !== 'numbered-chapter') return;
    markers += 1;
    const next = flow[i + 1];
    if (next && titleShaped(next.text)) {
      withTitleNext += 1;
      if (examples.length < 6) examples.push(`"${p.text.trim()}" → "${next.text.trim().slice(0, 34)}"`);
    }
  });
  console.log(`  R2 TITLE_FROM_FOLLOWING_LINE: ${markers} CHAPTER n markers; ${withTitleNext} followed by a title-shaped line (${markers ? Math.round((withTitleNext / markers) * 100) : 0}%)`);
  if (examples.length) console.log(`     e.g. ${JSON.stringify(examples)}`);

  // ---- R3: the sub-structure surface (repetition + descriptive headings) ----
  const distinctRepeated = [...editorialHits.entries()].filter(([, p]) => p.length > 1);
  const allcaps = flow.filter((p) => { const t = p.text.trim(); return t.length <= 55 && t === t.toUpperCase() && /[A-Z]/.test(t) && !classifyMarker(t); }).length;
  console.log(`  R3 SUBCHAPTER surface: repeated-editorial-name groups (sub-section candidates): ${distinctRepeated.length}; ALL-CAPS descriptive short lines: ${allcaps}`);
}

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blobs = new Map<string, Buffer>();
  for (const b of BOOKS) {
    const r = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(b.id) as { bytes: Buffer | Uint8Array } | undefined;
    if (r) blobs.set(b.id, Buffer.isBuffer(r.bytes) ? r.bytes : Buffer.from(r.bytes));
  }
  db.close();
  for (const b of BOOKS) {
    const buf = blobs.get(b.id);
    if (!buf) { console.log(`\n${b.label}: no source blob`); continue; }
    await measure(await importFrom(buf), b.label);
  }
  console.log('\n──── READING ────');
  console.log('R1: a canonical name appearing ONCE (at front/back) is a true editorial part; appearing');
  console.log('    N>1 times distributed is a recurring section title — DEDUCTIVE (a book has one), the');
  console.log('    positional/non-inferential signal. R2: the marker→following-title pairing is where the');
  console.log('    assist should take the descriptive title (number stays a datum). R3: the same repetition');
  console.log('    feeds the "make sub-section" proposal (B5).');
}

main();
