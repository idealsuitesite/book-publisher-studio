import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ProjectRepository, ListProjectsOptions } from '../../domain/ports/ProjectRepository';
import type { Project, ProjectSummary, BookVersion } from '../../domain/models/Project';
import { toProjectSummary } from '../../domain/models/Project';

/**
 * The durable `ProjectRepository` (PERSISTENCE.md, ADR-0048): SQLite via `node:sqlite` —
 * ADR-0046's measured choice (list() 317ms vs 7015ms for files; crash-mid-write rolls back
 * vs corrupts; zero new dependencies on Node ≥ 23).
 *
 * Storage shape (PERSISTENCE.md §3): the aggregate JSON holds NEITHER version payloads NOR
 * asset bytes. Versions shard into their own rows (the answer to ADR-0046's 45MB finding —
 * list() and summary updates never touch them, and partial loading later is repository-
 * internal). Bytes live in `blobs` and rehydrate as real `Buffer`s — the `structuredClone`
 * downgrade scar (ADR-0047), institutionalized as a tested boundary. All writes for one
 * aggregate share one transaction: a consistency boundary that can be torn in half is not one.
 */
const SCHEMA_VERSION = 1;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** JSON.parse with Date revival — ISO-shaped strings become Dates again (PERSISTENCE.md §4). */
function hydrate<T>(json: string): T {
  return JSON.parse(json, (_key, value) =>
    typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : value
  ) as T;
}

/** The aggregate column shape: no version payloads, no asset bytes (PERSISTENCE.md §3). Shared by
 *  `save` and `appendVersion` so the head serialisation is one truth. */
function stripAggregate(project: Project): Project {
  return {
    ...project,
    versions: [],
    assets: project.assets.map((asset) => {
      if (!asset.data) return asset;
      const rest = { ...asset };
      delete rest.data;
      return rest;
    }),
  };
}

