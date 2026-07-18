import type { Project, ProjectSummary } from '../models/Project';

/**
 * Persistence boundary for the `Project` aggregate.
 *
 * **`Project` is the aggregate root** (AGGREGATES_AND_PERSISTENCE.md §2). That is a consistency
 * and locking boundary, not a folder structure, and it is why this port exists at project
 * granularity rather than one repository per type. There is deliberately no `BookRepository`,
 * no `VersionRepository` and no `PublicationEventRepository`: those entities have no identity
 * outside their project, and giving them their own repositories would let a caller save a
 * version without the project whose numbering guarantees it — corrupting the invariant the
 * aggregate exists to protect.
 *
 * **`Workspace` is deliberately absent.** It is a scope — tenancy, ownership, a query filter —
 * not an aggregate. Making it one would mean loading every project to open a single book, and
 * locking every project to edit one, which would make Sprint 14's collaboration contend for no
 * reason. When multi-user work arrives, projects gain a `workspaceId` and this port gains a
 * filter; neither is a restructuring.
 *
 * The interface is deliberately store-agnostic. Which database backs it is a separate decision
 * requiring its own spike (Question 6), and this port is what that spike will be measured
 * against.
 */
export interface ProjectRepository {
  /**
   * Loads a whole aggregate, or undefined if there is none.
   *
   * "Whole" is the contract: a caller that receives a Project may rely on its versions,
   * assets and publications being present and mutually consistent. An implementation that
   * lazily omits them would break every invariant `ProjectService` enforces.
   */
  findById(id: string): Promise<Project | undefined>;

  /**
   * Lists projects for the library view.
   *
   * Returns summaries, never aggregates — see `ProjectSummary` for why. An implementation that
   * satisfies this by loading every aggregate and mapping it is correct but defeats the
   * purpose; the whole point is that a store can answer this cheaply.
   */
  list(): Promise<ProjectSummary[]>;

  /**
   * Saves a whole aggregate, creating or replacing it.
   *
   * Whole-aggregate save is the deliberate choice: `ProjectService` already returns complete
   * new instances (immutability, ADR-0001), so there is no partial state to reconcile, and a
   * save that could persist half a restore is corruption rather than a saving of effort.
   */
  save(project: Project): Promise<void>;

  /**
   * Deletes a project and everything inside its boundary.
   *
   * **Deletion semantics are an open question** (AGGREGATES_AND_PERSISTENCE.md Risk 5):
   * deleting a project with publication events destroys the record of a real publication that
   * actually happened. Until that is decided, implementations should treat this as a genuine
   * delete and callers should not offer it in the UI.
   */
  delete(id: string): Promise<void>;
}
