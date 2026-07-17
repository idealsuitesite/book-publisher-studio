import type { ValidationRule } from './ValidationRule';
import type { ValidationContext } from '../../models/ValidationContext';
import type { ValidationIssue } from '../../models/Book';

/**
 * KDP/EPUB PreRenderValidation only (docs/architecture/diagrams/
 * VALIDATION_ENGINE.md §3 Decision 2, §5 item 8) - everything checkable from
 * the Book AST alone. Deliberately does NOT touch any rendered artifact
 * (PDF/DOCX/EPUB bytes) - that's PostRenderValidation, out of Sprint 5
 * entirely, likely future Publishing Engine scope.
 *
 * Findings here deliberately overlap MetadataRule (ISBN) and StructuralRule
 * (title/author) - same underlying fields, framed as platform-readiness
 * rather than generic completeness/structure. Both rules fire independently
 * by design (VALIDATION_ENGINE.md §5 item 8); a future UI can de-duplicate
 * by code if that turns out to be noisy in practice. All WARNING severity -
 * a book failing these is still exportable in general, just not ready for
 * KDP/EPUB specifically (a book that's *structurally* broken, e.g. an empty
 * title, is already flagged as an ERROR by StructuralRule independently).
 */
export class ComplianceRule implements ValidationRule {
  readonly name = 'ComplianceRule';

  evaluate(context: ValidationContext): ValidationIssue[] {
    const { metadata } = context.book;
    const issues: ValidationIssue[] = [];

    if (!metadata.isbn || metadata.isbn.trim().length === 0) {
      issues.push({
        code: 'COMPLIANCE_MISSING_ISBN',
        message: 'Amazon KDP requires an ISBN before a book can be published',
        location: 'metadata',
        severity: 'WARNING',
      });
    }

    if (!metadata.title || metadata.title.trim().length === 0) {
      issues.push({
        code: 'COMPLIANCE_MISSING_TITLE',
        message: 'KDP and EPUB both require a non-empty title for publication readiness',
        location: 'metadata',
        severity: 'WARNING',
      });
    }

    if (!metadata.author || metadata.author.trim().length === 0) {
      issues.push({
        code: 'COMPLIANCE_MISSING_AUTHOR',
        message: 'KDP and EPUB both require a non-empty author for publication readiness',
        location: 'metadata',
        severity: 'WARNING',
      });
    }

    return issues;
  }
}
