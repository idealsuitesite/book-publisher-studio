/**
 * BATCH_CONFIRM_LATENCY — the CADRAGE probe (read-only w.r.t. the real store; stops at the constats).
 * CTO directive 2026-07-23 (AUTHOR_EXPERIENCE verdicts, Axis 7 / P2). Measures the TRUE cost of a
 * batch "Make all chapters" the way the studio runs it today, so the correctif is decided on numbers.
 *
 * What the studio does today (StructureSuggestionsPanel.promote): it loops the N suggestions and, per
 * marker, issues ONE HTTP POST /:id/structure → EditBookUseCase.execute → snapshot() + apply +
 * repository.save(). This probe reproduces exactly that server-side path against a REAL
 * SqliteProjectRepository (a throwaway temp DB — never the founder's store), on a REAL imported book.
 *
 * The three questions the cadrage owes:
 *   C1 — how long does the current N-sequential batch take, and how does the PER-OP cost move as the
 *        batch proceeds (is it flat, or does it rise as the version log grows)?
 *   C2 — how heavy is one saved version (is it really a whole-book copy), and how big does the
 *        aggregate/db get after a batch of N (the version-log growth)?
 *   C3 — the CEILING: apply the same N promotions as ONE gesture (one snapshot, one save) — what would
 *        the batch cost if the round-trips and the repeated whole-table save were collapsed?
 *   S  — a pre-existing history sweep: seed v0 versions first, then time ONE more confirm, to expose
 *        the save()'s delete-all/reinsert-all-versions O(v) term independent of N.
 *
 * Read-only: a fresh import from a committed corpus fixture (no private data), a temp SQLite file
 * deleted at the end. Never writes the real store. Run: npx tsx spikes/batch-confirm-latency-cadrage.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ProjectService } from '../src/domain/services/ProjectService';
import { BookEditingService } from '../src/domain/services/BookEditingService';
import { EditBookUseCase } from '../src/application/use-cases/EditBookUseCase';
import { SqliteProjectRepository } from '../src/infrastructure/repositories/SqliteProjectRepository';
import { StructureSuggester } from '../src/domain/services/structureAssist/StructureSuggester';
import type { Book } from '../src/domain/models/Book';
import type { Project } from '../src/domain/models/Project';

const FIXTURE = join(process.cwd(), 'verification', 'corpus', 'generated-unstyled-3060w.docx');
const SETTINGS = { layoutName: 'letter', themeName: 'classic' } as const;

async function importBook(path: string): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(path));
  return new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'x.docx' }));
}

const ms = (t: bigint) => Number(t) / 1e6;
const kb = (n: number) => (n / 1024).toFixed(1);

/**
 * Real book body, K synthetic numbered markers interspersed as top-level body paragraphs (exactly
 * what the importer leaves when an author types "CHAPTER 1" as plain text — the assist's input).
 * Numbered markers are each distinct, so the A2 repetition guard never drops them. This gives a
 * controllable N over a real-sized book; the founder's real book measured N≈56.
 */
function withMarkers(book: Book, k: number): Book {
  const first = book.mainContent[0] as { content: unknown[] } | undefined;
  if (!first) return book;
  const body = [...(first.content as unknown[])];
  const step = Math.max(1, Math.floor(body.length / k));
  for (let i = k; i >= 1; i--) {
    const at = Math.min(body.length, i * step);
    body.splice(at, 0, { type: 'paragraph', id: `marker-${i}`, text: `CHAPTER ${i}` });
  }
  const mainContent = [...book.mainContent];
  mainContent[0] = { ...(mainContent[0] as object), content: body } as (typeof mainContent)[number];
  return { ...book, mainContent };
}

function dbSizeKb(path: string): string {
  try {
    return kb(statSync(path).size + (statSync(path + '-wal', { throwIfNoEntry: false })?.size ?? 0));
  } catch {
    return '?';
  }
}

/** A fresh temp repo + a project built around `book`, saved once (version log empty). */
async function freshProject(dir: string, tag: string, book: Book): Promise<{
  repo: SqliteProjectRepository;
  useCase: EditBookUseCase;
  project: Project;
  dbPath: string;
}> {
  const dbPath = join(dir, `${tag}.db`);
  const repo = new SqliteProjectRepository(dbPath);
  const projectService = new ProjectService();
  const useCase = new EditBookUseCase(repo, projectService, new BookEditingService());
  const project = projectService.create(book, SETTINGS, 'probe');
  await repo.save(project);
  return { repo, useCase, project, dbPath };
}

