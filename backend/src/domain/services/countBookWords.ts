import type { Book, Block } from '../models/Book';

/**
 * Word count computed from the AST itself — used by threshold checks (ADR-0049) that must not
 * depend on whether `BookMetricsCalculator` has enriched the book yet. The publish path
 * rebuilds the book from the stored source WITHOUT enrichment, and relying on
 * `book.wordCount` there made `StructurePresenceRule` silently see 0 words — found live, the
 * exact defect family the real-manuscript discipline exists for. A threshold needs an order
 * of magnitude, so this deliberately stays a plain token count.
 */
export function countBookWords(book: Book): number {
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
