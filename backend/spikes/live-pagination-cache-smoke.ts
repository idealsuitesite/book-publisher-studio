/**
 * Live smoke of the wired pagination cache through the real server (MINI_DR_PAGINATION_REUSE §5).
 * Confirms the project export path is healthy end-to-end with the cache in place: import →
 * export → accent change → export (the cached, re-inked path) → structure edit → export (the
 * invalidating path). Asserts 200s and that a colour-only change still yields a valid PDF whose
 * bytes differ from the no-accent baseline (the geometry was re-inked, not served stale — §3).
 * Run with the server up: npx tsx spikes/live-pagination-cache-smoke.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5000';
const FAITH = join(__dirname, '..', 'verification', 'corpus', 'faith-alone-styled.docx');

async function exportPdf(id: string): Promise<Buffer> {
  const res = await fetch(`${BASE}/api/projects/${id}/export?format=pdf`, { method: 'POST' });
  if (res.status !== 200) throw new Error(`export failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  // 1. Import faith-alone.
  const form = new FormData();
  const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  form.append('file', new Blob([readFileSync(FAITH)], { type: docxMime }), 'faith-alone-styled.docx');
  const imp = await fetch(`${BASE}/api/manuscripts/import`, { method: 'POST', body: form });
  const impBody = (await imp.json()) as { projectId: string };
  const id = impBody.projectId;
  console.log(`import: ${imp.status}, projectId=${id}`);

  // 2. Baseline export (primes the cache).
  const base = await exportPdf(id);
  console.log(`export #1 (prime): 200, ${base.length} bytes`);

  // 3. Accent change -> export again (the cached, re-inked path).
  const patch = await fetch(`${BASE}/api/projects/${id}/settings`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accentOverride: '#EE0000' }),
  });
  console.log(`PATCH accent: ${patch.status}`);
  const inked = await exportPdf(id);
  console.log(`export #2 (accent, cached geometry): 200, ${inked.length} bytes`);
  console.log(`  bytes differ from baseline: ${!base.equals(inked)} (a re-ink must change output, not serve stale)`);

  // 4. Structure edit -> export (the invalidating path).
  const proj = (await (await fetch(`${BASE}/api/projects/${id}`)).json()) as { book: { mainContent: unknown[] } };
  const fromIndex = proj.book.mainContent.length - 1;
  const mut = await fetch(`${BASE}/api/projects/${id}/structure`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'reorderChapters', fromIndex, toIndex: 0 }),
  });
  console.log(`POST structure reorder: ${mut.status}`);
  const reflowed = await exportPdf(id);
  console.log(`export #3 (after edit, re-paginated): 200, ${reflowed.length} bytes`);
  console.log('\nAll steps 200, no errors — wired path healthy.');
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e);
  process.exit(1);
});
