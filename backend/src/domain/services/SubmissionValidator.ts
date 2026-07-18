import type { ValidationRuleProvider } from '../ports/ValidationRuleProvider';
import type { PostRenderValidationContext } from '../models/PostRenderValidationContext';
import type { PublishingIssue } from '../models/PublishingReport';

// Depends only on the ValidationRuleProvider abstraction (Decision 7, CTO requirement: "le
// validateur ne doit connaître que des abstractions, pas une plateforme concrète") - never
// imports KDPRuleProvider, KDPRuleData, or any platform-specific type. Returns PublishingIssue[]
// rather than a full PublishingReport, since assembling the report (which needs `target`, a
// platform name) is the platform-specific caller's job (KDPTarget, Commit 4), not
// SubmissionValidator's - staying platform-agnostic means never knowing the platform's name
// either.
export class SubmissionValidator {
  constructor(private readonly ruleProvider: ValidationRuleProvider) {}

  validate(context: PostRenderValidationContext): PublishingIssue[] {
    return this.ruleProvider.getRules().flatMap((rule) => rule.evaluate(context));
  }
}
