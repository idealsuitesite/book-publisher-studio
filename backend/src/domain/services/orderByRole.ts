import type { Book, Content } from '../models/Book';

/**
 * Editorial-part export placement (MINI_DR_EDITORIAL_PLACEMENT, §2b + finding 2). Reorders a book's
 * top-level content so front-role parts render before the chapters and back-role parts after them —
 * front matter (preface/introduction/…) first, ordinary chapters next, back matter (conclusion/
 * bibliography/…) last — with document order preserved WITHIN each group.
 *
 * Pure and render-time (ADR-0052): applied in the shared render tail before pagination, so pagination,
 * the TOC and running heads all follow the reordered sequence with no per-renderer ordering code. The
 * STORED book keeps document order + the role tags; only the rendered book is reordered — the same
 * render-time-derivation discipline as FrontMatterBuilder.
 *
 * No-op guarantee: a book with NO tagged part returns the SAME book reference (not a rebuilt copy),
 * so nothing changes for the books that never use this feature.
 */
export function orderByRole(book: Book): Book {
  const front: Content[] = [];
  const main: Content[] = [];
  const back: Content[] = [];

  for (const content of book.mainContent) {
    if (content.role === 'front') front.push(content);
    else if (content.role === 'back') back.push(content);
    else main.push(content);
  }

  // Byte-identical no-op when nothing is tagged: return the input untouched.
  if (front.length === 0 && back.length === 0) return book;

  return { ...book, mainContent: [...front, ...main, ...back] };
}
