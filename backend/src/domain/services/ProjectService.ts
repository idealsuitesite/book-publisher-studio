import type { Book } from '../models/Book';
import type { PublishingReport } from '../models/PublishingReport';
import type {
  Project,
  ProjectSettings,
  ProjectAsset,
  BookVersion,
  PublicationEvent,
} from '../models/Project';

/**
 * Operations on a `Project`.
 *
 * Every method returns a **new** Project and never mutates its argument, matching `Book`'s own
 * immutability rule (ADR-0001). That is not ceremony here: `versions` holds snapshots, and a
 * snapshot taken from an object that can still change is not a snapshot.
 *
 * Deliberately free of persistence. This service decides *what a project becomes*; where it is
 * stored is Sprint 11's separate decision (PRODUCT_OBJECT_MODEL.md Question 5), and keeping
 * that out means the storage review can be designed against a real shape rather than an
 * imagined one.
 */
export class ProjectService {
  constructor(private readonly idGenerator: () => string = defaultIdGenerator) {}

  /**
   * Creates a project around an imported book.
   *
   * The name defaults to the book's own title rather than its filename: the filename already
   * stands in for a missing title upstream, and repeating that substitution here would make a
   * single weak signal look like two independent ones.
   */
  create(book: Book, settings: ProjectSettings, name?: string): Project {
    const now = new Date();
    return {
      id: this.idGenerator(),
      name: name?.trim() || book.metadata.title?.trim() || 'Untitled project',
      book,
      settings,
      assets: [],
      versions: [],
      publications: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Archives the project: it leaves the library, and nothing is lost.
   *
   * The reversible half of ADR-0044's split. Versions, publications, assets and the original
   * upload all stay, which is what makes it safe to offer freely — and it is why the publication
   * record survives the case authors actually hit, since the project itself survives.
   *
   * Archiving an already-archived project is a no-op rather than an error: the caller asked for
   * a state, it is in that state, and re-stamping the date would quietly rewrite when it was
   * archived.
   */
  archive(project: Project): Project {
    if (project.archivedAt) return project;
    const now = new Date();
    return { ...project, archivedAt: now, updatedAt: now };
  }

  /** Restores an archived project to the library. A no-op if it was never archived. */
  restore(project: Project): Project {
    if (!project.archivedAt) return project;
    // Removes the key rather than setting it to undefined, so a restored project is
    // indistinguishable from one that was never archived.
    const restored = { ...project, updatedAt: new Date() };
    delete restored.archivedAt;
    return restored;
  }

  /** Renames the project without touching the book's own title — see `Project.name`. */
  rename(project: Project, name: string): Project {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Project name cannot be empty');
    return { ...project, name: trimmed, updatedAt: new Date() };
  }

  /**
   * The project's current manuscript.
   *
   * Exists so that nothing outside the Domain reads `project.book` directly
   * (AGGREGATES_AND_PERSISTENCE.md Question 3). `Book` is confirmed to carry two
   * responsibilities today — the *work* (title, author, description) and one *rendition* of it
   * (isbn, language, edition, cover). `edition?: string` on a type called `Book` is the proof,
   * and ADR-0035 already records that KDP requires a distinct ISBN per format.
   *
   * Splitting `Manuscript` out is deliberately **not** done yet: nothing creates a second
   * language or edition, and building the seam before the second case exists means guessing
   * where it goes. Routing access through here is the cheap half of the decision — when a
   * project really holds several manuscripts, this method takes a selector and every caller
   * keeps working, instead of every call site being rewritten.
   */
  currentBook(project: Project): Book {
    return project.book;
  }

  /** Replaces the manuscript — a re-import of the same work, not a new project. */
  replaceBook(project: Project, book: Book): Project {
    return { ...project, book, updatedAt: new Date() };
  }

  /**
   * Records the uploaded file a manuscript came from, as a `'source'` asset.
   *
   * Import is lossy today — mammoth drops underline (ADR-0025) and `ASTBuilder` recovers
   * neither ISBN, description nor cover (Risk 4). Keeping the original means a future importer
   * fix can be applied to work that already exists; discarding it freezes every project at the
   * fidelity of the importer that first read it.
   */
  attachSource(project: Project, filename: string, mimeType: string, data: Buffer): Project {
    const withAsset = this.addAsset(project, {
      kind: 'source',
      filename,
      mimeType,
      byteSize: data.byteLength,
      data,
    });
    const stored = withAsset.assets[withAsset.assets.length - 1];
    return { ...withAsset, sourceAssetId: stored.id };
  }

  /** Changes layout/theme. These are book properties, not workflow steps (Decision 1). */
  updateSettings(project: Project, settings: Partial<ProjectSettings>): Project {
    return { ...project, settings: { ...project.settings, ...settings }, updatedAt: new Date() };
  }

  /**
   * Takes an immutable snapshot of the manuscript **and the settings in force**.
   *
   * Both are captured because reproducing a past export needs the layout and theme of that day.
   * A snapshot of content alone could not regenerate its own PDF.
   */
  snapshot(project: Project, label?: string): Project {
    const version: BookVersion = {
      id: this.idGenerator(),
      number: project.versions.length + 1,
      book: project.book,
      settings: { ...project.settings },
      label: label?.trim() || undefined,
      createdAt: new Date(),
    };
    return { ...project, versions: [...project.versions, version], updatedAt: new Date() };
  }

  /**
   * Restores a past snapshot as the working manuscript.
   *
   * Restoring does **not** delete the versions that came after it. Losing history as a side
   * effect of looking at it is how authors lose work, and the log is append-only by design.
   */
  restoreVersion(project: Project, versionId: string): Project {
    const version = project.versions.find((candidate) => candidate.id === versionId);
    if (!version) throw new Error(`No such version: ${versionId}`);

    return {
      ...project,
      book: version.book,
      settings: { ...version.settings },
      updatedAt: new Date(),
    };
  }

  /**
   * Appends a publication attempt — successful or not.
   *
   * Failures are recorded too, on purpose. "I tried to publish to KDP and it was rejected" is
   * exactly the history an author needs, and a log that only keeps successes cannot show it.
   */
  recordPublication(project: Project, report: PublishingReport, versionId?: string): Project {
    const event: PublicationEvent = {
      id: this.idGenerator(),
      target: report.target,
      versionId,
      report,
      occurredAt: report.generatedAt,
    };
    return { ...project, publications: [...project.publications, event], updatedAt: new Date() };
  }

  /** Adds an asset. A project may hold several covers; choosing between them is a UI concern. */
  addAsset(project: Project, asset: Omit<ProjectAsset, 'id' | 'createdAt'>): Project {
    const stored: ProjectAsset = { ...asset, id: this.idGenerator(), createdAt: new Date() };
    return { ...project, assets: [...project.assets, stored], updatedAt: new Date() };
  }

  /** Removes an asset. Versions that referenced it keep their reference — see below. */
  removeAsset(project: Project, assetId: string): Project {
    const assets = project.assets.filter((asset) => asset.id !== assetId);
    if (assets.length === project.assets.length) throw new Error(`No such asset: ${assetId}`);
    return { ...project, assets, updatedAt: new Date() };
  }
}

function defaultIdGenerator(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
