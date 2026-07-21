import { describe, it, expect } from 'vitest';
import { orderByRole } from './orderByRole';
import { createBook } from '../models/Book';
import type { Book, Chapter, PartRole } from '../models/Book';

const now = new Date();
const ch = (id: string, role?: PartRole): Chapter => ({
  type: 'chapter', id, number: 1, title: id, content: [], role, createdAt: now, updatedAt: now,
});
const book = (contents: Chapter[]): Book => createBook({ title: 'T', author: 'A', language: 'en' }, contents);

describe('orderByRole (MINI_DR_EDITORIAL_PLACEMENT, §2b)', () => {
  it('returns the SAME book reference when no part is tagged — the byte-identical no-op', () => {
    // The CTO's guard: books that never use this feature must not be reallocated or reordered.
    const b = book([ch('c1'), ch('c2'), ch('c3')]);
    expect(orderByRole(b)).toBe(b);
  });

  it('orders a front-tagged part before the chapters and a back-tagged part after them', () => {
    // Introduction sits in the MIDDLE of the document but must export first; Conclusion exports last.
    const b = book([ch('c1'), ch('intro', 'front'), ch('c2'), ch('concl', 'back')]);
    expect(orderByRole(b).mainContent.map((c) => c.id)).toEqual(['intro', 'c1', 'c2', 'concl']);
  });

  it('preserves document order WITHIN each group', () => {
    const b = book([ch('c1'), ch('bib', 'back'), ch('intro', 'front'), ch('c2'), ch('ackn', 'front'), ch('concl', 'back')]);
    // front: intro, ackn (their document order) | main: c1, c2 | back: bib, concl (their document order)
    expect(orderByRole(b).mainContent.map((c) => c.id)).toEqual(['intro', 'ackn', 'c1', 'c2', 'bib', 'concl']);
  });

  it('does not mutate the input book (ADR-0001 immutability)', () => {
    const b = book([ch('intro', 'front'), ch('c1')]);
    const before = b.mainContent.map((c) => c.id);
    orderByRole(b);
    expect(b.mainContent.map((c) => c.id)).toEqual(before);
  });
});
