/**
 * FOUNDER_TRAVERSAL finding 2 — <br> boundary SCOPE measurement (CTO condition 1: measure ALL the
 * places <br> is flattened without a boundary, not just titles — "fix the class, not the specimen").
 * Read-only. Two parts:
 *   A. SYNTHETIC: feed HTML with <br> in a heading, a rich paragraph, a list item, a table cell,
 *      and a quote → normalize → show whether each drops the boundary ("AB") or keeps it ("A B").
 *   B. CORPUS: parse every real manuscript (the 4-file corpus + the founder's 2 stored books via
 *      their source blobs) with mammoth and count <br> per element type — where does it REALLY occur?
 * Run: npx tsx spikes/br-boundary-scope-probe.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(__dirname, '..', 'verification', 'corpus');

function textOf(node: unknown): string {
  const n = node as { text?: string; inlines?: { text?: string }[]; items?: unknown[]; rows?: unknown };
  if (typeof n.text === 'string') return n.text;
  if (n.inlines) return n.inlines.map((i) => i.text ?? '').join('');
  if (n.items) return n.items.map((i) => (typeof i === 'string' ? i : JSON.stringify(i))).join(' | ');
  return JSON.stringify(n).replace(/"(id|type|source)":"[^"]*",?/g, '').slice(0, 120);
}

function partA() {
  console.log('== A. SYNTHETIC — does normalization keep the <br> boundary? ==');
  const cases: Record<string, string> = {
    'heading (h1)': '<h1>Alpha<br />Bravo</h1>',
    'heading double-br': '<h1>Alpha<br /><br />Bravo</h1>',
    'paragraph plain': '<p>Charlie<br />Delta</p>',
    'paragraph rich': '<p>Echo<strong>Fox</strong><br />Golf</p>',
    'list item': '<ul><li>Hotel<br />India</li></ul>',
    'table cell': '<table><tr><td>Juliet<br />Kilo</td></tr></table>',
    'quote': '<blockquote><p>Lima<br />Mike</p></blockquote>',
  };
  // Two adjacent capitalised words with NO separator between them = boundary lost.
  const jammed = /[a-z][A-Z]/;
  for (const [label, html] of Object.entries(cases)) {
    const doc = new HtmlNormalizer().normalize(html, { fileName: 'x.docx' });
    const texts = doc.nodes.map(textOf).filter((t) => t && t.length > 1);
    const flat = texts.join(' | ');
    const lost = jammed.test(flat.replace(/EchoFox|LimaMike/g, '')) || /(Bravo|Delta|Golf|India|Kilo|Mike)/.test(flat) && jammed.test(flat);
    console.log(`  ${label.padEnd(20)} → ${JSON.stringify(texts)}   boundary ${jammed.test(flat) ? 'LOST ✗' : 'kept ✓'}`);
    void lost;
  }
}

async function brHistogram(label: string, buffer: Buffer) {
  const raw = await new MammothParser().parse(buffer);
  const html = raw.html;
  const perTag: Record<string, number> = {};
  // For each block element, count how many contain <br>.
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'blockquote']) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
    let count = 0;
    for (let m = re.exec(html); m; m = re.exec(html)) if (/<br\s*\/?>/.test(m[1])) count += 1;
    if (count > 0) perTag[tag] = count;
  }
  const totalBr = (html.match(/<br\s*\/?>/g) ?? []).length;
  console.log(`  ${label.padEnd(34)} total <br>: ${String(totalBr).padStart(4)}   elements-with-<br>: ${JSON.stringify(perTag)}`);
}

async function partB() {
  console.log('\n== B. CORPUS — where does <br> REALLY occur (real manuscripts)? ==');
  for (const f of ['faith-alone-styled.docx', 'art-of-captivating-list-dense.docx', 'generated-unstyled-3060w.docx', 'pm-notes-unstyled-fr.docx']) {
    await brHistogram(f, readFileSync(join(CORPUS, f)));
  }
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  for (const [id, name] of [['1784744671298-h9o6o9tn2', 'founder-1 (Without religious…)'], ['1784760982271-w4n3yjxxw', 'founder-2 (The Secret…)']]) {
    const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(id) as { bytes: Buffer | Uint8Array } | undefined;
    if (blob) await brHistogram(name, Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes));
  }
  db.close();
}

async function main() {
  partA();
  await partB();
}
main();
