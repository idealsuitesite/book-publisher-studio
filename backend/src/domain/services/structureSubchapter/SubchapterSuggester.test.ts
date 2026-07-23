import { describe, it, expect } from 'vitest';
import { createBook, type Book, type Chapter, type Paragraph } from '../../models/Book';
import { SubchapterSuggester } from './SubchapterSuggester';
import { StructureSuggester } from '../structureAssist/StructureSuggester';

const OLD = new Date('2020-01-01T00:00:00Z');
const para = (id: string, text: string): Paragraph => ({ type: 'paragraph', id, text });
function chapter(id: string, number: number, title: string, content: Paragraph[]): Chapter {
  return { type: 'chapter', id, number, title, content, createdAt: OLD, updatedAt: OLD };
}

// Book-3 shape: several chapters, each ending with a "Conclusion" sub-heading typed as body text.
function recurringConclusionBook(): Book {
  return createBook({ title: 'T', author: 'A', language: 'en' }, [
    chapter('c1', 1, 'Chapter One', [para('c1-a', 'Body one.'), para('c1-c', 'Conclusion'), para('c1-cp', 'Closing one.')]),
    chapter('c2', 2, 'Chapter Two', [para('c2-a', 'Body two.'), para('c2-c', 'Conclusion'), para('c2-cp', 'Closing two.')]),
    chapter('c3', 3, 'Chapter Three', [para('c3-a', 'Body three.'), para('c3-c', 'Conclusion'), para('c3-cp', 'Closing three.')]),
  ]);
}

const suggester = new SubchapterSuggester();

describe('SubchapterSuggester — the OVER-with-recurring-subheadings pole PROPOSES (B5)', () => {
  it('proposes each recurring "Conclusion" as a section of its own chapter', () => {
    const s = suggester.suggest(recurringConclusionBook());
    expect(s).toHaveLength(3);
    expect(s.map((x) => x.chapterId)).toEqual(['c1', 'c2', 'c3']); // each paired with its OWN chapter
    expect(s.every((x) => x.proposedTitle === 'Conclusion' && x.key === 'conclusion')).toBe(true);
    expect(s[0].blockId).toBe('c1-c');
  });
});

describe('SubchapterSuggester — silent when there is no recurring editorial sub-heading', () => {
  it('a single Conclusion (unique) is NOT proposed — it is not a recurring pattern', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter('c1', 1, 'One', [para('p1', 'Body.'), para('p2', 'Conclusion'), para('p3', 'The end.')]),
    ]);
    expect(suggester.suggest(book)).toEqual([]);
  });
  it('ordinary chapters with no editorial markers → silent', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter('c1', 1, 'One', [para('p', 'Just prose.')])]);
    expect(suggester.suggest(book)).toEqual([]);
  });
});

describe('SubchapterSuggester — the invariant: byte-identical after a discarded proposal (both poles)', () => {
  it('running suggest never mutates the Book — recurring-subheadings pole', () => {
    const book = recurringConclusionBook();
    const before = structuredClone(book);
    suggester.suggest(book);
    expect(book).toEqual(before);
  });
  it('running suggest never mutates the Book — silent pole', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter('c1', 1, 'One', [para('p', 'Prose.')])]);
    const before = structuredClone(book);
    suggester.suggest(book);
    expect(book).toEqual(before);
  });
});

describe('D3 — ONE source of truth: A2 SUPPRESSES the same key B5 PROPOSES, never one without the other', () => {
  it('a REPEATED editorial name: the assist drops it as a chapter AND B5 proposes it as a sub-section', () => {
    // The same recurring "Conclusion" in two shapes: flat body (the assist's pole) and in-chapter (B5's).
    const flat = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter('c0', 1, 'Body', [para('p1', 'CHAPTER 1'), para('p2', 'x'), para('p3', 'Conclusion'), para('p4', 'y'), para('p5', 'CHAPTER 2'), para('p6', 'z'), para('p7', 'Conclusion')]),
    ]);
    const assist = new StructureSuggester().suggest(flat);
    const assistProposesConclusion = assist.some((s) => s.key === 'conclusion');
    const b5 = suggester.suggest(recurringConclusionBook());
    const b5ProposesConclusion = b5.some((s) => s.key === 'conclusion');

    expect(assistProposesConclusion).toBe(false); // A2 SUPPRESSES the repeated name as a chapter
    expect(b5ProposesConclusion).toBe(true);      // B5 MAKES it a sub-section — never one without the other
  });

  it('a UNIQUE editorial name: the assist KEEPS it as a chapter AND B5 does NOT propose it', () => {
    const flat = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter('c0', 1, 'Body', [para('p1', 'Conclusion'), para('p2', 'y')]),
    ]);
    const assistKeeps = new StructureSuggester().suggest(flat).some((s) => s.key === 'conclusion');
    const b5 = suggester.suggest(createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter('c1', 1, 'One', [para('p', 'Body.'), para('pc', 'Conclusion'), para('pp', 'End.')]),
    ]));
    expect(assistKeeps).toBe(true);       // unique → proposed as a chapter
    expect(b5).toEqual([]);               // unique → NOT proposed as a sub-section
  });
});
