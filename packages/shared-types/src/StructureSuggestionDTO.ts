/**
 * STRUCTURE_ASSIST (STRUCTURE_ASSIST_DR.md) — the transport shape of one proposed chapter
 * boundary. A READ-ONLY proposal: the API that returns these NEVER mutates the Book; the author
 * confirms a suggestion (which then goes through the existing `promoteToChapter` mutation). Each
 * carries the evidence — the manuscript's own text — so the author sees the reason (ADR-0049).
 */
export interface StructureSuggestionDTO {
  /** The block the author would promote to a chapter. */
  blockId: string;
  /** The proposed chapter title. */
  proposedTitle: string;
  /** 'editorial' (a canonical part name) or 'numbered-chapter' (CHAPTER n / spelled). */
  kind: 'editorial' | 'numbered-chapter';
  /** Taxonomy key: an editorial category, or 'chapter' for a numbered marker. */
  key: string;
  /** The exact source text that triggered the suggestion. */
  evidence: string;
}

export interface StructureSuggestionsResponseDTO {
  suggestions: StructureSuggestionDTO[];
}
