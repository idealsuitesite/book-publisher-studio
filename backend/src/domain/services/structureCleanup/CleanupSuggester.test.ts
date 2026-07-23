import { describe, it, expect } from 'vitest';
import { createBook, type Book, type Chapter, type Section, type Paragraph } from '../../models/Book';
import { CleanupSuggester } from './CleanupSuggester';

const OLD = new Date('2020-01-01T00:00:00Z');
const para = (id: string, text: string): Paragraph => ({ type: 'paragraph', id, text });

function marker(id: string, title: string): Chapter {
  return { type: 'chapter', id, number: 0, title, content: [], createdAt: OLD, updatedAt: OLD };
}
function chapterWithSection(id: string, title: string): Chapter {
  const sec: Section = { type: 'section', id: `${id}-s`, title: 's', content: [para(`${id}-p`, 'Prose lives under a Heading 2 section here.')], level: 2, createdAt: OLD, updatedAt: OLD };
  return { type: 'chapter', id, number: 0, title, content: [], sections: [sec], createdAt: OLD, updatedAt: OLD };
}
function chapterWithBody(id: string, title: string): Chapter {
  return { type: 'chapter', id, number: 0, title, content: [para(`${id}-p`, 'Body prose.')], createdAt: OLD, updatedAt: OLD };
}

const suggester = new CleanupSuggester();

/** The OVER-structured synthetic pole: empty markers (numbered + editorial) each before a real title. */
function overStructured(): Book {
  return createBook({ title: 'T', author: 'A', language: 'en' }, [
    marker('m0', 'INTRODUCTION'),
    chapterWithSection('f0', 'The Beginning Of Wisdom'),
    marker('m1', 'CHAPTER 1'),
    chapterWithSection('f1', 'The Holiness Of God'),
    marker('m2', 'CHAPTER 2'),
    chapterWithBody('f2', 'The First Sacrifice'),
  ]);
}

/** The UNDER-structured synthetic pole: no empty markers — a title that is not a marker (assist's job). */
function underStructured(): Book {
  return createBook({ title: 'T', author: 'A', language: 'en' }, [chapterWithBody('c0', 'An ordinary chapter title')]);
}

describe('CleanupSuggester — the OVER-structured pole PROPOSES', () => {
  it('one collapse per empty marker, each paired with its OWN following real title', () => {
    const s = suggester.suggest(overStructured());
    expect(s.map((x) => x.markerText)).toEqual(['INTRODUCTION', 'CHAPTER 1', 'CHAPTER 2']);
    expect(s.map((x) => x.targetTitle)).toEqual(['The Beginning Of Wisdom', 'The Holiness Of God', 'The First Sacrifice']);
    expect(s.map((x) => x.kind)).toEqual(['editorial', 'numbered', 'numbered']);
    // The editorial marker carries the canonical label the follower will inherit.
    expect(s[0].canonicalLabel).toBe('Introduction');
    expect(s[1].canonicalLabel).toBeUndefined();
  });
});

describe('CleanupSuggester — the UNDER-structured pole is SILENT (bidirectional §3)', () => {
  it('a book with no empty markers yields no suggestions', () => {
    expect(suggester.suggest(underStructured())).toEqual([]);
  });
  it('a section-bearing real title (pattern B) is NOT proposed — legitimate structure, never a marker', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapterWithSection('c', 'The Holiness Of God')]);
    expect(suggester.suggest(book)).toEqual([]);
  });
});

describe('CleanupSuggester — the invariant: byte-identical after a discarded proposal (both poles)', () => {
  it('running suggest never mutates the Book — over-structured', () => {
    const book = overStructured();
    const before = structuredClone(book);
    suggester.suggest(book);
    expect(book).toEqual(before);
  });
  it('running suggest never mutates the Book — under-structured', () => {
    const book = underStructured();
    const before = structuredClone(book);
    suggester.suggest(book);
    expect(book).toEqual(before);
  });
});

describe('CleanupSuggester — robustness to repeats (D4, the real duplicate CHAPTER 3)', () => {
  it('two CHAPTER 3 markers sharing a following title each pair with their OWN follower, no crash', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      marker('m1', 'CHAPTER 3'),
      chapterWithSection('fa', 'The Passover In Egypt'),
      marker('m2', 'CHAPTER 3'),
      chapterWithSection('fb', 'The Passover In Egypt'),
    ]);
    const s = suggester.suggest(book);
    expect(s).toHaveLength(2);
    expect(s[0].markerId).toBe('m1');
    expect(s[0].targetChapterId).toBe('fa');
    expect(s[1].markerId).toBe('m2');
    expect(s[1].targetChapterId).toBe('fb'); // never mis-paired to the other title
  });
  it('adjacent markers: the first (followed by a marker) is NOT proposed, only the second', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      marker('m1', 'CHAPTER 1'),
      marker('m2', 'CHAPTER 2'),
      chapterWithBody('f', 'Real Title'),
    ]);
    const s = suggester.suggest(book);
    expect(s.map((x) => x.markerId)).toEqual(['m2']);
  });
});
