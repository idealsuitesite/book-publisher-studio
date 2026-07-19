import type { ProjectRepository, ListProjectsOptions } from '../../domain/ports/ProjectRepository';
import type { Project, ProjectSummary } from '../../domain/models/Project';
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
  private readonly projects = new Map<string, Project>();

  async findById(id: string): Promise<Project | undefined> {
    const stored = this.projects.get(id);
    return stored ? cloneProject(stored) : undefined;
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
    this.projects.set(project.id, cloneProject(project));
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
