import type { Book, ValidationResult, ValidationError, Block } from '../models/Book';
import { isChapter } from '../models/Book';

/**
 * Below this many words, a chapterless single-flow document (an essay, a corporate report, an
 * article) is a legitimate editorial choice; above it, a book-length manuscript with ZERO
 * detected chapters almost certainly means the source styled its headings visually (bold,
 * size) instead of Word's semantic Heading styles, and the import silently found no structure
 * (ADR-0049, IMPORT_FIDELITY.md §1 — reproduced on a real manuscript). ONE named constant by
 * CTO direction: a candidate `ValidationProfile` parameter later, never a scattered magic
 * number.
 */
export const UNSTRUCTURED_WORD_THRESHOLD = 2000;

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

    // ADR-0049: "no structure detected" is a real, nameable state — before this check, a
    // book-length manuscript whose every paragraph landed in one anonymous section scored
    // structure 100/100 and nobody said a word (IMPORT_FIDELITY.md §2.3). ERROR severity,
    // but import remains explorable (ValidationEngine.EXPLORABLE_ERROR_CODES): the author
    // needs the project, the Proof and the Structure station to understand the problem.
    const chapterCount = book.mainContent.filter(isChapter).length;
    if (chapterCount === 0) {
      const words = this.countWords(book);
      if (words > UNSTRUCTURED_WORD_THRESHOLD) {
        errors.push({
          code: 'UNSTRUCTURED_MANUSCRIPT',
          message: `No chapters were detected in a ${words.toLocaleString('en-US')}-word manuscript`,
          location: 'mainContent',
          suggestion:
            'Apply the Word "Heading 1" style to chapter titles in the source document and import again',
        });
      }
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

  /**
   * Word count for the UNSTRUCTURED_WORD_THRESHOLD check only — a threshold needs an order of
   * magnitude, not `BookMetricsCalculator`'s enriched metrics, and the validator must stay
   * usable on a book that has not been enriched yet (import validates before metrics run).
   */
  private countWords(book: Book): number {
    let words = 0;
    const countBlock = (block: Block): void => {
      if ('text' in block && typeof block.text === 'string') {
        words += block.text.trim() ? block.text.trim().split(/\s+/).length : 0;
      } else if (block.type === 'list') {
        for (const item of block.items) words += item.trim() ? item.trim().split(/\s+/).length : 0;
      }
    };
    const walk = (contents: Book['mainContent']): void => {
      for (const content of contents) {
        for (const block of content.content) countBlock(block);
        if (content.type === 'chapter' && content.sections) {
          walk(content.sections as unknown as Book['mainContent']);
        } else if (content.type === 'section' && content.subsections) {
          walk(content.subsections as unknown as Book['mainContent']);
        }
      }
    };
    walk(book.mainContent);
    return words;
  }
}
