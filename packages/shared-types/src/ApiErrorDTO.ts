/**
 * The typed error contract (ADR-0049, IMPORT_FIDELITY.md §3): one code, one UI message, one
 * recovery action. The rule it enforces: a screen may only show an error it can name —
 * generic strings from catch blocks are a defect, not a message.
 *
 * `error` stays the human-readable string every existing consumer already reads; `code` is
 * additive. New codes are added here first so both sides share the union.
 */
export type ApiErrorCode =
  /** findById missed — the project does not exist (any more). Recovery: back to the library, drop stale resume state. */
  | 'PROJECT_NOT_FOUND'
  /** The rendering pipeline threw while producing a proof/edition/publish bundle. Real cause logged server-side. */
  | 'RENDER_FAILED'
  /** The uploaded file could not be read as a manuscript at all. */
  | 'IMPORT_PARSE_FAILED'
  /** Export asked for a format the API does not produce. */
  | 'UNKNOWN_FORMAT'
  /** Upload refused before parsing (wrong type, too large, missing). */
  | 'UPLOAD_REJECTED'
  /** A theme/layout name the registries do not know. */
  | 'UNKNOWN_OPTION'
  // Structure-edit transport codes (the `POST /:id/structure` route). Added to the union so the
  // workspace maps them to author-language messages — the raw server string had bitten the founder
  // twice (AUTHOR_EXPERIENCE M3 P1-defect). The union had drifted: the route emitted these before they
  // were declared here, against this file's own "new codes are added here first" rule.
  /** A malformed structure command the route could not validate into a known mutation shape. */
  | 'INVALID_MUTATION'
  /** The target of an edit (a block / chapter / section id) does not exist in the book. */
  | 'CONTENT_NOT_FOUND'
  /** Undo referenced a version id that is not in the project's log. */
  | 'VERSION_NOT_FOUND'
  /** A settings patch (accent/typography/theme/layout) carried an invalid value. */
  | 'INVALID_SETTINGS'
  /** A region render was asked for an out-of-bounds page range. */
  | 'INVALID_RANGE'
  /** A region render carried a non-positive total. */
  | 'INVALID_TOTAL'
  /** Unclassified server failure — the fallback, never a hiding place for a nameable cause. */
  | 'INTERNAL';

export interface ApiErrorDTO {
  error: string;
  code?: ApiErrorCode;
}
