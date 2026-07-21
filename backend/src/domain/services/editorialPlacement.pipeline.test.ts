import { describe, it, expect } from 'vitest';
import { orderByRole } from './orderByRole';
import { ThemeEngine } from './ThemeEngine';
import { TypographyResolver } from './TypographyResolver';
import { LayoutEngine } from './LayoutEngine';
import { ClassicTheme } from '../themes/ClassicTheme';
import { createBook } from '../models/Book';
import type { Book, Chapter, Block, PartRole } from '../models/Book';
import type { PageLayout } from '../models/PageLayout';

const LETTER: PageLayout = {
  pageSize: 'letter', width: 612, height: 792, marginTop: 72, marginBottom: 72, marginLeft: 72, marginRight: 72,
};

const now = new Date();
const para = (id: string, text: string): Block => ({ type: 'paragraph', id, text, inlines: [] });
const ch = (id: string, title: string, blockText: string, role?: PartRole): Chapter => ({
  type: 'chapter', id, number: 1, title, content: [para(`${id}-b`, blockText)], role, createdAt: now, updatedAt: now,
});

/** A book whose Introduction and Bibliography sit in the MIDDLE of the document, tagged for placement. */
function tocBook(): Book {
  const base = createBook({ title: 'T', author: 'A', language: 'en' }, [
    ch('c1', 'Chapter One', 'First chapter body.'),
    ch('intro', 'Introduction', 'Introductory body.', 'front'),
    ch('c2', 'Chapter Two', 'Second chapter body.'),
    ch('bib', 'Bibliography', 'Author, A Real Work, 2026.', 'back'),
  ]);
  return { ...base, frontMatter: { toc: { generateAutomatically: true, entries: [] } } };
}

function paginateOrdered(book: Book) {
  const styled = new ThemeEngine().applyTheme(orderByRole(book), ClassicTheme);
  const typeset = new TypographyResolver().resolve(styled);
  return new LayoutEngine().paginate(typeset, LETTER);
}

describe('editorial-part placement — through the real pipeline (MINI_DR_EDITORIAL_PLACEMENT)', () => {
  it('places the front part before the chapters and the back part after them, in the TOC', () => {
    const result = paginateOrdered(tocBook());
    // The TOC is derived from the (reordered) content sequence, so its order IS the export order.
    expect(result.tableOfContents?.map((e) => e.title)).toEqual([
      'Introduction', // front — before the chapters, though authored in the middle
      'Chapter One',
      'Chapter Two',
      'Bibliography', // back — after the last chapter
    ]);
  });

  it('places the parts in the paginated content flow, not merely the TOC', () => {
    const blocks = paginateOrdered(tocBook()).pages.flatMap((p) => p.blocks);
    // Introduction's body comes before Chapter One's; the Bibliography's body is last.
    expect(blocks.indexOf('intro-b')).toBeLessThan(blocks.indexOf('c1-b'));
    expect(blocks.at(-1)).toBe('bib-b');
  });

  it('BOUNDARY: a Bibliography part renders as its positioned paragraphs, NEVER as structured entries', () => {
    // The CTO's watched boundary (§1/§2): placement is positional, not structural. The bibliography
    // is present in the flow as its own Block[] paragraph, and nothing populates the structured
    // BackMatter.bibliography (BibEntry[]) — positioning it must not silently structure it.
    const book = tocBook();
    const result = paginateOrdered(book);
    expect(result.pages.flatMap((p) => p.blocks)).toContain('bib-b'); // its paragraph is rendered content
    expect(book.backMatter.bibliography).toBeUndefined(); // structured field never touched
    expect(orderByRole(book).backMatter.bibliography).toBeUndefined(); // ordering doesn't structure it
  });

  it('an untagged book paginates exactly as before — no regression for books that never use this', () => {
    const untagged = createBook({ title: 'T', author: 'A', language: 'en' }, [
      ch('c1', 'Chapter One', 'A.'),
      ch('c2', 'Chapter Two', 'B.'),
    ]);
    // orderByRole is a no-op (same reference), so the paginated flow is document order untouched.
    expect(orderByRole(untagged)).toBe(untagged);
    const blocks = paginateOrdered(untagged).pages.flatMap((p) => p.blocks);
    expect(blocks).toEqual(['c1-b', 'c2-b']);
  });
});
