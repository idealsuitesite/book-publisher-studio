/**
 * STRUCTURE_CLEANUP (STRUCTURE_CLEANUP_DR.md) — the transport shape of one proposed marker collapse.
 * A READ-ONLY proposal: the API that returns these NEVER mutates the Book; the author confirms a
 * suggestion (which then goes through the `collapseMarker` mutation). The over-structured mirror of
 * StructureSuggestionDTO. Type only, zero runtime (the shared-types rule).
 */
export interface CleanupSuggestionDTO {
  /** The empty marker heading's id — what the author confirms (the `collapseMarker` mutation acts on it). */
  markerId: string;
  /** The marker's own text — the evidence shown to the author ("CHAPTER 1", "INTRODUCTION"). */
  markerText: string;
  /** 'numbered' (`CHAPTER n`) or 'editorial' (`INTRODUCTION`/`CONCLUSION`) — the two collapse forms. */
  kind: 'numbered' | 'editorial';
  /** The real chapter the marker collapses into. */
  targetChapterId: string;
  /** That chapter's real title — shown so the author sees what survives. */
  targetTitle: string;
  /** For an editorial marker: the canonical label the follower is renamed to (its title becomes a subtitle). */
  canonicalLabel?: string;
}

export interface CleanupSuggestionsResponseDTO {
  suggestions: CleanupSuggestionDTO[];
}
