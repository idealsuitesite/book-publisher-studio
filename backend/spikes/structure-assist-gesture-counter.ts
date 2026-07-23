/**
 * STRUCTURE_ASSIST — the GESTURE COUNTER, the judge of the chantier (STRUCTURE_ASSIST_DR.md §5,
 * CTO mandatory stop). Re-measured on the CURRENT state (fresh re-import through today's pipeline,
 * non-negotiable #7 — the founder's books have moved since the stale ~7). Reports BOTH poles, and
 * — CTO vigilance point 2 — the REAL precision: a "≈1" that is really "confirm all then dismiss
 * five" is ≈6. Read-only. Run: npx tsx spikes/structure-assist-gesture-counter.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { StructureSuggester } from '../src/domain/services/structureAssist/StructureSuggester';
import type { Book, Content, Block } from '../src/domain/models/Book';

async function importFrom(buffer: Buffer): Promise<Book> {
  const raw = await new MammothParser().parse(buffer);
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'x.docx' }));
}

// A suggestion is a genuine structural marker (a real chapter the author intended) iff its evidence
// is a clean editorial name or "<chapter-word> <number>" — i.e. the taxonomy matched what it should.
// A false candidate would be something the author did NOT mean as a chapter (e.g. a recurring
// artifact). We flag any that look suspicious for the CTO to see, rather than assuming 100%.
const LOOKS_GENUINE = /^(foreword|preface|introduction|prologue|conclusion|epilogue|afterword|appendix|bibliography|glossary|index|notes|colophon|dedication|epigraph|acknowledg|about |chapter\s+\S+|chapitre\s+\S+|avant-propos|préface|postface)/i;

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blob = (id: string) => {
    const b = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(id) as { bytes: Buffer | Uint8Array } | undefined;
    return b ? (Buffer.isBuffer(b.bytes) ? b.bytes : Buffer.from(b.bytes)) : undefined;
  };

  // ---- Pole 1: UNDER-structured (founder-1) ----
  const under = blob('1784744671298-h9o6o9tn2');
  if (under) {
    const book = await importFrom(under);
    const blocks = (book.mainContent as Content[]).reduce((n, c) => n + (c.content as Block[]).length, 0);
    const suggestions = new StructureSuggester().suggest(book);
    const genuine = suggestions.filter((s) => LOOKS_GENUINE.test(s.evidence.trim()));
    const suspicious = suggestions.filter((s) => !LOOKS_GENUINE.test(s.evidence.trim()));

    console.log('== POLE 1 — UNDER-structured (founder-1 "Without religious…") ==');
    console.log(`  body blocks to hunt through: ${blocks}`);
    console.log(`  suggestions: ${suggestions.length}   (genuine markers: ${genuine.length}, suspicious: ${suspicious.length})`);
    console.log(`  all evidences: ${JSON.stringify(suggestions.map((s) => s.evidence.slice(0, 24)))}`);
    if (suspicious.length) console.log(`  ⚠ SUSPICIOUS (would be a post-confirm correction): ${JSON.stringify(suspicious.map((s) => s.evidence))}`);
    const withoutAssist = suggestions.length; // one "Make chapter" per marker, plus the hunt through all blocks
    const withAssist = 1 + suspicious.length;  // one "Make all", plus one dismiss per false candidate (honest, CTO vigilance 2)
    console.log(`  GESTURE COUNT — without assist: ${withoutAssist} promotes (+ hunting ${blocks} blocks)`);
    console.log(`  GESTURE COUNT — with assist:    ${withAssist} (1 "Make all"${suspicious.length ? ` + ${suspicious.length} dismiss` : ''})`);
    console.log(`  → ${withoutAssist} + hunt  ⟶  ${withAssist}${suspicious.length === 0 ? '  (precision 100% on this book: no post-confirm corrections)' : ''}\n`);
  }

  // ---- Pole 2: OVER-structured (founder-2) — ≈0 is the success ----
  const over = blob('1784760982271-w4n3yjxxw');
  if (over) {
    const book = await importFrom(over);
    const suggestions = new StructureSuggester().suggest(book);
    console.log('== POLE 2 — OVER-structured (founder-2 "The Secret…") ==');
    console.log(`  top-level entries: ${book.mainContent.length}`);
    console.log(`  suggestions: ${suggestions.length}   → ${suggestions.length === 0 ? 'SILENT = success (its markers are already headings; over-structure is STRUCTURE_CLEANUP\'s job)' : 'UNEXPECTED — investigate'}`);
  }
  db.close();
}

main();
