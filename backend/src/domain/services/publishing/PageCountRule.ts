import type { PostRenderValidationContext } from '../../models/PostRenderValidationContext';
import type { PublishingIssue } from '../../models/PublishingReport';
import type { PostRenderValidationRule } from './PostRenderValidationRule';

/**
 * Validates the **real** paginated page count of one rendered artifact against a target's range.
 *
 * Which artifact is a constructor argument, like every other rule's configuration (Sprint 8
 * Decision 7), so a future KoboRuleProvider reuses this class rather than copying it. It matters
 * here beyond consistency: a bundle can hold a paginated PDF and a reflowable EPUB at once, and
 * "the page count of the bundle" is not a well-formed question.
 */
export class PageCountRule implements PostRenderValidationRule {
  readonly name = 'PageCountRule';

  constructor(
    private readonly minPageCount: number,
    private readonly maxPageCount: number,
    private readonly artifact: 'pdf' | 'epub' | 'docx'
  ) {}

  evaluate(context: PostRenderValidationContext): PublishingIssue[] {
    // Read from the rendered artifact, never from `book.pageCount` (ADR-0042).
    //
    // `book.pageCount` is an import-time estimate derived from word count; this is the real
    // paginated result. Falling back from one to the other would be the worst option available:
    // KDP rejects on the real count, so validating an estimate against a hard platform limit
    // converts an honest warning into a PASS on a book Amazon will refuse. A disclosed unknown
    // is strictly better than a false green.
    //
    // Metrics are read through the bundle rather than from a separate context field. The bundle
    // already carries them (`RenderedOutput.metrics`), and a second copy on the context would be
    // the same fact in two places in one object - free to write, and a drift bug waiting to
    // happen. RENDER_METRICS.md Decision 3 proposed that field; implementing Decision 2 made it
    // redundant.
    const pageCount = context.bundle.manuscript[this.artifact]?.metrics.pageCount;

    if (pageCount === undefined) {
      return [
        {
          code: 'PAGE_COUNT_UNKNOWN',
          message: `Page count could not be determined for the ${this.artifact} interior.`,
          severity: 'WARNING',
        },
      ];
    }

    if (pageCount < this.minPageCount || pageCount > this.maxPageCount) {
      return [
        {
          code: 'PAGE_COUNT_OUT_OF_RANGE',
          message: `Page count ${pageCount} is outside the accepted range of ${this.minPageCount}-${this.maxPageCount}.`,
          severity: 'ERROR',
        },
      ];
    }

    return [];
  }
}
