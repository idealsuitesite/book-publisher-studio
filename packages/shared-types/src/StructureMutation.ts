/**
 * A typed manual-structure-editing command (STRUCTURE_EDITING.md Q4 — one generic command, not a
 * route per verb). Discriminated on `type` so both sides dispatch exhaustively and the route can
 * validate a single shape.
 *
 * Shared (ADR-0033) because Phase 3's frontend now issues these: the backend `EditBookUseCase`
 * and the frontend `editStructure` client import the SAME union, so a new variant can never drift
 * between the two sides. Type only, zero runtime — the backend validates an untrusted body into
 * this shape at the route boundary.
 */
export type StructureMutation =
  | { type: 'reorderChapters'; fromIndex: number; toIndex: number }
  | { type: 'rename'; id: string; title: string }
  | { type: 'restoreVersion'; versionId: string }
  // CREATE_CHAPTER.md (scope LOCKED to these two create ops): carve a chapter out of unstructured
  // content by promoting a paragraph, and its exact inverse.
  | { type: 'promoteToChapter'; blockId: string }
  | { type: 'mergeChapterIntoPrevious'; chapterId: string };