export class SqliteProjectRepository implements ProjectRepository {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.migrate();
  }

  /** Forward-only migrations keyed on PRAGMA user_version (PERSISTENCE.md §5). */
  private migrate(): void {
    const { user_version: version } = this.db
      .prepare('PRAGMA user_version')
      .get() as { user_version: number };

    if (version < 1) {
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          aggregate TEXT NOT NULL,
          name TEXT NOT NULL,
          book_title TEXT NOT NULL,
          author TEXT NOT NULL,
          version_count INTEGER NOT NULL,
          published_targets TEXT NOT NULL,
          cover_asset_id TEXT,
          archived_at TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_projects_listing ON projects (archived_at, updated_at DESC);
        CREATE TABLE IF NOT EXISTS versions (
          project_id TEXT NOT NULL,
          id TEXT NOT NULL,
          number INTEGER NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY (project_id, id)
        );
        CREATE TABLE IF NOT EXISTS blobs (
          project_id TEXT NOT NULL,
          asset_id TEXT NOT NULL,
          bytes BLOB NOT NULL,
          PRIMARY KEY (project_id, asset_id)
        );
        PRAGMA user_version = ${SCHEMA_VERSION};
      `);
    }
  }

  async findById(id: string): Promise<Project | undefined> {
    const row = this.db.prepare('SELECT aggregate FROM projects WHERE id = ?').get(id) as
      | { aggregate: string }
      | undefined;
    if (!row) return undefined;

    const stripped = hydrate<Project>(row.aggregate);

    const versionRows = this.db
      .prepare('SELECT payload FROM versions WHERE project_id = ? ORDER BY number ASC')
      .all(id) as Array<{ payload: string }>;
    const versions = versionRows.map((v) => hydrate<BookVersion>(v.payload));

    const blobRows = this.db
      .prepare('SELECT asset_id, bytes FROM blobs WHERE project_id = ?')
      .all(id) as Array<{ asset_id: string; bytes: Uint8Array }>;
    const bytesByAsset = new Map(blobRows.map((b) => [b.asset_id, Buffer.from(b.bytes)]));

    return {
      ...stripped,
      versions,
      assets: stripped.assets.map((asset) => {
        const data = bytesByAsset.get(asset.id);
        return data ? { ...asset, data } : asset;
      }),
    };
  }

  async getVersion(projectId: string, versionId: string): Promise<BookVersion | undefined> {
    const row = this.db
      .prepare('SELECT payload FROM versions WHERE project_id = ? AND id = ?')
      .get(projectId, versionId) as { payload: string } | undefined;
    return row ? hydrate<BookVersion>(row.payload) : undefined;
  }

  async appendVersion(project: Project, version: BookVersion): Promise<void> {
    // The explicit append seam (APPEND_ONLY_PERSISTENCE B): update the head aggregate AND append this
    // ONE version, in ONE transaction — atomic (torn-aggregate = no aggregate). Idempotent on the
    // stable (project_id, id): a retry after a partial failure yields exactly one version.
    const summary = toProjectSummary(project);
    const stripped = stripAggregate(project);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO projects
           (id, aggregate, name, book_title, author, version_count, published_targets,
            cover_asset_id, archived_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          project.id,
          JSON.stringify(stripped),
          summary.name,
          summary.bookTitle,
          summary.author ?? '',
          summary.versionCount,
          JSON.stringify(summary.publishedTargets),
          summary.coverAssetId ?? null,
          summary.archivedAt?.toISOString() ?? null,
          summary.updatedAt.toISOString()
        );
      // Append-only, idempotent: existing version rows are immutable and untouched; a re-append of
      // the same id is a no-op (never a duplicate, never a rewrite of the whole log).
      this.db
        .prepare(
          `INSERT INTO versions (project_id, id, number, payload) VALUES (?, ?, ?, ?)
           ON CONFLICT (project_id, id) DO NOTHING`
        )
        .run(project.id, version.id, version.number, JSON.stringify(version));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async list(options?: ListProjectsOptions): Promise<ProjectSummary[]> {
    const where = options?.includeArchived ? '' : 'WHERE archived_at IS NULL';
    const rows = this.db
      .prepare(
        `SELECT id, name, book_title, author, version_count, published_targets, cover_asset_id,
                archived_at, updated_at
         FROM projects ${where} ORDER BY updated_at DESC`
      )
      .all() as Array<{
      id: string;
      name: string;
      book_title: string;
      author: string;
      version_count: number;
      published_targets: string;
      cover_asset_id: string | null;
      archived_at: string | null;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      bookTitle: row.book_title,
      // The denormalized `author` column is NOT NULL; an absent author is stored as '' and read
      // back as undefined (FOUNDER_TRAVERSAL defect 2) — the aggregate JSON is the honest source
      // of truth (author already undefined there), this column is a listing cache. No migration:
      // '' satisfies the existing schema and means "absent" on every existing DB.
      author: row.author || undefined,
      coverAssetId: row.cover_asset_id ?? undefined,
      versionCount: row.version_count,
      publishedTargets: JSON.parse(row.published_targets) as string[],
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
      updatedAt: new Date(row.updated_at),
    }));
  }

  async save(project: Project): Promise<void> {
    const summary = toProjectSummary(project);
    const stripped = stripAggregate(project);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO projects
           (id, aggregate, name, book_title, author, version_count, published_targets,
            cover_asset_id, archived_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          project.id,
          JSON.stringify(stripped),
          summary.name,
          summary.bookTitle,
          summary.author ?? '',
          summary.versionCount,
          JSON.stringify(summary.publishedTargets),
          summary.coverAssetId ?? null,
          summary.archivedAt?.toISOString() ?? null,
          summary.updatedAt.toISOString()
        );

      // Delete-and-reinsert keeps replace semantics simple; version rows are small (per-row)
      // and immutable snapshots never change content, so no diffing is worth its complexity.
      this.db.prepare('DELETE FROM versions WHERE project_id = ?').run(project.id);
      const insertVersion = this.db.prepare(
        'INSERT INTO versions (project_id, id, number, payload) VALUES (?, ?, ?, ?)'
      );
      for (const version of project.versions) {
        insertVersion.run(project.id, version.id, version.number, JSON.stringify(version));
      }

      this.db.prepare('DELETE FROM blobs WHERE project_id = ?').run(project.id);
      const insertBlob = this.db.prepare(
        'INSERT INTO blobs (project_id, asset_id, bytes) VALUES (?, ?, ?)'
      );
      for (const asset of project.assets) {
        if (asset.data) insertBlob.run(project.id, asset.id, asset.data);
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
      this.db.prepare('DELETE FROM versions WHERE project_id = ?').run(id);
      this.db.prepare('DELETE FROM blobs WHERE project_id = ?').run(id);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Dev/test affordance — the baseline capture's deterministic reset. Not part of the port. */
  clear(): void {
    this.db.exec('DELETE FROM projects; DELETE FROM versions; DELETE FROM blobs;');
  }

  /** Tests close their file handles; the app holds one for its lifetime. */
  close(): void {
    this.db.close();
  }
}
