/**
 * FOUNDER_TRAVERSAL defect 4 — live reproduction on a THROWAWAY project (never the founder's).
 * Proves the fix through the real HTTP route: import → editFrontMatter sets a new title-page
 * title → BOTH the canonical book title and the title-page title change (they were separate
 * fields). Then deletes the throwaway (no trace). Also records the finding that no project-rename
 * surface exists, so the founder's exact gesture is unreproducible — reported, not invented.
 * Run (server up): npx tsx spikes/founder-defect4-repro-probe.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const FOUNDER_ID = '1784744671298-h9o6o9tn2';
const BASE = 'http://localhost:5000';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function main() {
  const db = new DatabaseSync(join(process.cwd(), 'data', 'studio.db'));
  const blob = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(FOUNDER_ID) as { bytes: Buffer | Uint8Array };
  const buffer = Buffer.isBuffer(blob.bytes) ? blob.bytes : Buffer.from(blob.bytes);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: DOCX_MIME }), 'throwaway-defect4.docx');
  const imp = await fetch(`${BASE}/api/manuscripts/import`, { method: 'POST', body: form });
  const impJson = (await imp.json()) as { projectId?: string };
  const id = impJson.projectId;
  if (!id) { console.log('import failed', imp.status); db.close(); return; }

  const before = await (await fetch(`${BASE}/api/projects/${id}`)).json() as { book: { metadata: { title: string } }; };
  console.log(`imported throwaway ${id}`);
  console.log(`  canonical title BEFORE: "${before.book.metadata.title}"`);

  // The only book-title-editing surface: editFrontMatter's title-page title.
  const edit = await fetch(`${BASE}/api/projects/${id}/structure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'editFrontMatter', titlePage: { title: 'The Author-Chosen Title', author: 'A Real Author' } }),
  });
  console.log(`  editFrontMatter HTTP ${edit.status}`);

  const after = await (await fetch(`${BASE}/api/projects/${id}`)).json() as {
    book: { metadata: { title: string }; frontMatter?: { titlePage?: { title?: string } } };
  };
  console.log(`  canonical book.metadata.title AFTER : "${after.book.metadata.title}"`);
  console.log(`  frontMatter.titlePage.title  AFTER : "${after.book.frontMatter?.titlePage?.title}"`);
  const unified = after.book.metadata.title === 'The Author-Chosen Title'
    && after.book.frontMatter?.titlePage?.title === 'The Author-Chosen Title';
  console.log(`  => one gesture updated BOTH titles: ${unified ? 'YES (defect 4 fixed)' : 'NO'}`);

  // Cleanup — leave no trace (never the founder project).
  if (id !== FOUNDER_ID) {
    for (const table of ['versions', 'blobs', 'projects']) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((r) => (r as { name: string }).name);
      const key = cols.includes('project_id') ? 'project_id' : table === 'projects' ? 'id' : undefined;
      if (key) db.prepare(`DELETE FROM ${table} WHERE ${key} = ?`).run(id);
    }
  }
  const remaining = db.prepare('SELECT name FROM projects ORDER BY updated_at DESC').all().map((r) => (r as { name: string }).name);
  console.log('remaining projects:', remaining.join(' | '));
  db.close();
}

main();
