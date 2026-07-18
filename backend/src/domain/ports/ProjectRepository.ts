import type { Project, ProjectSummary } from '../models/Project';

export interface ListProjectsOptions {
  /** Include archived projects. Defaults to false — see `ProjectRepository.list()`. */
  includeArchived?: boolean;
}

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
   *
   * **Archived projects are excluded unless asked for** (ADR-0044). Default-exclude is the safe
   * direction: a caller that forgets the flag shows too few projects, which is visible and gets
   * reported, whereas default-include would leak archived work into every library view and read
   * as a bug in archiving rather than in the caller. Sprint 11 (Workspace) and Sprint 14
   * (Collaboration) each add project queries, and each is a chance to forget this.
   */
  list(options?: ListProjectsOptions): Promise<ProjectSummary[]>;

  /**
   * Saves a whole aggregate, creating or replacing it.
   *
   * Whole-aggregate save is the deliberate choice: `ProjectService` already returns complete
   * new instances (immutability, ADR-0001), so there is no partial state to reconcile, and a
   * save that could persist half a restore is corruption rather than a saving of effort.
   */
  save(project: Project): Promise<void>;

  /**
   * Deletes a project and everything inside its boundary — versions, publications, assets, and
   * the original uploaded file.
   *
   * **This is a genuine, irreversible delete, and that is now a decision rather than an open
   * question** (ADR-0044, closing AGGREGATES_AND_PERSISTENCE.md Risk 5). It is never blocked by
   * publication history: the project belongs to the author, refusing because they once published
   * is paternalism dressed as stewardship, and a "delete" that quietly retains is the shape that
   * causes real trouble later. Authors who mean "get it out of my way" want `archive()`, which
   * is why that exists.
   *
   * **Not offered in the UI** (CTO decision, 2026-07-18). A delete button is the one control
   * whose mistakes cannot be walked back, and against a store that loses everything on restart
   * its only real use would be working around a limitation we intend to remove. Two things must
   * be true before it is: `Project` wired into the import pipeline, and a persistent store.
   */
  delete(id: string): Promise<void>;
}
