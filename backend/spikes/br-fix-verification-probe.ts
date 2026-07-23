/**
 * FOUNDER_TRAVERSAL fix/br-boundary-classwide — real verification (read-only). Re-imports the
 * files that CARRY <br> through the FIXED pipeline and confirms the boundaries are restored:
 *   - founder-2 "The Secret…": the h1 title is now "…Protection FOREWORD" (space), not merged.
 *   - founder-1 "Without religious…": a body sentence that was jammed is now separated.
 *   - art-of-captivating (42 <br>): the count of "word.Word" / "word,Word" jams drops.
 * Never writes; the stored projects keep their (pre-fix) data untouched.
 * Run: npx tsx spikes/br-fix-verification-probe.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import type { Content, Block } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus');

async function importBook(buffer: Buffer, fileName: string) {
  const raw = await new MammothParser().parse(buffer);
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName }));
}

function allText(mainContent: Content[]): string {
  const parts: string[] = [];
  const walk = (c: Content) => {
    if (c.title) parts.push(c.title);
    for (const b of c.content as Block[]) if ((b as { text?: string }).text) parts.push((b as { text: string }).text);
    if (c.type === 'chapter') (c.sections ?? []).forEach(walk);
    else (c.subsections ?? []).forEach(walk);
  };
  mainContent.forEach(walk);
  return parts.join('\n');
}
// A "jam": a sentence/word boundary with NO space — lowercase or '.'/',' immediately followed by uppercase.
const JAM = /[a-z.,;:!?][A-Z]/g;

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));

  for (const [id, label] of [['1784760982271-w4n3yjxxw', 'founder-2 (The Secret…)'], ['1784744671298-h9o6o9tn2', 'founder-1 (Without religious…)']]) {
    const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(id) as { bytes: Buffer | Uint8Array } | undefined;
    if (!blob) continue;
    const buf = Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes);
    const book = await importBook(buf, 'x.docx');
    const title0 = ('title' in book.mainContent[0] ? book.mainContent[0].title : '') ?? '';
    const text = allText(book.mainContent as Content[]);
    const jams = (text.match(JAM) ?? []).length;
    console.log(`${label}`);
    console.log(`  first title now: "${title0.slice(0, 55)}"`);
    console.log(`  residual jams ("wordWord" / ".Word") across the whole book: ${jams}`);
  }
  db.close();

  const artBuf = readFileSync(join(CORPUS, 'art-of-captivating-list-dense.docx'));
  const art = await importBook(artBuf, 'art.docx');
  const artText = allText(art.mainContent as Content[]);
  console.log(`\nart-of-captivating (42 <br>): residual jams = ${(artText.match(JAM) ?? []).length}`);

  // Control: a 0-<br> file must have its normal (pre-existing) jam count unaffected by the fix.
  const faithBuf = readFileSync(join(CORPUS, 'faith-alone-styled.docx'));
  const faith = await importBook(faithBuf, 'faith.docx');
  console.log(`control faith-alone (0 <br>): jams = ${(allText(faith.mainContent as Content[]).match(JAM) ?? []).length} (unchanged by the fix — no <br> to collapse)`);
}

main();
