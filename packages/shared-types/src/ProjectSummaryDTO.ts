/**
 * One row of the author's library — the transport shape of the Domain's `ProjectSummary`
 * read model (AGGREGATES_AND_PERSISTENCE.md Question 4). Deliberately NOT the aggregate:
 * a library listing never carries a manuscript AST, versions, or asset bytes.
 */
export interface ProjectSummaryDTO {
  id: string;
  /** What the author calls the project — may differ from the book's own title. */
  name: string;
  bookTitle: string;
  author: string;
  coverAssetId?: string;
  versionCount: number;
  /** Platforms with at least one successful publication. Derived server-side, never stored. */
  publishedTargets: string[];
  /** ISO timestamp. Present only for archived projects (ADR-0044). */
  archivedAt?: string;
  /** ISO timestamp. */
  updatedAt: string;
}

export interface ProjectListResponseDTO {
  projects: ProjectSummaryDTO[];
}
