import type { PostRenderValidationContext } from '../../models/PostRenderValidationContext';
import type { PublishingIssue } from '../../models/PublishingReport';
import type { PostRenderValidationRule } from './PostRenderValidationRule';
import type { KDPMarginRow } from './KDPRuleData';
import { insideMarginOf } from '../../models/PageLayout';

const POINTS_PER_INCH = 72;

/**
 * Validates the REAL rendered geometry against a target's page-count-dependent margin table —
 * the first consumer `KDPRuleData.marginsByPageCount` has ever had (GUTTER_VALIDATION_FIRST,
 * `MINI_DR_GUTTER_VALIDATION`). Until this rule, the shipped 72pt defaults were compliant by
 * *accident* (`GUTTER_SCOPE.md` §0: 72pt exceeds even the 828-page 0.875in gutter) and nothing
 * would have caught a manually tightened inside margin.
 *
 * Reads `metrics.pageLayout` + `metrics.pageCount` through the bundle, like `PageCountRule`
 * (ADR-0042: validate the rendered artifact, never the import-time estimate; the RENDER_METRICS
 * Decision-2 route — no second copy of metrics on the context). Configuration by constructor,
 * platform-agnostic (ADR-0036/0037): a future KoboRuleProvider reuses this class with its own
 * table.
 */
export class MarginComplianceRule implements PostRenderValidationRule {
  readonly name = 'MarginComplianceRule';

  constructor(
    /** Ascending by maxPages — row selection takes the first row the page count fits. */
    private readonly marginsByPageCount: KDPMarginRow[],
    private readonly artifact: 'pdf' | 'epub' | 'docx'
  ) {}

  evaluate(context: PostRenderValidationContext): PublishingIssue[] {
    const metrics = context.bundle.manuscript[this.artifact]?.metrics;
    const pageCount = metrics?.pageCount;
    const layout = metrics?.pageLayout;

    if (pageCount === undefined || layout === undefined) {
      // The disclosed-unknown pattern (PageCountRule): a WARNING, never a false green.
      return [
        {
          code: 'MARGINS_UNKNOWN',
          message: `Margin compliance could not be determined for the ${this.artifact} interior (no rendered geometry).`,
          severity: 'WARNING',
        },
      ];
    }

    const row = this.marginsByPageCount.find((r) => pageCount <= r.maxPages);
    if (!row) {
      // Beyond the table = beyond the platform's accepted page range. PageCountRule already owns
      // that ERROR (PAGE_COUNT_OUT_OF_RANGE); reporting the same fact twice is noise, not rigour.
      return [];
    }

    const issues: PublishingIssue[] = [];
    const requiredGutterPt = row.gutterIn * POINTS_PER_INCH;
    const requiredOutsidePt = row.outsideMinIn * POINTS_PER_INCH;

    const inside = insideMarginOf(layout);
    if (inside < requiredGutterPt) {
      issues.push({
        code: 'INSIDE_MARGIN_BELOW_GUTTER',
        message:
          `Inside (binding) margin ${inside}pt is below the required ${requiredGutterPt}pt gutter ` +
          `(${row.gutterIn}in) for a ${pageCount}-page interior.`,
        severity: 'ERROR',
      });
    }

    // Horizontal outside needs no separate check: with symmetric, unmirrored margins the outside
    // guarantee equals the inside guarantee (the sides alternate), and every row's gutter already
    // exceeds outsideMinIn. Top/bottom carry their own minimum.
    const topBottom = Math.min(layout.marginTop, layout.marginBottom);
    if (topBottom < requiredOutsidePt) {
      issues.push({
        code: 'MARGIN_BELOW_MINIMUM',
        message:
          `Top/bottom margin ${topBottom}pt is below the required minimum ${requiredOutsidePt}pt ` +
          `(${row.outsideMinIn}in).`,
        severity: 'ERROR',
      });
    }

    return issues;
  }
}
