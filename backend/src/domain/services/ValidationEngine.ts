import type { RuleRegistry } from './validation/RuleRegistry';
import type { ValidationRule } from './validation/ValidationRule';
import type { ValidationContext } from '../models/ValidationContext';
import type {
  ValidationReport,
  ValidationIssue,
  ValidationError,
  ValidationWarning,
  ValidationSeverity,
  QualityScore,
} from '../models/Book';

function toValidationError(issue: ValidationIssue): ValidationError {
  return { code: issue.code, message: issue.message, location: issue.location, suggestion: issue.suggestion };
}

function toValidationWarning(issue: ValidationIssue): ValidationWarning {
  return { code: issue.code, message: issue.message, location: issue.location, severity: 'warning' };
}

type ScoreCategory = keyof QualityScore['categories'];

// Which category a rule's findings count toward, keyed by ValidationRule.name
// (a string, not the class itself - ValidationEngine deliberately doesn't
// import any concrete rule, only the ValidationRule interface, so it stays
// decoupled from which rules actually exist). A rule name not listed here
// still counts toward `overall` (every issue does, regardless of category)
// but contributes to no per-category subscore - a future rule addition must
// add itself here, or its findings will be invisible in the category
// breakdown even though they're still reflected in `overall`. Disclosed here
// rather than silently risking a forgotten entry.
const RULE_CATEGORY: Record<string, ScoreCategory> = {
  StructuralRule: 'structure',
  HeadingRule: 'structure',
  MissingRequiredStyleRule: 'structure',
  MetadataRule: 'metadata',
  ComplianceRule: 'metadata',
  TypographyRule: 'typography',
  ImageRule: 'accessibility',
  HyperlinkRule: 'accessibility',
};

// Severity -> score penalty. Not derived from any external standard - locked
// functional intent (worse severity costs more) with arithmetic that can be
// tuned later once real usage data exists, same pattern ADR-0022 already
// used for averageHeadingDepth/paragraphDensity/lineDensity.
const SEVERITY_PENALTY: Record<ValidationSeverity, number> = {
  ERROR: 25,
  WARNING: 10,
  INFO: 3,
  SUGGESTION: 1,
};

function scoreFor(issues: ValidationIssue[]): number {
  const penalty = issues.reduce((sum, issue) => sum + SEVERITY_PENALTY[issue.severity], 0);
  return Math.max(0, 100 - penalty);
}

/**
 * Orchestrates every registered ValidationRule (docs/architecture/diagrams/
 * VALIDATION_ENGINE.md). Never mutates `context` (ADR-0027) - it only reads
 * each rule's findings and assembles the report. `errors`/`warnings` are
 * derived views over `issues` (ERROR/WARNING severity respectively) kept for
 * backward compatibility with ValidationResult's existing consumers -
 * INFO/SUGGESTION-severity issues appear only in `issues`, never in the
 * legacy arrays.
 *
 * QualityScore is strictly an interpretation layer over `issues` - it never
 * replaces or hides an individual diagnostic; every issue that contributes to
 * a lower score is still fully present, unabridged, in `issues`/`errors`/
 * `warnings`. Scoring is computed after every rule has run, from their
 * combined findings, never influencing what a rule reports.
 */
export class ValidationEngine {
  constructor(private registry: RuleRegistry) {}

  validate(context: ValidationContext): ValidationReport {
    const findings = this.registry.getAll().map((rule) => ({ rule, issues: rule.evaluate(context) }));
    const issues = findings.flatMap((f) => f.issues);

    const errors = issues.filter((issue) => issue.severity === 'ERROR').map(toValidationError);
    const warnings = issues.filter((issue) => issue.severity === 'WARNING').map(toValidationWarning);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      issues,
      score: this.computeScore(findings),
    };
  }

  private computeScore(findings: { rule: ValidationRule; issues: ValidationIssue[] }[]): QualityScore {
    const allIssues = findings.flatMap((f) => f.issues);

    const categoryIssues: Record<ScoreCategory, ValidationIssue[]> = {
      structure: [],
      metadata: [],
      typography: [],
      accessibility: [],
    };
    for (const { rule, issues } of findings) {
      const category = RULE_CATEGORY[rule.name];
      if (category) categoryIssues[category].push(...issues);
    }

    return {
      overall: scoreFor(allIssues),
      categories: {
        structure: scoreFor(categoryIssues.structure),
        metadata: scoreFor(categoryIssues.metadata),
        typography: scoreFor(categoryIssues.typography),
        accessibility: scoreFor(categoryIssues.accessibility),
      },
    };
  }
}
