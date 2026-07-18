import type { PostRenderValidationRule } from '../services/publishing/PostRenderValidationRule';

// The only thing SubmissionValidator depends on for platform-specific behavior (Decision 7,
// CTO requirement: "SubmissionValidator ne doit dépendre que de l'interface
// ValidationRuleProvider"). Mirrors PublishingTarget/Renderer<TOutput>/LayoutSelector's existing
// one-method port shape (ADR-0012). More than one real implementation is plausible the moment
// Kobo/Apple Books/Lulu/IngramSpark are added.
export interface ValidationRuleProvider {
  getRules(): PostRenderValidationRule[];
}
