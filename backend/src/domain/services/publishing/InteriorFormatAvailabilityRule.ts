import type { PostRenderValidationContext } from '../../models/PostRenderValidationContext';
import type { PublishingIssue } from '../../models/PublishingReport';
import type { PostRenderValidationRule } from './PostRenderValidationRule';

type RenderFormat = 'pdf' | 'epub' | 'docx';

// Generic - takes the accepted-format list as a constructor argument rather than hardcoding
// KDP's list (pdf/docx), so a future platform with a different accepted set (e.g. an EPUB-only
// target) can reuse this same rule class (Decision 8).
export class InteriorFormatAvailabilityRule implements PostRenderValidationRule {
  readonly name = 'InteriorFormatAvailabilityRule';

  constructor(private readonly acceptedFormats: RenderFormat[]) {}

  evaluate(context: PostRenderValidationContext): PublishingIssue[] {
    const included = context.bundle.manifest.formatsIncluded;
    const hasAcceptedFormat = included.some((format) => this.acceptedFormats.includes(format));
    if (!hasAcceptedFormat) {
      return [
        {
          code: 'NO_ACCEPTED_INTERIOR_FORMAT',
          message: `None of the rendered formats (${included.join(', ') || 'none'}) are accepted for this target's interior manuscript.`,
          severity: 'ERROR',
        },
      ];
    }
    return [];
  }
}
