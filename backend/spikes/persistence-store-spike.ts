/**
 * Persistence-store spike — AGGREGATES_AND_PERSISTENCE.md Question 6 ("Which store?").
 * Throwaway exploratory script, NOT part of the layered src/ architecture and NOT covered by
 * the test suite. Run manually via `npx tsx spikes/persistence-store-spike.ts`.
 *
 * Measures exactly what Question 6 said a spike must measure, no more:
 *   1. one aggregate loaded and saved WHOLE (the port's contract),
 *   2. a cheap summary projection for the library (list() must not load aggregates),
 *   3. blob storage for assets/original uploads that does not bloat the aggregate.
 *
 * Candidates, chosen for a reason each:
 *   A. JSON file per aggregate (node:fs) — the zero-dependency baseline. If it wins, nothing
 *      is installed and nothing is configured. Its known weakness is atomicity, which is
 *      measured here rather than assumed.
 *   B. SQLite via node:sqlite — Node 24 ships it built in (verified on this machine, v24.18.0),
 *      so it is ALSO zero-new-dependency. Transactional by nature; summaries become indexed
 *      columns; blobs become a separate table.
 *   Postgres/document stores are deliberately NOT spiked: they require a running server, and
 *   this product's own reference points (Atticus, Affinity Publisher — the CTO's stated
 *   inspirations) are local-first desktop tools. A client-server store belongs to the
 *   Cloud Sync sprint (Sprint 15), not to "where does an author's project live on their machine".
 *
 * Uses the REAL domain code (ProjectService, createBook, toProjectSummary) — per ADR-0031/0032,
 * "confirmed, not guessed" applies to our own code, so the spike round-trips real aggregates,
 * not hand-shaped lookalikes. ADR-0045 is the fresh reminder of what guessing costs.
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
import { DatabaseSync } from 'node:sqlite';
import { ProjectService } from '../src/domain/services/ProjectService';
import { createBook } from '../src/domain/models/Book';
import { toProjectSummary, type Project, type ProjectSummary } from '../src/domain/models/Project';
import type { PublishingReport } from '../src/domain/models/PublishingReport';

const OUT = join(__dirname, 'output', 'persistence');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'json'), { recursive: true });

// ---------------------------------------------------------------------------------------------
// Realistic data. A mid-sized book, a real 5MB source upload, versions accumulated over months.
// ---------------------------------------------------------------------------------------------
let n = 0;
const service = new ProjectService(() => `id-${++n}`);

function realisticBook(title: string) {
  const book = createBook({ title, author: 'Jean Dupont', language: 'fr', isbn: '978-2-1234-5680-3' });
  // ~80k words of content blocks, the ballpark of a real 300-page manuscript.
  const chapters = Array.from({ length: 20 }, (_, c) => ({
    type: 'chapter' as const,
    id: `ch-${c}`,
    number: c + 1,
    title: `Chapitre ${c + 1}`,
    blocks: Array.from({ length: 80 }, (_, b) => ({
      type: 'paragraph' as const,
      id: `ch-${c}-p-${b}`,
      runs: [{ text: 'Il faut imaginer une phrase française de longueur tout à fait ordinaire, répétée. '.repeat(6) }],
    })),
  }));
  return { ...book, mainContent: chapters as unknown as typeof book.mainContent };
}

const report = (target: string, status: 'PASS' | 'FAIL', at: Date): PublishingReport => ({
  status, target, issues: [], warnings: [], artifacts: ['pdf'],
  generatedAt: at, duration: 12, summary: `${status} - 0 errors, 0 warnings`,
});

function realisticProject(i: number, versions: number): Project {
  let p = service.create(realisticBook(`Livre ${i}`), { layoutName: 'kdp-6x9', themeName: 'classic' });
  // The original upload: 5MB of bytes, exactly the thing that must NOT bloat the aggregate.
  p = service.attachSource(p, `Livre ${i}.docx`,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    Buffer.alloc(5 * 1024 * 1024, i % 251));
  for (let v = 0; v < versions; v++) p = service.snapshot(p, v % 5 === 0 ? `pass ${v}` : undefined);
  p = service.recordPublication(p, report('kdp', 'PASS', new Date('2026-03-01')));
  return p;
}

function ms(f: () => void): number {
  const t0 = process.hrtime.bigint();
  f();
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

// ---------------------------------------------------------------------------------------------
// Serialization shared by both candidates: Dates and Buffers do not survive JSON.parse naively.
// This is itself a finding — whatever store is chosen needs an explicit (de)hydration layer.
// ---------------------------------------------------------------------------------------------
function hydrate(json: string): Project {
  return JSON.parse(json, (_k, v) => {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return new Date(v);
    if (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data)) return Buffer.from(v.data);
    return v;
  });
}

// ---------------------------------------------------------------------------------------------
// Candidate A: one JSON file per aggregate. Blobs measured both embedded and separated.
// ---------------------------------------------------------------------------------------------
function candidateJson(projects: Project[], big: Project) {
  const dir = join(OUT, 'json');
  const results: Record<string, string> = {};

  // A1: naive embedded blob — what happens if the 5MB Buffer rides inside the JSON.
  const embeddedSave = ms(() => {
    const tmp = join(dir, `${big.id}.json.tmp`);
    writeFileSync(tmp, JSON.stringify(big));
    renameSync(tmp, join(dir, `${big.id}.json`)); // atomic-rename discipline, the best files can do
  });
  const embeddedSize = readFileSync(join(dir, `${big.id}.json`)).byteLength;
  const embeddedLoad = ms(() => { hydrate(readFileSync(join(dir, `${big.id}.json`), 'utf8')); });
  results['A1 embedded-blob save/load/size'] =
    `${embeddedSave.toFixed(1)}ms / ${embeddedLoad.toFixed(1)}ms / ${(embeddedSize / 1e6).toFixed(1)}MB`;

  // A2: blob separated to its own file, aggregate keeps the reference (the design the model
  // already implies — assets are referenced by id).
  const { data, stripped } = stripBlobs(big);
  const sepSave = ms(() => {
    for (const [id, bytes] of data) writeFileSync(join(dir, `${big.id}-${id}.blob`), bytes);
    const tmp = join(dir, `${big.id}.json.tmp`);
    writeFileSync(tmp, JSON.stringify(stripped));
    renameSync(tmp, join(dir, `${big.id}.json`));
  });
  const sepSize = readFileSync(join(dir, `${big.id}.json`)).byteLength;
  const sepLoad = ms(() => { hydrate(readFileSync(join(dir, `${big.id}.json`), 'utf8')); });
  results['A2 separated-blob save/load/aggregate-size'] =
    `${sepSave.toFixed(1)}ms / ${sepLoad.toFixed(1)}ms / ${(sepSize / 1e6).toFixed(1)}MB`;

  // A3: the library listing — the files candidate has no index, so list() must open every file.
  for (const p of projects) {
    const { stripped: s } = stripBlobs(p);
    writeFileSync(join(dir, `${p.id}.json`), JSON.stringify(s));
  }
  let summaries: ProjectSummary[] = [];
  const listMs = ms(() => {
    summaries = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => toProjectSummary(hydrate(readFileSync(join(dir, f), 'utf8'))));
  });
  results[`A3 list() over ${summaries.length} projects`] = `${listMs.toFixed(1)}ms (loads EVERY aggregate)`;

  // A4: atomicity under interruption — simulate a crash mid-write with no rename discipline.
  writeFileSync(join(dir, 'victim.json'), JSON.stringify(stripped));
  const full = JSON.stringify(stripped);
  writeFileSync(join(dir, 'victim.json'), full.slice(0, Math.floor(full.length / 2))); // "crash"
  let corrupted = false;
  try { hydrate(readFileSync(join(dir, 'victim.json'), 'utf8')); } catch { corrupted = true; }
  results['A4 torn write without rename discipline'] = corrupted
    ? 'CORRUPTED aggregate (unreadable) — rename discipline is load-bearing, not optional'
    : 'survived (unexpected)';

  return results;
}

function stripBlobs(p: Project): { data: Array<[string, Buffer]>; stripped: Project } {
  const data: Array<[string, Buffer]> = [];
  const assets = p.assets.map((a) => {
    if (a.data) { data.push([a.id, a.data]); const { data: _d, ...rest } = a; return rest; }
    return a;
  });
  return { data, stripped: { ...p, assets: assets as Project['assets'] } };
}

// ---------------------------------------------------------------------------------------------
// Candidate B: node:sqlite. Aggregate as a JSON document column; summary fields as real columns
// so list() is an indexed query; blobs in their own table.
// ---------------------------------------------------------------------------------------------
function candidateSqlite(projects: Project[], big: Project) {
  const db = new DatabaseSync(join(OUT, 'spike.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, aggregate TEXT NOT NULL,
      name TEXT NOT NULL, book_title TEXT NOT NULL, author TEXT NOT NULL,
      version_count INTEGER NOT NULL, archived_at TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE blobs (project_id TEXT NOT NULL, asset_id TEXT NOT NULL, bytes BLOB NOT NULL,
      PRIMARY KEY (project_id, asset_id));
    CREATE INDEX idx_projects_updated ON projects(archived_at, updated_at DESC);
  `);
  const insert = db.prepare(`INSERT OR REPLACE INTO projects VALUES (?,?,?,?,?,?,?,?)`);
  const insertBlob = db.prepare(`INSERT OR REPLACE INTO blobs VALUES (?,?,?)`);
  const results: Record<string, string> = {};

  // B1: whole-aggregate transactional save, blob separated, both in ONE transaction —
  // the atomicity the JSON candidate cannot give across two files.
  const saveMs = ms(() => {
    const { data, stripped } = stripBlobs(big);
    const s = toProjectSummary(stripped);
    db.exec('BEGIN');
    insert.run(big.id, JSON.stringify(stripped), s.name, s.bookTitle, s.author,
      s.versionCount, s.archivedAt?.toISOString() ?? null, s.updatedAt.toISOString());
    for (const [id, bytes] of data) insertBlob.run(big.id, id, bytes);
    db.exec('COMMIT');
  });
  results['B1 transactional save (aggregate + 5MB blob)'] = `${saveMs.toFixed(1)}ms`;

  // B2: whole-aggregate load.
  const get = db.prepare(`SELECT aggregate FROM projects WHERE id = ?`);
  const loadMs = ms(() => { hydrate((get.get(big.id) as { aggregate: string }).aggregate); });
  results['B2 whole-aggregate load'] = `${loadMs.toFixed(1)}ms`;

  // B3: the library listing — real columns, no aggregate touched.
  db.exec('BEGIN');
  for (const p of projects) {
    const { stripped: s2 } = stripBlobs(p);
    const s = toProjectSummary(s2);
    insert.run(p.id, JSON.stringify(s2), s.name, s.bookTitle, s.author,
      s.versionCount, s.archivedAt?.toISOString() ?? null, s.updatedAt.toISOString());
  }
  db.exec('COMMIT');
  const list = db.prepare(
    `SELECT id, name, book_title, author, version_count, updated_at
     FROM projects WHERE archived_at IS NULL ORDER BY updated_at DESC`);
  let rows = 0;
  const listMs = ms(() => { rows = (list.all() as unknown[]).length; });
  results[`B3 list() over ${rows} projects`] = `${listMs.toFixed(2)}ms (summary columns, zero aggregates loaded)`;

  // B4: atomicity — BEGIN, write, simulate crash by never committing, reopen.
  db.exec('BEGIN');
  insert.run('victim', 'not even json', 'x', 'x', 'x', 0, null, new Date().toISOString());
  db.close(); // crash: the transaction dies with the connection
  const db2 = new DatabaseSync(join(OUT, 'spike.db'));
  const victim = db2.prepare(`SELECT id FROM projects WHERE id = 'victim'`).get();
  results['B4 crash mid-transaction'] = victim
    ? 'partial write VISIBLE (bad)'
    : 'transaction rolled back — store never saw the partial state';
  db2.close();
  return results;
}

// ---------------------------------------------------------------------------------------------
console.log('Building realistic aggregates (this is the slow part, not the stores)...');
const big = realisticProject(0, 50);           // 50 versions of an 80k-word book + 5MB source
const projects = Array.from({ length: 200 }, (_, i) => realisticProject(i + 1, 2));
console.log(`  aggregate JSON size, blob stripped: ${(JSON.stringify(stripBlobs(big).stripped).length / 1e6).toFixed(1)}MB`);

console.log('\n=== Candidate A: JSON file per aggregate ===');
for (const [k, v] of Object.entries(candidateJson(projects, big))) console.log(`  ${k}: ${v}`);

console.log('\n=== Candidate B: SQLite (node:sqlite, built into Node 24) ===');
for (const [k, v] of Object.entries(candidateSqlite(projects, big))) console.log(`  ${k}: ${v}`);
