import type { PostRenderValidationContext } from '../../models/PostRenderValidationContext';
import type { PublishingIssue } from '../../models/PublishingReport';
import type { PostRenderValidationRule } from './PostRenderValidationRule';
import { isChapter } from '../../models/Book';
import { UNSTRUCTURED_WORD_THRESHOLD } from '../BookValidator';
import { countBookWords } from '../countBookWords';

/**
 * Blocks "Validate for KDP" when the manuscript carries the ADR-0049 unstructured state:
 * zero detected chapters on a book-length text. Nobody submits a structureless book to
 * Amazon on purpose; the Proof and exports stay available (an unstructured proof is
 * diagnostic — CTO decision Q2), only the KDP submission gate closes.
 *
 * PROVISIONAL, by explicit CTO amendment: this lives in the KDP rule set specifically —
 * never as a generic "publish" rule — because a chapterless corporate report is a
 * legitimate product for other targets. Re-evaluate as a ValidationProfile rule the day
 * that concept exists in code (`ValidationContext.validationProfile` reserves the slot).
 */
export class StructurePresenceRule implements PostRenderValidationRule {
  readonly name = 'StructurePresenceRule';

  evaluate(context: PostRenderValidationContext): PublishingIssue[] {
    const chapters = context.book.mainContent.filter(isChapter).length;
    // Counted from the AST, never from `book.wordCount`: the publish path rebuilds the book
    // without metrics enrichment, and the enriched field silently read 0 there (found live).
    const words = countBookWords(context.book);
    if (chapters === 0 && words > UNSTRUCTURED_WORD_THRESHOLD) {
      return [
        {
          code: 'UNSTRUCTURED_MANUSCRIPT',
          message: `No chapters were detected in this ${words.toLocaleString('en-US')}-word manuscript — KDP requires a structured interior`,
          severity: 'ERROR',
        },
      ];
    }
    return [];
  }
}
