/**
 * STRUCTURE_ASSIST — run the REAL suggester on the two REAL founder books EARLY (CTO: never assume
 * the over-structured manuscript behaves as theory says — run it early, not at the end). Read-only:
 * re-imports each book's source bytes through today's pipeline (so it carries the <br> fixes too)
 * and runs StructureSuggester. Reports the two poles' real behaviour, and re-asserts the invariant
 * (Book byte-identical after suggest) on real content.
 * Run: npx tsx spikes/structure-assist-real-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { StructureSuggester } from '../src/domain/services/structureAssist/StructureSuggester';
import type { Book } from '../src/domain/models/Book';

async function importFrom(buffer: Buffer): Promise<Book> {
  const raw = await new MammothParser().parse(buffer);
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'x.docx' }));
}

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const books: [string, string][] = [
    ['1784744671298-h9o6o9tn2', 'founder-1 UNDER-structured (Without religious…)'],
    ['1784760982271-w4n3yjxxw', 'founder-2 OVER-structured (The Secret…)'],
  ];
  for (const [id, label] of books) {
    const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(id) as { bytes: Buffer | Uint8Array } | undefined;
    if (!blob) { console.log(`${label}: no source blob`); continue; }
    const book = await importFrom(Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes));
    const topLevel = book.mainContent.length;

    const before = JSON.stringify(book);
    const suggestions = new StructureSuggester().suggest(book);
    const invariantHeld = JSON.stringify(book) === before;

    console.log(`\n${label}`);
    console.log(`  top-level entries: ${topLevel}`);
    console.log(`  suggestions: ${suggestions.length}`);
    console.log(`  invariant (Book byte-identical after suggest): ${invariantHeld ? 'HELD ✓' : 'VIOLATED ✗'}`);
    console.log(`  samples: ${JSON.stringify(suggestions.slice(0, 8).map((s) => `${s.kind}:${s.evidence.slice(0, 22)}`))}`);
  }
  db.close();
  console.log('\n(Expectation: UNDER → real suggestions; OVER → ~0, because its markers are already headings, not body paragraphs.)');
}

main();
