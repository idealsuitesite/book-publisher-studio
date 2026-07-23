/**
 * FOUNDER_TRAVERSAL second traversal — localise findings 2 & 3 in the mammoth HTML (before the
 * ASTBuilder), read-only. Are the book title and "FOREWORD" SEPARATE headings the normalizer
 * merged (finding 2 = a lost boundary in normalization), or one heading in the DOCX? Is
 * "CHAPTER 1" a SEPARATE heading (finding 3 = faithful import of the author's own over-segmented
 * Word structure) or a split? Prints the first ~20 heading elements with tag + text.
 * Run: npx tsx spikes/founder2-html-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';

const PROJECT_ID = '1784760982271-w4n3yjxxw';

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(PROJECT_ID) as { bytes: Buffer | Uint8Array } | undefined;
  db.close();
  if (!blob) { console.log('no source blob'); return; }
  const buffer = Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes);

  const raw = await new MammothParser().parse(buffer);
  const html: string = raw.html;

  // All heading elements, in order.
  const headings = [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((m) => ({ tag: m[1], text: m[2].replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim() }));
  console.log(`total heading elements: ${headings.length}\n`);
  console.log('first 22 headings (tag: text):');
  headings.slice(0, 22).forEach((h, i) => console.log(`  [${i}] <${h.tag}> "${h.text.slice(0, 55)}"`));

  // Finding 2 mechanism: is there a SINGLE heading whose text is "…ProtectionFOREWORD", or are
  // "…Protection" and "FOREWORD" two separate headings?
  const merged = headings.find((h) => /protection/i.test(h.text) && /foreword/i.test(h.text));
  const sepTitle = headings.find((h) => /^the secret of spiritual protection$/i.test(h.text));
  const sepForeword = headings.find((h) => /^foreword$/i.test(h.text));
  console.log(`\nFinding 2 in the HTML:`);
  console.log(`  a SINGLE heading "…ProtectionFOREWORD": ${merged ? `YES → <${merged.tag}> "${merged.text.slice(0, 50)}"` : 'NO'}`);
  console.log(`  separate "The Secret of Spiritual Protection" heading: ${sepTitle ? 'YES' : 'NO'}`);
  console.log(`  separate "FOREWORD" heading: ${sepForeword ? 'YES' : 'NO'}`);
  console.log(`  → ${merged ? 'the DOCX/mammoth ALREADY merges them into one heading (upstream of ASTBuilder)' : 'the merge happens in ASTBuilder/normalizer, not in mammoth'}`);

  // Finding 3 mechanism: is "CHAPTER 1" its own heading?
  const chapterMarkers = headings.filter((h) => /^chapter\s+\d+$/i.test(h.text));
  console.log(`\nFinding 3 in the HTML:`);
  console.log(`  standalone "CHAPTER n" headings: ${chapterMarkers.length} (${chapterMarkers.slice(0, 5).map((h) => `<${h.tag}>${h.text}`).join(', ')})`);
  console.log(`  → ${chapterMarkers.length > 0 ? 'the author styled "CHAPTER n" as its OWN heading in Word — the import faithfully makes each an (empty) chapter; the over-segmentation is the DOCX\'s own structure, not an import split' : 'no standalone CHAPTER n headings — the split is introduced downstream'}`);
}

main();
