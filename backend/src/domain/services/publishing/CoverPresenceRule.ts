import type { PostRenderValidationContext } from '../../models/PostRenderValidationContext';
import type { PublishingIssue } from '../../models/PublishingReport';
import type { PostRenderValidationRule } from './PostRenderValidationRule';

// Will warn on nearly every real import today - ASTBuilder doesn't populate coverImage from a
// real DOCX yet (Risk 4, PUBLISHING_ENGINE.md §6). Kept honest rather than skipped: a real,
// disclosed gap surfaced as a real WARNING, not hidden by omitting the check.
export class CoverPresenceRule implements PostRenderValidationRule {
  readonly name = 'CoverPresenceRule';

  evaluate(context: PostRenderValidationContext): PublishingIssue[] {
    if (!context.bundle.manifest.hasCover) {
      return [
        { code: 'NO_COVER_IMAGE', message: 'No cover image was found in the manuscript.', severity: 'WARNING' },
      ];
    }
    return [];
  }
}
