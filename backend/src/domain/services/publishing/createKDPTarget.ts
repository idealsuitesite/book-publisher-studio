import { KDPTarget } from './KDPTarget';
import { Packaging } from '../Packaging';
import { SubmissionValidator } from '../SubmissionValidator';
import { KDPRuleProvider } from './KDPRuleProvider';

// Single source of truth for "how KDPTarget is really wired" (mirrors createValidationEngine.ts's
// exact purpose) - a future caller (PublishingUseCase, Commit 5) uses this instead of
// hand-assembling the same three classes itself.
export function createKDPTarget(): KDPTarget {
  return new KDPTarget(new Packaging(), new SubmissionValidator(new KDPRuleProvider()));
}
