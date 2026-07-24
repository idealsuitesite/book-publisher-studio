import type { ApiErrorCode } from 'shared-types';
import { ApiError, RequestTimeoutError, NetworkError } from '@/lib/api-client';

/**
 * Turn any failure from an editorial gesture into ONE author-language sentence (AUTHOR_EXPERIENCE M3,
 * P1-defect). The raw server string — "promoteToChapter: no block with id p-17…" — reached the founder
 * twice; a screen may only show an error it can name (ApiErrorDTO's own rule). The workspace shows the
 * result of THIS, never `e.message`.
 *
 * Every message says two things the author needs and the acceptance criterion demands: what happened,
 * in editorial words (not "block"/"mutation"), and that nothing was lost — the gesture simply didn't
 * apply, and they can try again. FRENCH-READY by construction: this map is the single localization
 * seam — swap the strings, the call sites don't change.
 */
const BY_CODE: Partial<Record<ApiErrorCode, string>> = {
  CONTENT_NOT_FOUND:
    'That part of the document isn’t there any more — it may have moved or changed since you opened it. Nothing was lost; reopen it and try again.',
  VERSION_NOT_FOUND: 'That earlier state is no longer available to return to. Nothing was lost.',
  INVALID_MUTATION: 'That change can’t be made here. Nothing was lost.',
  PROJECT_NOT_FOUND: 'This book couldn’t be found — it may have been closed. Return to your library to reopen it.',
  INVALID_SETTINGS: 'That setting couldn’t be applied. Nothing was lost.',
  RENDER_FAILED: 'The preview couldn’t be produced just now. Your book is unchanged; try again in a moment.',
  INTERNAL: 'Something went wrong on our side. Your book is unchanged; please try again.',
};

const FALLBACK = 'That change couldn’t be applied. Nothing was lost — please try again.';

/** The one author-facing message for a failed editorial gesture. Never returns a raw server/exception string. */
export function describeStructureError(error: unknown): string {
  if (error instanceof RequestTimeoutError) {
    return 'That took too long, so the change wasn’t made. Your book is unchanged; try again.';
  }
  if (error instanceof NetworkError) {
    return 'Couldn’t reach the server, so the change wasn’t made. Check it’s running, then try again.';
  }
  if (error instanceof ApiError && error.code && BY_CODE[error.code]) {
    return BY_CODE[error.code]!;
  }
  return FALLBACK;
}
