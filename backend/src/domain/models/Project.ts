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

  /** Cover, fonts, illustrations. Referenced by the book, owned by the project. */
  assets: ProjectAsset[];

  /**
   * Immutable snapshots, oldest first. Empty for a project that has never been versioned —
   * which is not the same as a project with no history, and the distinction matters when
   * deciding whether "restore" is even offered.
   */
  versions: BookVersion[];

  /** Append-only. See PublicationEvent for why this is a log and not a status. */
  publications: PublicationEvent[];

  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  /** Named layout, resolved through `LayoutSelector` — not an inlined `PageLayout`, so a
   * renamed or corrected preset reaches existing projects rather than freezing at import time. */
  layoutName: string;
  themeName: string;
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

  createdAt: Date;
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

export type ProjectAssetKind = 'cover' | 'font' | 'illustration' | 'other';

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
