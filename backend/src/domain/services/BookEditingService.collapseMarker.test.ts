import { describe, it, expect } from 'vitest';
import { createBook, type Book, type Chapter, type Section, type Paragraph } from '../models/Book';
import { BookEditingService } from './BookEditingService';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';

const NOW = new Date('2026-07-23T12:00:00Z');
const OLD = new Date('2020-01-01T00:00:00Z');

const para = (id: string, text: string): Paragraph => ({ type: 'paragraph', id, text });

/** An empty MARKER heading: a marker title, 0 content blocks, 0 sections (the founder's `CHAPTER n`). */
function marker(id: string, title: string): Chapter {
  return { type: 'chapter', id, number: 0, title, content: [], createdAt: OLD, updatedAt: OLD };
}
/** A real chapter whose prose lives under a Heading-2 section (pattern B — the usual collapse target). */
function chapterWithSection(id: string, title: string, sectionText: string): Chapter {
  const sec: Section = { type: 'section', id: `${id}-s`, title: 'A section', content: [para(`${id}-p`, sectionText)], level: 2, createdAt: OLD, updatedAt: OLD };
  return { type: 'chapter', id, number: 0, title, content: [], sections: [sec], createdAt: OLD, updatedAt: OLD };
}
/** A real chapter whose prose is its own body (the CONCLUSION follower's shape). */
function chapterWithBody(id: string, title: string, bodyText: string): Chapter {
  return { type: 'chapter', id, number: 0, title, content: [para(`${id}-p`, bodyText)], createdAt: OLD, updatedAt: OLD };
}

const service = new BookEditingService(() => 'gen-id');

describe('BookEditingService.collapseMarker — A1 numbered marker (remove, follower auto-numbers)', () => {
  it('removes the empty CHAPTER n marker; the follower flows up and renumbers, sections untouched', () => {
    const follower = chapterWithSection('f1', 'The Holiness Of God', 'The holiness of God is the ground of everything.');
    const book: Book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapterWithBody('c0', 'Opening', 'An opening paragraph.'),
      marker('m1', 'CHAPTER 1'),
      follower,
    ]);
    const originalSections = structuredClone(follower.sections);

    const result = service.collapseMarker(book, 'm1', NOW);

    expect(result.mainContent.map((c) => c.title)).toEqual(['Opening', 'The Holiness Of God']);
    expect((result.mainContent[1] as Chapter).number).toBe(2); // auto-numbered by position
    // SECTION SURVIVAL (condition 1, the anti-Constat-3 guard): the follower's sections are byte-identical.
    expect((result.mainContent[1] as Chapter).sections).toEqual(originalSections);
    // The marker's redundant title is gone; no "CHAPTER 1" paragraph was poured anywhere.
    expect(JSON.stringify(result.mainContent)).not.toContain('CHAPTER 1');
    // Immutability (ADR-0001): the original is untouched.
    expect(book.mainContent.map((c) => c.title)).toEqual(['Opening', 'CHAPTER 1', 'The Holiness Of God']);
  });
});

describe('BookEditingService.collapseMarker — A2 editorial marker (rename + subtitle variant, CTO D3)', () => {
  it('the follower inherits the canonical title AND keeps its descriptive title as the subtitle; sections survive', () => {
    const follower = chapterWithSection('f1', 'JESUS CHRIST, OUR PASSOVER', 'Jesus Christ is our passover, sacrificed for us.');
    const originalSections = structuredClone(follower.sections);
    const book: Book = createBook({ title: 'T', author: 'A', language: 'en' }, [marker('m1', 'INTRODUCTION'), follower]);

    const result = service.collapseMarker(book, 'm1', NOW);

    expect(result.mainContent).toHaveLength(1);
    const merged = result.mainContent[0] as Chapter;
    expect(merged.title).toBe('Introduction');              // canonical label — the title-based machinery recognises it
    expect(merged.subtitle).toBe('JESUS CHRIST, OUR PASSOVER'); // the authored title survives (ADR-0050, no title destroyed)
    expect(merged.number).toBe(1);
    expect(merged.sections).toEqual(originalSections);      // SECTION SURVIVAL for A2 too
  });

  it('CONCLUSION follower with its prose in its own body: subtitle set, body preserved', () => {
    const follower = chapterWithBody('f1', 'JESUS CHRIST, OUR PASSOVER, OUR REDEMPTION', 'The conclusion of the whole matter.');
    const book: Book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapterWithBody('c0', 'A chapter', 'body'),
      marker('m1', 'CONCLUSION'),
      follower,
    ]);
    const result = service.collapseMarker(book, 'm1', NOW);
    const merged = result.mainContent[1] as Chapter;
    expect(merged.title).toBe('Conclusion');
    expect(merged.subtitle).toBe('JESUS CHRIST, OUR PASSOVER, OUR REDEMPTION');
    expect(merged.content).toEqual(follower.content); // the body prose is untouched
  });

  it('never overwrites an existing subtitle', () => {
    const follower: Chapter = { ...chapterWithBody('f1', 'Real Title', 'x'), subtitle: 'Existing subtitle' };
    const book: Book = createBook({ title: 'T', author: 'A', language: 'en' }, [marker('m1', 'INTRODUCTION'), follower]);
    const merged = service.collapseMarker(book, 'm1', NOW).mainContent[0] as Chapter;
    expect(merged.subtitle).toBe('Existing subtitle');
  });
});

