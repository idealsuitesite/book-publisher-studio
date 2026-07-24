import type { TitlePageDTO, CopyrightPageDTO } from './FrontMatterDTO';

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
  | { type: 'removePartOpener'; id: string }
  // STRUCTURE_CLEANUP (STRUCTURE_CLEANUP_DR.md §6.2): collapse an empty MARKER heading (CHAPTER n /
  // editorial) the author styled as its own Heading 1, into the real chapter that follows it. The
  // over-structured author's one-gesture repair; the inverse of promoteToChapter. Not a merge — the
  // marker is empty, so the follower flows up and auto-numbers (A1), or inherits the editorial title
  // with its own title kept as a subtitle (A2).
  | { type: 'collapseMarker'; markerId: string }
  // SUBCHAPTER_PROMOTION (SUBCHAPTER_PROMOTION_DR §5, B5): demote a recurring editorial marker in a
  // chapter's own body into a SECTION of that chapter — the founder's continuity (a per-chapter
  // "Conclusion" becomes a section, not a peer chapter). A batch applies REVERSE document order.
  | { type: 'promoteToSubsection'; blockId: string }
  // MINI_DR_CALLOUTS commit 1: mark/unmark a paragraph as a generic callout (Shape B — the flag
  // lives on the paragraph; the chrome lives in the theme). The author action; never inferred.
  | { type: 'setCallout'; blockId: string; on: boolean }
  // MINI_DR_SUBTITLE_FIELD commit 1: move a paragraph's text into its top-level chapter's
  // subtitle field, and the inverse (reinsert as first paragraph). The author action; the
  // import writes nothing (SUBTITLE_IMPORT_MAPPING_UNBLOCK gates the styleMap path).
  | { type: 'markAsSubtitle'; blockId: string }
  | { type: 'clearSubtitle'; chapterId: string }
  // MINI_DR_EDIT_FRONT_MATTER (Phase 3b): edit the RENDERED front-matter sections. undefined =
  // untouched, null = cleared (a book with no copyright page is a legitimate author choice),
  // object = replaced whole.
  | { type: 'editFrontMatter'; titlePage?: TitlePageDTO | null; copyrightPage?: CopyrightPageDTO | null }
  // AUTHOR_EXPERIENCE D2 (M3-C6): ADD a dead-but-typed front-matter section by composing it from the
  // author's own words — v1 = dedication + preface. The first Insert-shaped op admitted (narrowly): a
  // preface with no path is the most visible author-side hole, and this is composition, not the
  // arbitrary content-creation `INSERT_ELEMENTS` defers. A dedication is a centered Block; a preface is
  // a titled Section. Author action only; nothing in the import path writes these.
  | { type: 'addFrontMatterSection'; section: 'dedication'; text: string }
  | { type: 'addFrontMatterSection'; section: 'preface'; title: string; text: string }
  // BATCH_CONFIRM_LATENCY correctif A: apply a suggester's "…all" gesture as ONE command — one
  // snapshot, one save (BATCH_CONFIRM_LATENCY_SCOPE.md §4 Option A). The single `op` field makes a
  // MIXED batch impossible to express (one op per batch, structurally). `ids` are blockIds for the
  // two promotes, markerIds for collapse. The order law is the SERVER'S, computed from the book, never
  // the client array order (the greedy splits apply reverse document order; collapse is order-free).
  | { type: 'batchApply'; op: 'promoteToChapter' | 'collapseMarker' | 'promoteToSubsection'; ids: string[] };
