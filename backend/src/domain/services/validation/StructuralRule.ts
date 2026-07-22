import { BookValidator } from '../BookValidator';
import type { ValidationRule } from './ValidationRule';
import type { ValidationContext } from '../../models/ValidationContext';
import type { ValidationIssue } from '../../models/Book';

/**
 * Adapts BookValidator's existing structural checks (missing title/author,
 * empty book, empty/duplicate chapter) into the ValidationRule contract,
 * unchanged - "migration before evolution" (Sprint 5 commit 3,
 * docs/architecture/diagrams/VALIDATION_ENGINE.md §8). BookValidator itself
 * is untouched and still directly used by ImportManuscriptUseCase until
 * commit 11 rewires it to ValidationEngine - this rule composes it rather
 * than duplicating its logic, so there is exactly one place these 5 checks
 * are implemented.
 */
export class StructuralRule implements ValidationRule {
  readonly name = 'StructuralRule';
  private validator = new BookValidator();

  evaluate(context: ValidationContext): ValidationIssue[] {
    return this.validator.validate(context.book).errors.map(
      (error): ValidationIssue => ({
        code: error.code,
        message: error.message,
        location: error.location,
        // A missing author is EXPLORABLE, not blocking (FOUNDER_TRAVERSAL defect 2, ADR-0049):
        // now that an unsupplied author is honestly absent rather than the placeholder 'Unknown',
        // this check finally fires — and it must NOT reject the manuscript. The author still gets
        // a project and is prompted to supply the name (the same doctrine as UNSTRUCTURED_
        // MANUSCRIPT). The KDP publish gate (COMPLIANCE_MISSING_AUTHOR) stays a real blocker where
        // it belongs — you cannot publish to Amazon without an author, but you can still import,
        // edit and export. MISSING_TITLE stays ERROR: the title always derives from the filename,
        // so a truly empty title signals a genuinely broken import, not an unsupplied field.
        severity: error.code === 'MISSING_AUTHOR' ? 'WARNING' : 'ERROR',
        suggestion: error.suggestion,
      })
    );
  }
}
