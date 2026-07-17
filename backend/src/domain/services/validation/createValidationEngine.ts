import { RuleRegistry } from './RuleRegistry';
import { ValidationEngine } from '../ValidationEngine';
import { StructuralRule } from './StructuralRule';
import { MetadataRule } from './MetadataRule';
import { HeadingRule } from './HeadingRule';
import { MissingRequiredStyleRule } from './MissingRequiredStyleRule';
import { TypographyRule } from './TypographyRule';
import { ImageRule } from './ImageRule';
import { HyperlinkRule } from './HyperlinkRule';
import { ComplianceRule } from './ComplianceRule';

/**
 * Builds the production ValidationEngine with every Sprint 5 rule
 * registered, in a stable order (RuleRegistry preserves registration order,
 * so ValidationReport.issues reads consistently run to run). Single source
 * of truth for "which rules exist" - app.ts and tests both call this instead
 * of each hand-rolling the same registration list, so a future rule addition
 * only needs to be added here once.
 */
export function createValidationEngine(): ValidationEngine {
  const registry = new RuleRegistry();
  registry.register(new StructuralRule());
  registry.register(new MetadataRule());
  registry.register(new HeadingRule());
  registry.register(new MissingRequiredStyleRule());
  registry.register(new TypographyRule());
  registry.register(new ImageRule());
  registry.register(new HyperlinkRule());
  registry.register(new ComplianceRule());
  return new ValidationEngine(registry);
}
