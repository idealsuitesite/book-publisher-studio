import type { Book } from './Book';
import type { PublishingReport } from './PublishingReport';

/**
 * The unit of work an author actually thinks in.
 *
 * Until now the object this system was built around was a **file**, and a file is not what an
 * author works on. A user saw `Import → Validation → Layout → Preview → Export` but never
 * "I am working on *Le Guide de Jean*". `Project` is that missing identity.
 *
 * `Book` stays the **content** — the AST, chapters, metadata. `Project` is the **work**: its
 * name, its settings, its assets, its history. That split is why layout and theme live here
 * rather than in the pipeline: they are properties of the book being made, not steps in making
 * it (PRODUCT_OBJECT_MODEL.md Decision 1).
 *
 * One Project owns exactly one Book. Box sets and series are real, but they are a Collection of
 * Projects — addable later without disturbing this relationship. Making a Project hold many
 * books would force every screen to answer "which book?" before it could show anything, and buy
 * nothing today.
 *
 * Immutable, like `Book` (ADR-0001): every operation returns a new instance. Serializable, so a
 * Project can be stored and restored whole — the prerequisite Sprint 11's persistence work will
 * build on.
 */
export interface Project {
  id: string;

  /**
   * What the author calls this work. Distinct from `Book.metadata.title` on purpose: an author
   * may keep a working name ("Jean's guide, 2nd pass") long before settling the published
   * title, and renaming the project should never silently retitle the book.
   */
  name: string;

  /** The manuscript itself — content, not identity. */
  book: Book;

  /**
   * How this book should be produced. These were previously transient request parameters,
   * chosen again on every export and remembered nowhere.
   */
  settings: ProjectSettings;

  /** Cover, fonts, illustrations, and the original uploads. Owned by the project. */
  assets: ProjectAsset[];

  /**
   * The uploaded file this project's current manuscript was imported from, as a
   * `ProjectAsset` id of kind `'source'`.
   *
   * Kept because **import is lossy today** — mammoth silently drops underline (ADR-0025), and
   * `ASTBuilder` cannot recover ISBN, description or cover image at all (Risk 4, disclosed
   * since Sprint 5). Storing only the derived AST would freeze every project permanently at the
   * fidelity of the importer that first read it, so a future import fix could never be applied
   * to work that already exists.
   *
   * Referenced by id rather than embedded, like every other asset: a 25MB upload copied into
   * each version snapshot would turn history into an unusable pile.
   */
  sourceAssetId?: string;

  /**
   * Immutable snapshots, oldest first. Empty for a project that has never been versioned —
   * which is not the same as a project with no history, and the distinction matters when
   * deciding whether "restore" is even offered.
   */
  versions: BookVersion[];

  /** Append-only. See PublicationEvent for why this is a log and not a status. */
  publications: PublicationEvent[];

  /**
   * When the author archived this project, or absent if it is active.
   *
   * Archiving exists because one verb was serving two intentions (ADR-0044). "This is finished,
   * get it out of my way" is the common case and expects to lose nothing; "this was a mistake,
   * remove it" is rare and expects real erasure. A single destructive delete failed the first by
   * discarding a publication record the author wanted kept.
   *
   * Nothing is lost here: versions, publications, assets and the original upload all remain, and
   * `ProjectService.restore()` reverses it. Real deletion is still real — see
   * `ProjectRepository.delete()`.
   *
   * A date rather than a `status` enum, deliberately: it answers "archived?" and "when?" in one
   * field, and an enum invites a `published` member that would contradict the publication log
   * already deriving that answer (ADR-0044, Question 1).
   */
  archivedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  /** Named layout, resolved through `LayoutSelector` — not an inlined `PageLayout`, so a
   * renamed or corrected preset reaches existing projects rather than freezing at import time. */
  layoutName: string;
  themeName: string;
  /**
   * Optional per-project accent colour (hex) that overrides the chosen theme's `colors.accent`
   * (MINI_DR_PER_THEME_ACCENT). Colour-only — it re-colours headings/titles and moves no geometry,
   * so it is R2-free. Absent means "use the theme's own accent"; present replaces it for ANY theme,
   * including Classic (an explicit author choice, not an error to prevent).
   */
  accentOverride?: string;

  /**
   * Optional per-project typography override (MINI_DR_TYPOGRAPHY_TUNING). UNLIKE the accent this
   * one MOVES GEOMETRY (a preset step is ±14–17% of the book, measured) — so it participates in
   * the pagination-cache key (the §2.3 completeness rule's anticipated case) and in
   * `proofRefreshKey`. Applied in the single `resolveTheme` seam; absent means the theme's own
   * typography, untouched.
   */
  typographyOverride?: TypographyOverride;
}

/**
 * Mirror of `TypographyOverrideDTO` (shared-types) on the Domain side. `preset` resolves as an
 * OFFSET from the theme's default body (compact −1 / standard 0 / comfort +1 / large +2), so
 * "standard" is always the theme's designed default; fonts are logical roles, resolved against
 * the registry's real families in `resolveTheme`.
 */
export interface TypographyOverride {
  preset?: 'compact' | 'standard' | 'comfort' | 'large';
  bodyFont?: 'serif' | 'sans';
  headingFont?: 'serif' | 'sans';
}

/**
 * An immutable snapshot of the manuscript **and the settings that produced it**.
 *
 * Storing content alone would be a trap: reproducing last year's PDF requires last year's
 * layout and theme, not today's. A version that cannot reproduce its own output is not a
 * version — it is a backup with a date on it.
 *
 * Deliberately not a diff, and deliberately not branchable. Full document history with merges
 * is a version-control system, and this product is not one.
 */
export interface BookVersion {
  id: string;

