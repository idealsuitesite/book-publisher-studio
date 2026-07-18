import type { PostRenderValidationContext } from '../../models/PostRenderValidationContext';
import type { PublishingIssue } from '../../models/PublishingReport';

/**
 * Contract every Publishing Engine post-render rule implements (Decision 3,
 * docs/architecture/diagrams/PUBLISHING_ENGINE.md). Mirrors ValidationRule's exact shape
 * (domain/services/validation/ValidationRule.ts) - evaluate() must be pure, same discipline
 * as ADR-0027 applied one pipeline stage later (post-render, not pre-render).
 */
export interface PostRenderValidationRule {
  readonly name: string;
  evaluate(context: PostRenderValidationContext): PublishingIssue[];
}
