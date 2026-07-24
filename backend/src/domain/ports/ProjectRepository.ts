import type { Project, ProjectSummary, BookVersion } from '../models/Project';

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
   * Loads the head aggregate + a lightweight version INDEX, or undefined if there is none.
   *
   * **ADR-0048 amendment (APPEND_ONLY_PERSISTENCE option B):** the head — `book` (current), settings,
   * assets, publications — is whole and mutually consistent, as before. The version log, however, comes
   * back as an INDEX: each `BookVersion` carries `{ id, number, label, createdAt, sourceAssetId,
   * milestone }` but **no `book`/`settings` payload**. Deserialising every version's book eagerly was an
   * O(v) tax on every read (measured ~50 ms/version on the founder's store); the head is what every
   * render/edit needs and is unchanged. A version's book is loaded on demand via `getVersion`. The
   * whole-aggregate promise was a simplicity choice, correct when versions were few; this amendment is
   * recorded in DECISIONS.md and the shared `projectRepositoryContract` asserts it against every store.
   */
  findById(id: string): Promise<Project | undefined>;

  /**
   * Loads ONE version's full payload (its `Book` snapshot + settings), or undefined if there is no
   * such version. APPEND_ONLY_PERSISTENCE (option B): the on-demand read companion to the version
   * INDEX — undo (`restoreVersion`) loads exactly the version it restores, not all N. The B `findById`
   * flip stops eagerly loading every version's book (an O(v) tax measured at 50 ms/version on the
   * founder's store); this method is where a version's book is fetched when it is actually needed.
   */
  getVersion(projectId: string, versionId: string): Promise<BookVersion | undefined>;

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
   * Saves the HEAD — aggregate + assets — creating or replacing it, and **never touches version rows**
   * (APPEND_ONLY_PERSISTENCE option B, DR D3). Version creation flows exclusively through the
   * append-only `appendVersion`; a version-writing `save` would persist the index (books absent) over
   * the real payloads — corruption, which the whole aggregate's consistency exists to prevent. Used for
   * head-only changes: import, a settings edit, an undo (`restoreVersion`) that moves the head without
   * adding a version.
   */
  save(project: Project): Promise<void>;

  /**
   * Appends ONE new version and updates the head aggregate, ATOMICALLY and IDEMPOTENTLY
   * (APPEND_ONLY_PERSISTENCE option B, the explicit append seam — CTO amendment 1). The repository is
   * TOLD the new version, never left to diff (which invites double-appends on retry). Both writes are
   * one transaction: on failure the store is byte-identical (torn-aggregate = no aggregate). Idempotent
   * on the stable version id — a retry after a partial failure yields exactly ONE version, never two.
   * Version creation flows exclusively through here; `save` is head-only and never rewrites version
   * rows. (In B this replaces `save`'s O(v) DELETE-all-then-reinsert with an O(1) append.)
   */
  appendVersion(project: Project, version: BookVersion): Promise<void>;

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
