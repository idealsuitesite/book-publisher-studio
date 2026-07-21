import type { Book, Content, Section, Chapter, Paragraph } from '../models/Book';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';

/**
 * Manual structure editing — the Domain write path (STRUCTURE_EDITING.md / STRUCTURE_EDITING_PHASE3.md
 * / CREATE_CHAPTER.md).
 *
 * A concrete Domain service (CTO-approved): one correct implementation for this Book model, no port —
 * the same judgment as `ThemeEngine`/`ASTBuilder`, the deliberate OPPOSITE of the `AIProvider` case.
 * Every operation is a PURE function: the input `Book` is never mutated, a new `Book` is returned
 * (ADR-0001 immutability).
 *
 * Ops: the *organize* half — reorder top-level chapters, rename any chapter/section — and the *create*
 * half (`CREATE_CHAPTER.md`, scope LOCKED to these two): promote a paragraph to a chapter, and its
 * exact inverse, merge a chapter back into the previous container.
 */
export class BookEditingService {
  // An id generator so create ops can mint stable ids; injectable for deterministic tests (the
  // ProjectService precedent). Defaulted so `new BookEditingService()` keeps working everywhere.
  constructor(private readonly idGenerator: () => string = defaultIdGenerator) {}

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

    return { ...book, mainContent: this.renumberChapters(reordered, now) };
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

  /**
   * Promote a paragraph/heading block (in a TOP-LEVEL container) to a new chapter, splitting that
   * container at the block: blocks before stay, the block's text becomes the new chapter's title,
   * blocks after become its content. Chapters renumber. The one op that lets an author carve
   * chapters out of an unstructured manuscript (CREATE_CHAPTER.md; scope LOCKED to top-level
   * containers — nested-subsection blocks are out of round 1).
   *
   * §9.3 (CTO): an *untitled* section left empty by the split is dropped (no phantom section); a
   * titled container (a chapter, or a titled section) is kept even if now empty — it has a title
   * worth preserving.
   */
  promoteToChapter(book: Book, blockId: string, now: Date = new Date()): Book {
    const containerIndex = book.mainContent.findIndex((c) =>
      c.content.some((b) => b.id === blockId && (b.type === 'paragraph' || b.type === 'heading'))
    );
    if (containerIndex === -1) {
      throw new ContentNotFoundError(`promoteToChapter: no promotable text block with id "${blockId}" in a top-level container`);
    }
    const container = book.mainContent[containerIndex];
    const blockIndex = container.content.findIndex((b) => b.id === blockId);
    const block = container.content[blockIndex];
    // Narrows to a text-bearing block; the findIndex above already guaranteed it.
    if (block.type !== 'paragraph' && block.type !== 'heading') {
      throw new ContentNotFoundError(`promoteToChapter: block "${blockId}" is not a text block`);
    }

    const newChapter: Chapter = {
      type: 'chapter',
      id: this.idGenerator(),
      number: 0, // renumbered below
      title: block.text,
      content: container.content.slice(blockIndex + 1),
      createdAt: now,
      updatedAt: now,
    };

    const remainder: Content = { ...container, content: container.content.slice(0, blockIndex), updatedAt: now };
    const keepRemainder = !(remainder.type === 'section' && remainder.title.trim() === '' && remainder.content.length === 0);

    const rebuilt: Content[] = [
      ...book.mainContent.slice(0, containerIndex),
      ...(keepRemainder ? [remainder] : []),
      newChapter,
      ...book.mainContent.slice(containerIndex + 1),
    ];
    return { ...book, mainContent: this.renumberChapters(rebuilt, now) };
  }

  /**
   * The exact inverse of `promoteToChapter`: turn a top-level chapter's title back into a paragraph
   * and merge its content into the immediately-preceding container. Chapters renumber.
   *
   * §9.1 (CTO): the first chapter has no previous container — disallowed (throws); version-undo is
   * the clean exit, not a new model path for a rare case. Inline formatting a promoted block may
   * have carried is not restored (a chapter title is plain text) — disclosed in CREATE_CHAPTER.md.
   */
  mergeChapterIntoPrevious(book: Book, chapterId: string, now: Date = new Date()): Book {
    const index = book.mainContent.findIndex((c) => c.type === 'chapter' && c.id === chapterId);
    if (index === -1) {
      throw new ContentNotFoundError(`mergeChapterIntoPrevious: no top-level chapter with id "${chapterId}"`);
    }
    if (index === 0) {
      throw new ContentNotFoundError(`mergeChapterIntoPrevious: chapter "${chapterId}" is first; nothing to merge into`);
    }
    const chapter = book.mainContent[index] as Chapter;
    const prev = book.mainContent[index - 1];
    const titleBlock: Paragraph = { type: 'paragraph', id: this.idGenerator(), text: chapter.title };

    const mergedPrev: Content = {
      ...prev,
      content: [...prev.content, titleBlock, ...chapter.content],
      updatedAt: now,
    };

    const rebuilt: Content[] = [
      ...book.mainContent.slice(0, index - 1),
      mergedPrev,
      ...book.mainContent.slice(index + 1),
    ];
    return { ...book, mainContent: this.renumberChapters(rebuilt, now) };
  }

  /** Renumber top-level chapters 1..N in reading order; a chapter whose number changed advances its
   * updatedAt. Sections carry through untouched. Shared by every op that changes chapter order/count. */
  private renumberChapters(contents: Content[], now: Date): Content[] {
    let chapterNumber = 0;
    return contents.map((content): Content => {
      if (content.type !== 'chapter') return content;
      chapterNumber += 1;
      if (content.number === chapterNumber) return content;
      return { ...content, number: chapterNumber, updatedAt: now };
    });
  }
}

function defaultIdGenerator(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