describe('BookEditingService.collapseMarker — the STRICT typed guard (D2, both directions)', () => {
  const followed = (m: Chapter): Book =>
    createBook({ title: 'T', author: 'A', language: 'en' }, [m, chapterWithBody('f1', 'Real Title', 'prose')]);

  it('refuses a marker that has content blocks', () => {
    const m: Chapter = { ...marker('m1', 'CHAPTER 1'), content: [para('p', 'not actually empty')] };
    expect(() => service.collapseMarker(followed(m), 'm1', NOW)).toThrow(ContentNotFoundError);
  });
  it('refuses a marker that has sections', () => {
    const m: Chapter = { ...marker('m1', 'CHAPTER 1'), sections: [{ type: 'section', id: 's', title: 's', content: [], level: 2, createdAt: OLD, updatedAt: OLD }] };
    expect(() => service.collapseMarker(followed(m), 'm1', NOW)).toThrow(ContentNotFoundError);
  });
  it('refuses an entry whose title is not a recognised marker', () => {
    expect(() => service.collapseMarker(followed(marker('m1', 'A Perfectly Normal Title')), 'm1', NOW)).toThrow(ContentNotFoundError);
  });
  it('refuses when no real title follows (marker is last)', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapterWithBody('c0', 'x', 'y'), marker('m1', 'CHAPTER 1')]);
    expect(() => service.collapseMarker(book, 'm1', NOW)).toThrow(ContentNotFoundError);
  });
  it('refuses when the following entry is itself a marker (never mis-pairs)', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [marker('m1', 'CHAPTER 1'), marker('m2', 'CHAPTER 2'), chapterWithBody('f', 'Real', 'p')]);
    expect(() => service.collapseMarker(book, 'm1', NOW)).toThrow(ContentNotFoundError); // m1's follower is a marker
    expect(() => service.collapseMarker(book, 'm2', NOW)).not.toThrow();                 // m2's follower is real
  });
  it('refuses a part divider (use removePartOpener)', () => {
    const opener: Chapter = { ...marker('m1', 'CHAPTER 1'), partOpener: true };
    expect(() => service.collapseMarker(followed(opener), 'm1', NOW)).toThrow(ContentNotFoundError);
  });
  it('refuses an unknown id', () => {
    expect(() => service.collapseMarker(followed(marker('m1', 'CHAPTER 1')), 'nope', NOW)).toThrow(ContentNotFoundError);
  });
});

describe('BookEditingService.collapseMarker — removePartOpener still works (shared mechanism intact)', () => {
  it('removing a divider flows the followers up and renumbers (unchanged behaviour)', () => {
    const opener: Chapter = { ...marker('op', 'Part I'), partOpener: true };
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [opener, chapterWithBody('c1', 'One', 'a'), chapterWithBody('c2', 'Two', 'b')]);
    const result = service.removePartOpener(book, 'op', NOW);
    expect(result.mainContent.map((c) => c.title)).toEqual(['One', 'Two']);
    expect((result.mainContent[0] as Chapter).number).toBe(1);
  });
});
