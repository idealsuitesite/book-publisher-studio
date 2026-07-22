/**
 * FOUNDER_TRAVERSAL lot 1 — defects 1 (title=filename+ext) & 3 (language hardcoded).
 * Read-only: re-runs the CURRENT import pipeline on the founder's STORED source bytes (pulled
 * straight from the SQLite blobs table, project never modified) and prints what today's code
 * produces for title + language. Also unit-tests titleFromFileName on the exact founder name.
 * Run: npx tsx spikes/founder-title-lang-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder, titleFromFileName } from '../src/domain/services/ASTBuilder';

const FOUNDER_ID = '1784744671298-h9o6o9tn2';

async function main() {
  // titleFromFileName in isolation on the exact stored name.
  const name = 'Without religious performance.ldocx';
  console.log(`titleFromFileName("${name}") = "${titleFromFileName(name)}"`);
  console.log(`titleFromFileName("book.docx") = "${titleFromFileName('book.docx')}"`);

  // Pull the founder's stored source blob (read-only) and re-run TODAY's pipeline.
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const cols = db.prepare('PRAGMA table_info(blobs)').all().map((r) => (r as { name: string }).name);
  console.log('blobs columns:', cols.join(', '));
  const rows = db.prepare('SELECT * FROM blobs WHERE project_id = ?').all(FOUNDER_ID);
  console.log(`blob rows for founder: ${rows.length}`);
  for (const r of rows) {
    const row = r as Record<string, unknown>;
    const keys = Object.keys(row).filter((k) => k !== 'data' && k !== 'bytes' && k !== 'content');
    console.log('  row meta:', keys.map((k) => `${k}=${String(row[k]).slice(0, 60)}`).join('  '));
  }

  // Find the source blob (kind/role = 'source') and its byte column.
  const source = rows.map((r) => r as Record<string, unknown>).find(
    (r) => Object.values(r).some((v) => typeof v === 'string' && /source/i.test(v))
  ) ?? (rows[0] as Record<string, unknown> | undefined);
  if (!source) { console.log('no source blob found'); db.close(); return; }
  const byteCol = ['data', 'bytes', 'content'].find((c) => source[c] !== undefined);
  const buf = byteCol ? (source[byteCol] as Buffer | Uint8Array) : undefined;
  if (!buf) { console.log('no byte column on blob; columns:', Object.keys(source).join(',')); db.close(); return; }
  const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  console.log(`source blob size: ${buffer.length} bytes`);

  const raw = await new MammothParser().parse(buffer);
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: name });
  const book = new ASTBuilder().build(normalized);
  console.log(`\nCURRENT pipeline on the founder bytes:`);
  console.log(`  title    = "${book.metadata.title}"`);
  console.log(`  author   = "${book.metadata.author}"`);
  console.log(`  language = "${book.metadata.language}"`);
  console.log(`  normalized.metadata.title = ${JSON.stringify(normalized.metadata.title)}`);
  db.close();
}

main();
