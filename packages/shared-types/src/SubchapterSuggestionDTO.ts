/**
 * SUBCHAPTER_PROMOTION (SUBCHAPTER_PROMOTION_DR) — the transport shape of one proposed sub-section.
 * A READ-ONLY proposal: the API that returns these NEVER mutates the Book; the author confirms a
 * suggestion (which then goes through the `promoteToSubsection` mutation). Type only, zero runtime.
 */
export interface SubchapterSuggestionDTO {
  /** The recurring editorial marker in a chapter's own body — what the author confirms. */
  blockId: string;
  /** The canonical label the section takes (e.g. "Conclusion"). */
  proposedTitle: string;
  /** Taxonomy key (e.g. 'conclusion') — shared with the A2 guard (one source of truth, D3). */
  key: string;
  /** The parent chapter this marker becomes a section of. */
  chapterId: string;
  /** That chapter's title — shown so the author sees where the section lands. */
  chapterTitle: string;
}

export interface SubchapterSuggestionsResponseDTO {
  suggestions: SubchapterSuggestionDTO[];
}
