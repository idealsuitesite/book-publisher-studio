import type { Book, ValidationResult, ValidationError } from '../models/Book';
import { isChapter } from '../models/Book';

export class BookValidator {
  validate(book: Book): ValidationResult {
    const errors: ValidationError[] = [...this.checkMetadata(book), ...this.checkStructure(book)];

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  private checkMetadata(book: Book): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!book.metadata.title || book.metadata.title.trim().length === 0) {
      errors.push({
        code: 'MISSING_TITLE',
        message: 'Book title is required',
        location: 'metadata',
      });
    }

    if (!book.metadata.author || book.metadata.author.trim().length === 0) {
      errors.push({
        code: 'MISSING_AUTHOR',
        message: 'Book author is required',
        location: 'metadata',
      });
    }

    return errors;
  }

  private checkStructure(book: Book): ValidationError[] {
    const errors: ValidationError[] = [];

    if (book.mainContent.length === 0) {
      errors.push({
        code: 'EMPTY_BOOK',
        message: 'Book has no content',
        location: 'mainContent',
      });
      return errors;
    }

    const seenChapterNumbers = new Set<number>();

    for (const content of book.mainContent) {
      if (!isChapter(content)) continue;

      if (!content.title || content.title.trim().length === 0) {
        errors.push({
          code: 'EMPTY_CHAPTER_TITLE',
          message: 'Chapter is missing a title',
          location: `Chapter ${content.number}`,
        });
      }

      if (seenChapterNumbers.has(content.number)) {
        errors.push({
          code: 'DUPLICATE_CHAPTER_NUMBER',
          message: `Duplicate chapter number: ${content.number}`,
          location: `Chapter ${content.number}`,
        });
      }
      seenChapterNumbers.add(content.number);
    }

    return errors;
  }
}
