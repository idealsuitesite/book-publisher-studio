/**
 * FOUNDER_TRAVERSAL defect 6 — creates a THROWAWAY 114-page project (the founder's bytes) so the
 * frontend proof latency can be measured in the browser on a disposable project (never the
 * founder's). Prints the id. Also times the live PDF export round trip (the network+render half
 * of the perceived cost). A second arg `delete <id>` cleans it up afterwards.
 * Run: npx tsx spikes/founder-defect6-throwaway.ts        (create + time)
 *      npx tsx spikes/founder-defect6-throwaway.ts delete <id>   (cleanup)
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const FOUNDER_ID = '1784744671298-h9o6o9tn2';
const BASE = 'http://localhost:5000';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function cleanup(id: string) {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  for (const table of ['versions', 'blobs', 'projects']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((r) => (r as { name: string }).name);
    const key = cols.includes('project_id') ? 'project_id' : table === 'projects' ? 'id' : undefined;
    if (key) db.prepare(`DELETE FROM ${table} WHERE ${key} = ?`).run(id);
  }
  console.log(`deleted ${id}`);
  console.log('remaining:', db.prepare('SELECT name FROM projects').all().map((r) => (r as { name: string }).name).join(' | '));
  db.close();
}

async function main() {
  if (process.argv[2] === 'delete' && process.argv[3]) { cleanup(process.argv[3]); return; }

  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(FOUNDER_ID) as { bytes: Buffer | Uint8Array };
  const buffer = Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes);
  db.close();

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: DOCX_MIME }), 'throwaway-defect6.docx');
  const imp = await fetch(`${BASE}/api/manuscripts/import`, { method: 'POST', body: form });
  const id = ((await imp.json()) as { projectId?: string }).projectId;
  if (!id) { console.log('import failed', imp.status); return; }
  console.log(`THROWAWAY project id: ${id}`);
  console.log(`open in browser: ${BASE.replace('5000', '3000')}/projects/${id}`);

  // Time the live PDF export round trip a few times (the network+render half of the perceived
  // theme-switch cost; the 500ms REFRESH_DEBOUNCE_MS and the <embed> native-PDF reload are on top).
  for (const layout of ['letter', 'letter', 'letter']) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/projects/${id}/export`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'pdf', layoutName: layout }),
    });
    const bytes = Buffer.from(await res.arrayBuffer());
    console.log(`  export round trip: ${(performance.now() - t0).toFixed(0)}ms  (${bytes.length} bytes, HTTP ${res.status})`);
  }
}

main();
