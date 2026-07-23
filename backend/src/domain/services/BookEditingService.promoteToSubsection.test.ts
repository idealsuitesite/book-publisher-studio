import { describe, it, expect } from 'vitest';
import { createBook, type Book, type Chapter, type Section, type Paragraph } from '../models/Book';
import { BookEditingService } from './BookEditingService';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';

const NOW = new Date('2026-07-23T12:00:00Z');
const OLD = new Date('2020-01-01T00:00:00Z');
const para = (id: string, text: string): Paragraph => ({ type: 'paragraph', id, text });

// A chapter whose own body ends with a "Conclusion" marker + its prose (book 3's shape, pre-B5).
function chapterWithConclusion(id: string): Chapter {
  return {
    type: 'chapter', id, number: 1, title: 'Chapter One',
    content: [para(`${id}-a`, 'The chapter body prose.'), para(`${id}-c`, 'Conclusion'), para(`${id}-cp`, 'The concluding thoughts of the chapter.')],
    createdAt: OLD, updatedAt: OLD,
  };
}
const service = new BookEditingService(() => 'sec-id');
// Counts ALL text — titles AND body — so "nothing lost" holds exactly: a marker whose text becomes
// a section title has moved, not vanished (the promoteToChapter precedent, where a promoted block's
// text becomes a chapter title too).
const wordCount = (book: Book): number => {
  const w = (t?: string) => (t ? t.trim().split(/\s+/).filter(Boolean).length : 0);
  let n = 0;
  const walk = (c: { title?: string; content?: { text?: string }[]; sections?: Section[]; subsections?: Section[] }) => {
    n += w(c.title);
    for (const b of c.content ?? []) n += w(b.text);
    for (const s of c.sections ?? []) walk(s);
    for (const s of c.subsections ?? []) walk(s);
  };
  (book.mainContent as Chapter[]).forEach((c) => walk(c));
  return n;
};

describe('BookEditingService.promoteToSubsection — the founder\'s continuity (B5)', () => {
  it('migrates the following prose into a new section; NOTHING is lost (the .sections lesson)', () => {
    const book: Book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapterWithConclusion('c1')]);
    const wordsBefore = wordCount(book); // title + body + marker + conclusion prose, all text

    const result = service.promoteToSubsection(book, 'c1-c', NOW);

    const chapter = result.mainContent[0] as Chapter;
    expect(result.mainContent).toHaveLength(1);            // chapter count unchanged (no new peer chapter)
    expect(chapter.content.map((b) => (b as Paragraph).text)).toEqual(['The chapter body prose.']); // before-blocks stay
    expect(chapter.sections).toHaveLength(1);
    const section = chapter.sections![0];
    expect(section.title).toBe('Conclusion');              // the marker's text became the section title
    expect(section.level).toBe(2);
    expect(section.content.map((b) => (b as Paragraph).text)).toEqual(['The concluding thoughts of the chapter.']); // following prose migrated in
    // NOTHING LOST: the total word count is preserved (marker text lives on as the section title).
    expect(wordCount(result)).toBe(wordsBefore);
    // Immutability (ADR-0001): the original is untouched.
    expect((book.mainContent[0] as Chapter).sections).toBeUndefined();
  });

  it('appends to a chapter that already has sections (order preserved)', () => {
    const existing: Section = { type: 'section', id: 's0', title: 'Existing', content: [para('s0p', 'x')], level: 2, createdAt: OLD, updatedAt: OLD };
    const ch: Chapter = { ...chapterWithConclusion('c1'), sections: [existing] };
    const result = service.promoteToSubsection(createBook({ title: 'T', author: 'A', language: 'en' }, [ch]), 'c1-c', NOW);
    const sections = (result.mainContent[0] as Chapter).sections!;
    expect(sections.map((s) => s.title)).toEqual(['Existing', 'Conclusion']);
  });
});

describe('BookEditingService.promoteToSubsection — the typed guard (D1, both directions)', () => {
  it('accepts a text block inside a top-level chapter', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapterWithConclusion('c1')]);
    expect(() => service.promoteToSubsection(book, 'c1-c', NOW)).not.toThrow();
  });
  it('refuses an unknown block id', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapterWithConclusion('c1')]);
    expect(() => service.promoteToSubsection(book, 'ghost', NOW)).toThrow(ContentNotFoundError);
  });
  it('refuses a block that is NOT inside a top-level chapter (a top-level Section / preamble)', () => {
    const preamble: Section = { type: 'section', id: 's', title: '', content: [para('sp', 'Preamble prose.')], level: 0, createdAt: OLD, updatedAt: OLD };
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [preamble]);
    expect(() => service.promoteToSubsection(book, 'sp', NOW)).toThrow(ContentNotFoundError); // block is in a Section, not a chapter
  });
  it('refuses a block that is inside a chapter\'s SECTION, not its own body', () => {
    const nested: Section = { type: 'section', id: 's1', title: 'S', content: [para('np', 'Nested prose.')], level: 2, createdAt: OLD, updatedAt: OLD };
    const ch: Chapter = { type: 'chapter', id: 'c1', number: 1, title: 'C', content: [], sections: [nested], createdAt: OLD, updatedAt: OLD };
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [ch]);
    expect(() => service.promoteToSubsection(book, 'np', NOW)).toThrow(ContentNotFoundError); // only a chapter's OWN body is promotable
  });
});
