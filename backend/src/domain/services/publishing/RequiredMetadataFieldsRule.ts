import type { BookMetadata } from '../../models/Book';
import type { PostRenderValidationContext } from '../../models/PostRenderValidationContext';
import type { PublishingIssue } from '../../models/PublishingReport';
import type { PostRenderValidationRule } from './PostRenderValidationRule';

// Generic - takes the required field list as a constructor argument rather than hardcoding KDP's
// list, so a future KoboRuleProvider/AppleBooksRuleProvider can reuse this same rule class with
// its own platform's required fields (Decision 8: engine objects stay platform-agnostic).
export class RequiredMetadataFieldsRule implements PostRenderValidationRule {
  readonly name = 'RequiredMetadataFieldsRule';

  constructor(private readonly requiredFields: (keyof BookMetadata)[]) {}

  evaluate(context: PostRenderValidationContext): PublishingIssue[] {
    return this.requiredFields
      .filter((field) => !context.book.metadata[field])
      .map((field) => ({
        code: 'MISSING_REQUIRED_METADATA',
        message: `Required metadata field "${String(field)}" is missing.`,
        severity: 'ERROR' as const,
      }));
  }
}
