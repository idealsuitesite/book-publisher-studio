import type { PostRenderValidationContext } from '../../models/PostRenderValidationContext';
import type { PublishingIssue } from '../../models/PublishingReport';
import type { PostRenderValidationRule } from './PostRenderValidationRule';

export class PageCountRule implements PostRenderValidationRule {
  readonly name = 'PageCountRule';

  constructor(
    private readonly minPageCount: number,
    private readonly maxPageCount: number
  ) {}

  evaluate(context: PostRenderValidationContext): PublishingIssue[] {
    const pageCount = context.book.pageCount;
    if (pageCount === undefined) {
      return [
        { code: 'PAGE_COUNT_UNKNOWN', message: 'Page count could not be determined.', severity: 'WARNING' },
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