const BOOK3 = '1784812181217-cy7m12l0w'; // founder traversal 3, under-structured (assist's pole, N≈56)

/**
 * The founder-book probe (PRIVATE_MANUSCRIPT_FIXTURES — behavioural, never committed): read book 3
 * from the local store READ-ONLY, re-import fresh from its original bytes (#7 discipline), run the
 * REAL batchApply through EditBookUseCase against a THROWAWAY temp repo. The founder's project is
 * never written. Skipped cleanly where the store/book is absent (CI).
 */
async function founderProbe(dir: string): Promise<void> {
  const storePath = join(process.cwd(), 'data', 'studio.db');
  if (!existsSync(storePath)) {
    console.log('\n## FOUNDER PROBE — skipped (no local store — CI/other machine)');
    return;
  }
  const db = new DatabaseSync(storePath, { readOnly: true });
  const blobRow = db.prepare('SELECT bytes FROM blobs WHERE project_id = ?').get(BOOK3) as { bytes: Buffer | Uint8Array } | undefined;
  db.close();
  if (!blobRow) {
    console.log('\n## FOUNDER PROBE — skipped (book 3 not in this store)');
    return;
  }
  const raw = await new MammothParser().parse(Buffer.isBuffer(blobRow.bytes) ? blobRow.bytes : Buffer.from(blobRow.bytes));
  const fresh = new ASTBuilder().build(new HtmlNormalizer().normalize(raw.html, { fileName: 'book3.docx' }));
  const blockIds = new StructureSuggester().suggest(fresh).map((s) => s.blockId);

  const { repo, useCase, dbPath, project } = await freshProject(dir, 'founder', fresh);
  const id = project.id;
  const t0 = process.hrtime.bigint();
  await useCase.execute(id, { type: 'batchApply', op: 'promoteToChapter', ids: blockIds });
  const total = ms(process.hrtime.bigint() - t0);
  const saved = (await repo.findById(id))!;
  const chapters = saved.book.mainContent.filter((c) => c.type === 'chapter').length;
  console.log('\n## FOUNDER PROBE — book 3, the REAL assist batch (read-only, temp repo)');
  console.log(`N (assist suggestions): ${blockIds.length}`);
  console.log(`batchApply: ${total.toFixed(1)} ms   versions: ${saved.versions.length} (ONE)   chapters created: ${chapters}`);
  console.log(`db size after: ${dbSizeKb(dbPath)} KB   (the founder's stored project was NEVER written)`);
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'batch-latency-'));
  try {
    const realBook = await importBook(FIXTURE);
    const TARGET_N = 40; // controllable batch size over a real-sized body (founder's real book ≈56)
    const book = withMarkers(realBook, TARGET_N);
    const suggestions = new StructureSuggester().suggest(book);
    const blockIds = suggestions.map((s) => s.blockId);
    const N = blockIds.length;

    // Anchor the "whole book per version" claim: how big is ONE serialized version snapshot?
    const oneVersionKb = kb(Buffer.byteLength(JSON.stringify({ book, settings: SETTINGS })));
    console.log('# BATCH_CONFIRM_LATENCY — cadrage measurement');
    console.log(`fixture: generated-unstyled-3060w.docx`);
    console.log(`suggested chapters (N): ${N}`);
    console.log(`one version snapshot ≈ ${oneVersionKb} KB (a whole-book copy: ProjectService.snapshot stores book: project.book)`);
    if (N < 2) {
      console.log('\n(fixture yields <2 markers — the scaling sweep below still exposes the law.)');
    }

    // ---- C1 + C2: the CURRENT path — N sequential confirms, reverse doc order (as the panel does) ----
    {
      const { repo, useCase, dbPath, project } = await freshProject(dir, 'current', book);
      const id = project.id;
      const before = dbSizeKb(dbPath);
      const perOp: number[] = [];
      const t0 = process.hrtime.bigint();
      for (const blockId of [...blockIds].reverse()) {
        const a = process.hrtime.bigint();
        await useCase.execute(id, { type: 'promoteToChapter', blockId });
        perOp.push(ms(process.hrtime.bigint() - a));
      }
      const total = ms(process.hrtime.bigint() - t0);
      const saved = (await repo.findById(id))!;
      console.log('\n## C1/C2 — CURRENT path (N sequential confirms, one save each)');
      console.log(`total: ${total.toFixed(1)} ms   for N=${N}   (mean ${(total / Math.max(N, 1)).toFixed(1)} ms/op)`);
      if (perOp.length) {
        console.log(`per-op ms (in order): [${perOp.map((x) => x.toFixed(1)).join(', ')}]`);
        console.log(`  first op ${perOp[0].toFixed(1)} ms → last op ${perOp[perOp.length - 1].toFixed(1)} ms  (rise = the O(v) whole-table save)`);
      }
      console.log(`versions after batch: ${saved.versions.length}  (one per confirm — the log grew by N)`);
      console.log(`db size: ${before} KB → ${dbSizeKb(dbPath)} KB`);
    }

    // ---- C3: the CEILING — the SAME N promotions as ONE gesture (one snapshot, one save) ----
    {
      const projectService = new ProjectService();
      const editing = new BookEditingService();
      const { repo, dbPath, project } = await freshProject(dir, 'ceiling', book);
      const id = project.id;
      const t0 = process.hrtime.bigint();
      const loaded = (await repo.findById(id))!;
      // one snapshot for the whole gesture (Q2 coarse granularity: one command = one version)
      const snapped = projectService.snapshot(loaded, 'before make all chapters');
      let b = projectService.currentBook(snapped);
      for (const blockId of [...blockIds].reverse()) {
        b = editing.promoteToChapter(b, blockId);
      }
      await repo.save(projectService.replaceBook(snapped, b));
      const total = ms(process.hrtime.bigint() - t0);
      const saved = (await repo.findById(id))!;
      console.log('\n## C3 — CEILING (batch: one round-trip, one snapshot, one save)');
      console.log(`total: ${total.toFixed(1)} ms   versions after: ${saved.versions.length}  (ONE)`);
      console.log(`db size after: ${dbSizeKb(dbPath)} KB`);
    }

    // ---- S: pre-existing history sweep — time ONE confirm at growing v0 ----
    console.log('\n## S — save() cost vs pre-existing version count (one confirm each)');
    for (const v0 of [0, 10, 30, 60]) {
      const projectService = new ProjectService();
      const { repo, useCase, dbPath, project } = await freshProject(dir, `hist-${v0}`, book);
      const id = project.id;
      // seed v0 versions cheaply through the real save path
      let seeded = project;
      for (let i = 0; i < v0; i++) seeded = projectService.snapshot(seeded, `seed ${i}`);
      await repo.save(seeded);
      const oneBlock = blockIds[0];
      const a = process.hrtime.bigint();
      await useCase.execute(id, oneBlock ? { type: 'promoteToChapter', blockId: oneBlock } : { type: 'rename', id: seeded.book.mainContent[0]?.id ?? 'x', title: 'x' });
      const one = ms(process.hrtime.bigint() - a);
      console.log(`  v0=${String(v0).padStart(2)} versions → one confirm ${one.toFixed(1)} ms   db ${dbSizeKb(dbPath)} KB`);
    }

    // ---- JUDGE: the SAME batch through the REAL batchApply mutation (correctif A shipped) ----
    {
      const { repo, useCase, dbPath, project } = await freshProject(dir, 'judge', book);
      const id = project.id;
      const t0 = process.hrtime.bigint();
      await useCase.execute(id, { type: 'batchApply', op: 'promoteToChapter', ids: blockIds });
      const total = ms(process.hrtime.bigint() - t0);
      const saved = (await repo.findById(id))!;
      const chapters = saved.book.mainContent.filter((c) => c.type === 'chapter').length;
      console.log('\n## JUDGE — the real batchApply mutation (correctif A, one execute)');
      console.log(`total: ${total.toFixed(1)} ms   versions after: ${saved.versions.length} (ONE)   chapters: ${chapters}`);
      console.log(`db size after: ${dbSizeKb(dbPath)} KB   version label: "${saved.versions[0]?.label}"`);
      console.log(`  vs the current N-sequential path above — expected ~ceiling (§the correctif's gate).`);
    }

    // ---- FOUNDER-BOOK PROBE (read-only): the real book 3 (N≈56) through batchApply, temp repo ----
    await founderProbe(dir);

    console.log('\n(temp db discarded; the real store was never touched.)');
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* WAL handles held until process exit — the OS reaps the temp dir. Best-effort. */
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
