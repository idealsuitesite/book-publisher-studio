/**
 * FOUNDER_TRAVERSAL lot 1 — defect 4 (rename didn't reach the Proof) + defect 1 provenance.
 * Read-only: walks the founder's stored versions and prints each version's book title, author,
 * language, chapter count — so we can see WHEN the ".ldocx" title appeared across the 10 edits
 * and whether a rename ever changed metadata.title. Never writes.
 * Run: npx tsx spikes/founder-versions-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const FOUNDER_ID = '1784744671298-h9o6o9tn2';

function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));

  for (const table of ['projects', 'versions']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((r) => (r as { name: string }).name);
    console.log(`${table} columns: ${cols.join(', ')}`);
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(FOUNDER_ID) as Record<string, unknown>;
  console.log('\nproject row keys:', Object.keys(project).join(', '));
  for (const [k, v] of Object.entries(project)) {
    if (typeof v === 'string' && v.length > 120) console.log(`  ${k}: <${v.length} chars>`);
    else console.log(`  ${k}: ${String(v)}`);
  }

  const versions = db.prepare('SELECT * FROM versions WHERE project_id = ? ORDER BY rowid').all(FOUNDER_ID) as Record<string, unknown>[];
  console.log(`\n${versions.length} versions:`);
  versions.forEach((v, i) => {
    const bookCol = ['book', 'book_json', 'data', 'snapshot'].find((c) => typeof v[c] === 'string');
    let title = '?', author = '?', lang = '?', chapters = '?';
    if (bookCol) {
      try {
        const book = JSON.parse(v[bookCol] as string);
        title = book.metadata?.title ?? '(none)';
        author = book.metadata?.author ?? '(none)';
        lang = book.metadata?.language ?? '(none)';
        chapters = String((book.mainContent ?? []).filter((c: { type: string }) => c.type === 'chapter').length);
      } catch { title = '(parse failed)'; }
    }
    const metaKeys = Object.keys(v).filter((k) => k !== bookCol);
    const metaStr = metaKeys.map((k) => `${k}=${String(v[k]).slice(0, 40)}`).join('  ');
    console.log(`  v${i} [${metaStr}]`);
    console.log(`      title="${title}"  author="${author}"  lang="${lang}"  chapters=${chapters}`);
  });

  db.close();
}

main();
