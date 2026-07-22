/**
 * Read-mostly measurement: does the LIVE server (current main) reproduce the ".ldocx" title
 * defect? Imports the founder's stored source bytes through the real HTTP import endpoint under
 * the exact same filename, prints the resulting book.metadata.title/author/language, then
 * DELETES the throwaway project from the store (no DELETE route exists; the SQLite delete is the
 * documented HARNESS_CLEANUP_PATH gesture) — leaving no trace. The founder project is untouched.
 * Run (server must be up): npx tsx spikes/founder-live-import-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const FOUNDER_ID = '1784744671298-h9o6o9tn2';
// Two names on purpose: the founder's own ".ldocx" (rejected by the current `&&` filter — the
// pre-fix `||` filter accepted it), and a valid ".docx" to measure current-main's title behavior
// on an import that passes the door.
const NAMES = ['Without religious performance.ldocx', 'Without religious performance.docx'];
const BASE = 'http://localhost:5000';

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(FOUNDER_ID) as { bytes: Buffer | Uint8Array };
  const buffer = Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes);
  console.log(`founder source bytes: ${buffer.length}`);

  for (const name of NAMES) {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), name);
    const res = await fetch(`${BASE}/api/manuscripts/import`, { method: 'POST', body: form });
    let json: { book?: { metadata?: Record<string, unknown> }; projectId?: string; error?: string } = {};
    try { json = await res.json(); } catch { /* non-JSON error body */ }
    console.log(`\n"${name}" → HTTP ${res.status}`);
    if (res.ok) {
      console.log(`  title    = "${json.book?.metadata?.title}"`);
      console.log(`  author   = "${json.book?.metadata?.author}"`);
      console.log(`  language = "${json.book?.metadata?.language}"`);
    } else {
      console.log(`  rejected: ${JSON.stringify(json).slice(0, 120)}`);
    }
    // Clean up any throwaway — leave no trace (never the founder project).
    if (json.projectId && json.projectId !== FOUNDER_ID) {
      for (const table of ['versions', 'blobs', 'projects']) {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((r) => (r as { name: string }).name);
        const key = cols.includes('project_id') ? 'project_id' : table === 'projects' ? 'id' : undefined;
        if (!key) continue;
        const r = db.prepare(`DELETE FROM ${table} WHERE ${key} = ?`).run(json.projectId);
        if (r.changes > 0) console.log(`  cleaned ${table}: ${r.changes} row(s)`);
      }
    }
  }
  const remaining = db.prepare('SELECT name FROM projects ORDER BY updated_at DESC').all().map((r) => (r as { name: string }).name);
  console.log('\nremaining projects:', remaining.join(' | '));
  db.close();
}

main();
