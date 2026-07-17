import type { ValidationRule } from './ValidationRule';
import type { ValidationContext } from '../../models/ValidationContext';
import type { ValidationIssue } from '../../models/Book';

// A drop cap is normally applied to roughly one paragraph per chapter (the
// opening paragraph). More than this fraction of all paragraphs having one
// is unusual enough to be worth an INFO note, not a hard threshold backed by
// any external source - implementation detail, same as QualityScore's own
// "functional intent now, arithmetic later" treatment (ADR-0022 precedent).
const UNUSUAL_DROP_CAP_RATIO = 0.1;

/**
 * Wraps ValidationContext.metrics (pre-computed QualityMetrics) - never
 * recomputes them, per explicit CTO direction on this commit and the
 * BookMetricsCalculator/BookMetricsCalculator.calculateQualityMetrics()
 * ownership those metrics already have (ADR-0008). If `context.metrics` is
 * absent (the caller chose not to compute it - it's an optional field),
 * this rule has nothing to evaluate and returns no issues, rather than
 * guessing or recomputing.
 *
 * Two items named in the Design Review (docs/architecture/diagrams/
 * VALIDATION_ENGINE.md §5 items 5/9) are deliberately NOT implemented this
 * commit, for reasons worth surfacing rather than silently deciding:
 *
 *   - widowsAndOrphans threshold check: under Sprint 4's TypographyResolver,
 *     `widowsAndOrphans` is structurally equal to `headingCount` (every
 *     Heading gets staysWithNext: true, unconditionally - see
 *     ResolvedTypography.ts). A raw-count threshold on this field can only
 *     ever fire on every book with any heading, or never - it carries no
 *     real signal yet, the same "always-passes-or-always-fires is not a
 *     real check" reasoning the CTO endorsed for commit 6's registry
 *     decision, just the mirror case. Revisit once staysWithNext becomes
 *     more selective (a future Typography Engine refinement) or
 *     page-boundary data becomes available to this rule.
 *   - Long-chapter SUGGESTION ("this chapter is 75 pages, consider
 *     splitting it"): needs a per-chapter length breakdown that does not
 *     exist in aggregate QualityMetrics (which only has whole-book figures).
 *     Computing it here would mean duplicating BookMetricsCalculator-style
 *     aggregation inside a validation rule, or extending QualityMetrics
 *     itself - both out of this commit's "wrap existing metrics" scope.
 *     Named, not built.
 */
export class TypographyRule implements ValidationRule {
  readonly name = 'TypographyRule';

  evaluate(context: ValidationContext): ValidationIssue[] {
    const { metrics } = context;
    if (!metrics) return [];

    const issues: ValidationIssue[] = [];

    if (metrics.emptyHeadings > 0) {
      issues.push({
        code: 'EMPTY_HEADINGS',
        message: `${metrics.emptyHeadings} heading(s) have no text`,
        location: 'book',
        severity: 'WARNING',
      });
    }

    if (metrics.inconsistentSpacing > 0) {
      issues.push({
        code: 'INCONSISTENT_SPACING',
        message: `${metrics.inconsistentSpacing} paragraph(s) override the theme's spacing`,
        location: 'book',
        severity: 'WARNING',
      });
    }

    if (metrics.paragraphCount > 0 && metrics.dropCaps / metrics.paragraphCount > UNUSUAL_DROP_CAP_RATIO) {
      issues.push({
        code: 'UNUSUAL_DROP_CAP_RATIO',
        message: `${metrics.dropCaps} of ${metrics.paragraphCount} paragraphs have a drop cap - more than typically expected`,
        location: 'book',
        severity: 'INFO',
      });
    }

    return issues;
  }
}
