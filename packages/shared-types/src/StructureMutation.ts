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
  | { type: 'mergeChapterIntoPrevious'; chapterId: string }
  // MINI_DR_EDITORIAL_PLACEMENT (§2b): tag a top-level part for export placement — 'front' before the
  // chapters, 'back' after, 'main' clears it. The author action; never auto-inferred (Option C).
  | { type: 'setPartRole'; id: string; role: 'front' | 'back' | 'main' }
  // PART_LEVEL_STRUCTURE (§3.4): insert a "Part I" divider at a mainContent index, and remove one
  // by id (opener-only — a real chapter can never be deleted through this op).
  | { type: 'insertPartOpener'; index: number; title: string }
  | { type: 'removePartOpener'; id: string };
