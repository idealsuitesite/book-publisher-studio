import type { ValidationRule } from './ValidationRule';
import type { ValidationContext } from '../../models/ValidationContext';
import type { ValidationIssue } from '../../models/Book';

/**
 * Flags incomplete BookMetadata - ISBN, language, description, cover image.
 * WARNING severity throughout (not ERROR): a manuscript missing any of these
 * is still exportable, just not ready for certain platforms
 * (docs/architecture/diagrams/VALIDATION_ENGINE.md §5 item 2). Distinct from
 * StructuralRule's MISSING_TITLE/MISSING_AUTHOR, which stay ERROR - those
 * block export entirely, these don't.
 */
export class MetadataRule implements ValidationRule {
  readonly name = 'MetadataRule';

  evaluate(context: ValidationContext): ValidationIssue[] {
    const { metadata } = context.book;
    const issues: ValidationIssue[] = [];

    if (!metadata.isbn || metadata.isbn.trim().length === 0) {
      issues.push({
        code: 'MISSING_ISBN',
        message: 'Book ISBN is not set',
        location: 'metadata',
        severity: 'WARNING',
      });
    }

    if (!metadata.language || metadata.language.trim().length === 0) {
      issues.push({
        code: 'MISSING_LANGUAGE',
        message: 'Book language is not set',
        location: 'metadata',
        severity: 'WARNING',
      });
    }

    if (!metadata.description || metadata.description.trim().length === 0) {
      issues.push({
        code: 'MISSING_DESCRIPTION',
        message: 'Book description is not set',
        location: 'metadata',
        severity: 'WARNING',
      });
    }

    if (!metadata.coverImage) {
      issues.push({
        code: 'MISSING_COVER_IMAGE',
        message: 'Book cover image is not set',
        location: 'metadata',
        severity: 'WARNING',
      });
    }

    return issues;
  }
}
