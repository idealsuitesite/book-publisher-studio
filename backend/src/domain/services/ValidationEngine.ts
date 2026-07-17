import type { RuleRegistry } from './validation/RuleRegistry';
import type { ValidationContext } from '../models/ValidationContext';
import type { ValidationReport, ValidationIssue, ValidationError, ValidationWarning, QualityScore } from '../models/Book';

function toValidationError(issue: ValidationIssue): ValidationError {
  return { code: issue.code, message: issue.message, location: issue.location, suggestion: issue.suggestion };
}

function toValidationWarning(issue: ValidationIssue): ValidationWarning {
  return { code: issue.code, message: issue.message, location: issue.location, severity: 'warning' };
}

/**
 * Orchestrates every registered ValidationRule (docs/architecture/diagrams/
 * VALIDATION_ENGINE.md). Never mutates `context` (ADR-0027) - it only reads
 * each rule's findings and assembles the report. `errors`/`warnings` are
 * derived views over `issues` (ERROR/WARNING severity respectively) kept for
 * backward compatibility with ValidationResult's existing consumers -
 * INFO/SUGGESTION-severity issues appear only in `issues`, never in the
 * legacy arrays.
 */
export class ValidationEngine {
  constructor(private registry: RuleRegistry) {}

  validate(context: ValidationContext): ValidationReport {
    const issues = this.registry.getAll().flatMap((rule) => rule.evaluate(context));

    const errors = issues.filter((issue) => issue.severity === 'ERROR').map(toValidationError);
    const warnings = issues.filter((issue) => issue.severity === 'WARNING').map(toValidationWarning);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      issues,
      score: this.computeScore(issues),
    };
  }

  // Provisional scoring - a real composite formula (per-category weighting,
  // etc.) is Commit 10's job (VALIDATION_ENGINE.md §5 item 10, §8). For now:
  // 100 minus a flat penalty per ERROR/WARNING issue, floored at 0, identical
  // across every category until per-rule category weighting exists.
  private computeScore(issues: ValidationIssue[]): QualityScore {
    const blockingCount = issues.filter((issue) => issue.severity === 'ERROR' || issue.severity === 'WARNING').length;
    const overall = Math.max(0, 100 - blockingCount * 10);

    return {
      overall,
      categories: { structure: overall, metadata: overall, typography: overall, accessibility: overall },
    };
  }
}
