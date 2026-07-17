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
        severity: 'ERROR',
        suggestion: error.suggestion,
      })
    );
  }
}
