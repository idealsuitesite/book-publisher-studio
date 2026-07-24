import type { ProjectRepository, ListProjectsOptions } from '../../domain/ports/ProjectRepository';
import type { Project, ProjectSummary, BookVersion } from '../../domain/models/Project';
import { toProjectSummary } from '../../domain/models/Project';

/**
 * A real, working `ProjectRepository` that keeps aggregates in memory.
 *
 * Not a stub and not a placeholder — this is the only implementation until the storage spike
 * runs (AGGREGATES_AND_PERSISTENCE.md Question 6), and it exists so the port can be proven
 * against a real caller before a database is chosen. That is the same discipline Sprint 8 used:
 * `SubmissionValidator` was proven against a fake `ValidationRuleProvider` containing no KDP
 * class at all, which is why the port survived contact with the real one unchanged.
 *
 * **Data does not survive a restart.** That is the honest, current state of persistence in this
 * product — Sprint 7 Decision 2 has not yet been amended in code, only in principle
 * (ADR-0041 Constraint 2). This class makes the boundary real without pretending the durability
 * question is answered.
 *
 * Stores a structured clone on write and returns one on read, so a caller holding a Project
 * cannot reach back through the reference and mutate stored state — which would silently break
 * the immutability every version snapshot depends on.
 */
export class InMemoryProjectRepository implements ProjectRepository {
  // The stored aggregate keeps FULL versions (with book+settings) as the truth; findById returns
  // the stripped INDEX from them, so this test double behaves exactly like the durable store
  // (APPEND_ONLY_PERSISTENCE B) rather than drifting from it.
  private readonly projects = new Map<string, Project>();

  async findById(id: string): Promise<Project | undefined> {
    const stored = this.projects.get(id);
    if (!stored) return undefined;
    // Return the head + the version INDEX: metadata only, NO book/settings payload (DR D1). A version's
    // book is loaded on demand via getVersion — mirroring Sqlite so a caller can never lean on a
    // payload findById did not promise.
    return { ...cloneProject(stored), versions: stored.versions.map(toIndexEntry) };
  }

  async getVersion(projectId: string, versionId: string): Promise<BookVersion | undefined> {
    const stored = this.projects.get(projectId);
    const version = stored?.versions.find((v) => v.id === versionId);
    // Clone so a caller cannot mutate stored state through the returned version (the same isolation
    // findById gives). structuredClone revives Dates; version books carry no Buffers.
    return version ? structuredClone(version) : undefined;
  }

  async appendVersion(project: Project, version: BookVersion): Promise<void> {
    // The append seam (DR D3): update the head, and append this ONE FULL version idempotently (by id).
    // The stored versions are the truth — take them from the store, not from `project.versions` (which
    // is the index findById handed the caller), so a re-append never duplicates and never rewrites.
    const existing = this.projects.get(project.id);
    const base = existing ? existing.versions : [];
    const head = cloneProject(project);
    head.versions = base.some((v) => v.id === version.id) ? base : [...base, structuredClone(version)];
    this.projects.set(project.id, head);
  }

  async list(options?: ListProjectsOptions): Promise<ProjectSummary[]> {
    // Derived on read rather than maintained on write, so a summary cannot drift from its
    // aggregate. Newest first: a library is browsed by recency, not by insertion order.
    // Archived projects are filtered out unless asked for (ADR-0044).
    return [...this.projects.values()]
      .filter((project) => options?.includeArchived || !project.archivedAt)
      .map(toProjectSummary)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async save(project: Project): Promise<void> {
    // HEAD-ONLY (DR D3): persist the head, but NEVER the version rows — version creation is
    // appendVersion's alone. The stored full versions are preserved; `project.versions` (the index the
    // caller holds) is deliberately not written, or the payloads would be clobbered with book-less
    // index entries. A first save of a fresh project carries no versions, so nothing is lost.
    const existing = this.projects.get(project.id);
    const head = cloneProject(project);
    head.versions = existing ? existing.versions : head.versions;
    this.projects.set(project.id, head);
  }

  async delete(id: string): Promise<void> {
    this.projects.delete(id);
  }

  /** Test/tooling affordance — not part of the port, deliberately. */
  clear(): void {
    this.projects.clear();
  }
}

/**
 * `structuredClone` alone silently downgrades Node `Buffer`s to plain `Uint8Array`s — the bytes
 * survive but the prototype does not, so a caller doing `asset.data.equals(...)` crashes at
 * runtime on a value the type system swears is a Buffer. Found by the first test that
 * round-tripped a real source asset (ADR-0047), not by the sixteen tests that came before it.
 * The clone is still a real deep copy; this only restores the prototype the port's types promise.
 */
/**
 * The version INDEX entry (APPEND_ONLY_PERSISTENCE B): metadata only, book/settings dropped — exactly
 * what Sqlite's findById reconstructs from its metadata columns. Dates are cloned so the returned index
 * cannot be mutated back into stored state.
 */
function toIndexEntry(version: BookVersion): BookVersion {
  return {
    id: version.id,
    number: version.number,
    createdAt: new Date(version.createdAt),
    ...(version.label !== undefined ? { label: version.label } : {}),
    ...(version.sourceAssetId !== undefined ? { sourceAssetId: version.sourceAssetId } : {}),
    ...(version.milestone ? { milestone: true as const } : {}),
  };
}

function cloneProject(project: Project): Project {
  const cloned = structuredClone(project);
  return {
    ...cloned,
    assets: cloned.assets.map((asset) =>
      asset.data
        ? // A view over the clone's own fresh ArrayBuffer, not a second copy — structuredClone
          // already copied the bytes and nobody else holds this buffer.
          { ...asset, data: Buffer.from(asset.data.buffer, asset.data.byteOffset, asset.data.byteLength) }
        : asset
    ),
  };
}
