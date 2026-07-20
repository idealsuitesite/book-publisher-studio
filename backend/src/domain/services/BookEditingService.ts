import type { Book, Content, Section } from '../models/Book';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';

/**
 * Manual structure editing — the Domain write path (STRUCTURE_EDITING.md, Level-1, phase 1 only).
 *
 * A concrete Domain service (Q1, CTO-approved): one correct implementation for this Book model, no
 * port — the same judgment as `ThemeEngine`/`ASTBuilder`, and the deliberate OPPOSITE of the
 * `AIProvider` case (there, multiple real implementations are plausible). Every operation is a PURE
 * function: the input `Book` is never mutated, a new `Book` is returned (ADR-0001 immutability).
 *
 * PHASE 1 SCOPE (CTO: "reviens avant la phase 2"): the two immediately-meaningful organize ops —
 * reorder top-level chapters, rename any chapter/section. NO persistence, NO routes, NO UI (those
 * are phase 2+). Front-matter-as-user-content (Q3, decided) is the natural next op in this service
 * but is deferred: a stored front-matter edit is inert until `FrontMatterBuilder` and the three
 * renderers render stored content instead of synthesizing it — renderer work, out of phase 1.
 */
export class BookEditingService {
  /**
   * Move a top-level chapter/section from `fromIndex` to `toIndex`, renumbering chapters to match
   * the new reading order. Returns a new Book; the original is untouched.
   */
  reorderChapters(book: Book, fromIndex: number, toIndex: number, now: Date = new Date()): Book {
    const n = book.mainContent.length;
    if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n) {
      throw new ContentNotFoundError(`reorderChapters: index out of range (from=${fromIndex}, to=${toIndex}, length=${n})`);
    }

    const reordered = [...book.mainContent];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Renumber chapters to reflect the new order; a chapter whose number changed is a real edit,
    // so its updatedAt advances. Sections have no number and are carried through untouched.
    let chapterNumber = 0;
    const renumbered = reordered.map((content): Content => {
      if (content.type !== 'chapter') return content;
      chapterNumber += 1;
      if (content.number === chapterNumber) return content;
      return { ...content, number: chapterNumber, updatedAt: now };
    });

    return { ...book, mainContent: renumbered };
  }

  /**
   * Rename any chapter or section (found by id, at any depth) to `newTitle`. Returns a new Book;
   * the original is untouched. Throws `ContentNotFoundError` if no node has the id.
   */
  rename(book: Book, id: string, newTitle: string, now: Date = new Date()): Book {
    let found = false;

    const renameIn = (contents: Content[]): Content[] =>
      contents.map((content): Content => {
        if (content.id === id) {
          found = true;
          return { ...content, title: newTitle, updatedAt: now };
        }
        if (content.type === 'chapter' && content.sections) {
          return { ...content, sections: renameIn(content.sections) as Section[] };
        }
        if (content.type === 'section' && content.subsections) {
          return { ...content, subsections: renameIn(content.subsections) as Section[] };
        }
        return content;
      });

    const mainContent = renameIn(book.mainContent);
    if (!found) {
      throw new ContentNotFoundError(`rename: no chapter or section with id "${id}"`);
    }
    return { ...book, mainContent };
  }
}
