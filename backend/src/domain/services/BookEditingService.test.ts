import { describe, it, expect } from 'vitest';
import { createBook, type Book, type Content, type Chapter, type Section } from '../models/Book';
import { BookEditingService } from './BookEditingService';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';

const NOW = new Date('2026-07-21T12:00:00Z');
const OLD = new Date('2020-01-01T00:00:00Z');

function section(id: string, title: string, level: number, subs: Section[] = []): Section {
  return { type: 'section', id, title, content: [], subsections: subs, level, createdAt: OLD, updatedAt: OLD };
}
function chapter(id: string, number: number, title: string, sections: Section[] = []): Chapter {
  return { type: 'chapter', id, number, title, content: [], sections, createdAt: OLD, updatedAt: OLD };
}

/** A representative nested structure: 3 chapters, sections, and a subsection. */
function sampleBook(): Book {
  return createBook({ title: 'T', author: 'A', language: 'en' }, [
    chapter('c1', 1, 'Chapter One', [section('s1a', 'Sec 1a', 2, [section('ss1', 'Sub', 3)]), section('s1b', 'Sec 1b', 2)]),
    chapter('c2', 2, 'Chapter Two', [section('s2a', 'Sec 2a', 2)]),
    chapter('c3', 3, 'Chapter Three'),
  ]);
}

/** Every chapter/section node in the tree, depth-first. */
function nodes(contents: Content[]): { id: string; title: string }[] {
  return contents.flatMap((c) => {
    const nested = c.type === 'chapter' ? c.sections : c.subsections;
    return [{ id: c.id, title: c.title }, ...(nested ? nodes(nested) : [])];
  });
}

const service = new BookEditingService();

describe('BookEditingService — reorderChapters (property-style, exhaustive over the structure)', () => {
  const n = sampleBook().mainContent.length;

  for (let from = 0; from < n; from++) {
    for (let to = 0; to < n; to++) {
      it(`move ${from}->${to}: preserves the chapter set, lands the moved chapter at ${to}, renumbers 1..N`, () => {
        const book = sampleBook();
        const originalIds = book.mainContent.map((c) => c.id);
        const result = service.reorderChapters(book, from, to, NOW);

        // same set of chapters, none lost or duplicated
        expect([...result.mainContent.map((c) => c.id)].sort()).toEqual([...originalIds].sort());
        // the moved chapter is at `to`
        expect(result.mainContent[to].id).toBe(originalIds[from]);
        // chapters renumbered to reading order
        result.mainContent.forEach((c, i) => {
          if (c.type === 'chapter') expect(c.number).toBe(i + 1);
        });
        // ORIGINAL is untouched (immutability, ADR-0001)
        expect(book.mainContent.map((c) => c.id)).toEqual(originalIds);
        expect((book.mainContent[0] as Chapter).number).toBe(1);
      });
    }
  }

  it('out-of-range indices throw ContentNotFoundError', () => {
    expect(() => service.reorderChapters(sampleBook(), -1, 0)).toThrow(ContentNotFoundError);
    expect(() => service.reorderChapters(sampleBook(), 0, 99)).toThrow(ContentNotFoundError);
  });

  it('a no-op move (from === to) preserves order and numbers', () => {
    const result = service.reorderChapters(sampleBook(), 1, 1, NOW);
    expect(result.mainContent.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });
});

describe('BookEditingService — rename (property-style, exhaustive over every node)', () => {
  for (const target of nodes(sampleBook().mainContent)) {
    it(`renames "${target.id}" and leaves every other node untouched`, () => {
      const book = sampleBook();
      const result = service.rename(book, target.id, 'RENAMED', NOW);

      const after = nodes(result.mainContent);
      for (const node of after) {
        const before = nodes(book.mainContent).find((b) => b.id === node.id)!;
        expect(node.title).toBe(node.id === target.id ? 'RENAMED' : before.title);
      }
      // structure preserved: same id tree
      expect(after.map((x) => x.id)).toEqual(nodes(book.mainContent).map((x) => x.id));
      // ORIGINAL untouched
      expect(nodes(book.mainContent).find((b) => b.id === target.id)!.title).toBe(target.title);
    });
  }

  it('renaming a nonexistent id throws ContentNotFoundError', () => {
    expect(() => service.rename(sampleBook(), 'does-not-exist', 'X')).toThrow(ContentNotFoundError);
  });

  it('the edited node advances updatedAt; the original instance keeps its old timestamp', () => {
    const book = sampleBook();
    const result = service.rename(book, 's1a', 'X', NOW);
    const editedSection = (result.mainContent[0] as Chapter).sections![0];
    expect(editedSection.updatedAt).toBe(NOW);
    expect((book.mainContent[0] as Chapter).sections![0].updatedAt).toBe(OLD); // original unmutated
  });
});
