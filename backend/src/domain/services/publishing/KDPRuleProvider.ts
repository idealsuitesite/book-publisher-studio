import type { ValidationRuleProvider } from '../../ports/ValidationRuleProvider';
import type { PostRenderValidationRule } from './PostRenderValidationRule';
import type { KDPRuleData } from './KDPRuleData';
import { KDP_RULE_DATA } from './KDPRuleData';
import { RequiredMetadataFieldsRule } from './RequiredMetadataFieldsRule';
import { PageCountRule } from './PageCountRule';
import { CoverPresenceRule } from './CoverPresenceRule';
import { InteriorFormatAvailabilityRule } from './InteriorFormatAvailabilityRule';
import { StructurePresenceRule } from './StructurePresenceRule';

// The only ValidationRuleProvider implementation this sprint (Decision 7, ADR-0036). Domain, not
// Infrastructure - the Commit-0 spike confirmed no file I/O is needed to turn KDPRuleData into
// rules (same conclusion ManualLayoutSelector already reached for LayoutSelector, ADR-0029's
// port-vs-class judgment applied identically here). Turns inert KDPRuleData into concrete
// PostRenderValidationRule instances - this is where "if(platform=='kdp')" would have leaked
// into SubmissionValidator without Decision 7.
export class KDPRuleProvider implements ValidationRuleProvider {
  constructor(private readonly data: KDPRuleData = KDP_RULE_DATA) {}

  getRules(): PostRenderValidationRule[] {
    return [
      new RequiredMetadataFieldsRule(this.data.requiredMetadataFields),
      // 'pdf' because that is the interior format KDP paginates and rejects on. An EPUB is
      // reflowable and has no page count to validate (ADR-0042).
      new PageCountRule(
        this.data.interiorSpec.minPageCount,
        this.data.interiorSpec.maxPageCount,
        'pdf'
      ),
      new CoverPresenceRule(),
      new InteriorFormatAvailabilityRule(this.data.interiorSpec.acceptedFormats),
      // ADR-0049, provisional (CTO amendment): KDP-specific by design, see the rule's own doc.
      new StructurePresenceRule(),
    ];
  }
}