  /**
   * Sequential from 1, per project. This is the concept `Book.version: number` anticipated in
   * Sprint 1 and never built — that field stayed at its initial value on every book ever
   * created. Numbering lives here because a version number is a fact about a project's history,
   * not about a document's content.
   */
  number: number;

  /** The manuscript exactly as it was. */
  book: Book;

  /** The settings in force when this snapshot was taken — see the type doc above. */
  settings: ProjectSettings;

  /** Optional author note: "before the editor's cuts". */
  label?: string;

  /**
   * A MILESTONE version is exempt from any future pruning (APPEND_ONLY_PERSISTENCE, option 3). Set
   * AUTOMATICALLY when a publication or export produces the version — the events the system already
   * records; there is no manual "mark this step" gesture (withdrawn, founder decision 2026-07-24).
   * Model support only in B; pruning of non-milestone versions is D (deferred). Absent = ordinary.
   */
  milestone?: true;

  /**
   * The source upload this snapshot was built from, if any — same reasoning as
   * `Project.sourceAssetId`. Referenced, so several versions imported from one file share it
   * rather than each carrying a copy.
   */
  sourceAssetId?: string;

  createdAt: Date;
}

/**
 * What the library view needs, and nothing more.
 *
 * Deliberately not a `Project`. The library is the most-visited screen in the product and needs
 * a title, a cover and a date — while a full aggregate carries the entire manuscript AST, every
 * version snapshot and every publication report. Loading forty of those to render a grid of
 * titles is the performance mistake that gets made once and lived with for years
 * (AGGREGATES_AND_PERSISTENCE.md Question 4).
 *
 * Derived on read rather than maintained on write, so it cannot drift from the aggregate. If
 * measurement later shows deriving it is too slow, materialising it is a change to the
 * repository alone.
 */
export interface ProjectSummary {
  id: string;
  name: string;
  /** The book's own title, which may differ from the project name — see `Project.name`. */
  bookTitle: string;
  // Optional (FOUNDER_TRAVERSAL defect 2): mirrors Book.metadata.author — absent, never 'Unknown'.
  author?: string;
  coverAssetId?: string;
  versionCount: number;
  /** Platforms with at least one successful publication. Derived, never stored. */
  publishedTargets: string[];
  /** Present only for archived projects, so a caller listing them can tell them apart without
   * loading aggregates (ADR-0044). */
  archivedAt?: Date;
  updatedAt: Date;
}

/** Projects a full aggregate down to what a library listing needs. */
export function toProjectSummary(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    bookTitle: project.book.metadata.title,
    author: project.book.metadata.author,
    coverAssetId: project.assets.find((asset) => asset.kind === 'cover')?.id,
    versionCount: project.versions.length,
    publishedTargets: [
      ...new Set(
        project.publications
          .filter((event) => event.report.status === 'PASS')
          .map((event) => event.target)
      ),
    ],
    archivedAt: project.archivedAt,
    updatedAt: project.updatedAt,
  };
}

/**
 * A publication **attempt**, recorded as it happened.
 *
 * Not a status field on the project, deliberately. A status cannot answer the questions an
 * author actually asks — *when did I send this to KDP? which version? did Kobo succeed?* A book
 * can go to several platforms, at different times, from different versions, with different
 * outcomes. One `status` flattens all of that into a single misleading word.
 *
 * Current state is therefore **derived, never stored**: "published to KDP" means *a successful
 * KDP event exists*. See `latestPublicationFor`.
 *
 * This fits the Publishing Engine already built: `PublishingReport` carries `generatedAt`,
 * `duration`, `target` and `status` — an event record in all but name (ADR-0037).
 */
export interface PublicationEvent {
  id: string;

  /** Platform identifier, matching `PublishingTarget`'s own vocabulary ('kdp', later 'kobo'). */
  target: string;

  /** Which snapshot was published. Undefined when a project was published unversioned. */
  versionId?: string;

  /** The real report the Publishing Engine produced — stored, not summarised. */
  report: PublishingReport;

  occurredAt: Date;
}

export type ProjectAssetKind = 'cover' | 'font' | 'illustration' | 'source' | 'other';

/**
 * A file belonging to the project rather than to the manuscript.
 *
 * Referenced by id, never embedded. A 300 DPI print cover is measured in megabytes, and
 * embedding it in `BookMetadata.coverImage` as base64 would make every version snapshot carry
 * its own copy — turning history into an unusable pile. Referencing keeps snapshots small and
 * lets one asset serve many versions.
 *
 * `data` is optional because where the bytes actually live is Sprint 11's decision (database
 * blob, filesystem, object store). The model deliberately does not pre-empt it.
 */
export interface ProjectAsset {
  id: string;
  kind: ProjectAssetKind;
  filename: string;
  mimeType: string;
  byteSize: number;
  data?: Buffer;
  createdAt: Date;
}

/**
 * The most recent publication to a platform, or undefined if there has never been one.
 *
 * Reads the log rather than trusting a cached flag, which is the whole point of Decision 3:
 * there is no second source of truth to drift.
 */
export function latestPublicationFor(project: Project, target: string): PublicationEvent | undefined {
  return project.publications
    .filter((event) => event.target === target)
    .reduce<PublicationEvent | undefined>(
      (latest, event) => (!latest || event.occurredAt > latest.occurredAt ? event : latest),
      undefined
    );
}

/** Whether a successful publication to `target` exists. Derived state, never stored. */
export function isPublishedTo(project: Project, target: string): boolean {
  return project.publications.some((event) => event.target === target && event.report.status === 'PASS');
}

/** The newest snapshot, or undefined for a project that has never been versioned. */
export function latestVersion(project: Project): BookVersion | undefined {
  return project.versions.reduce<BookVersion | undefined>(
    (latest, version) => (!latest || version.number > latest.number ? version : latest),
    undefined
  );
}
