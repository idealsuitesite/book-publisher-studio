import { describe, it, expect } from 'vitest';
import { BookEditingService } from './BookEditingService';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';
import { createBook } from '../models/Book';
import type { Book, Chapter, Paragraph } from '../models/Book';

const now = new Date();
const para = (id: string, text = 'Some paragraph text.'): Paragraph => ({ type: 'paragraph', id, text });
const chapter = (id: string, number: number, title: string): Chapter => ({
  type: 'chapter',
  id,
  number,
  title,
  content: [para(`${id}-p1`)],
  createdAt: now,
  updatedAt: now,
});

let seq = 0;
const service = new BookEditingService(() => `gen-${++seq}`);

const book = (): Book =>
  createBook({ title: 'T', author: 'A', language: 'en' }, [
    chapter('c1', 1, 'One'),
    chapter('c2', 2, 'Two'),
    chapter('c3', 3, 'Three'),
  ]);

describe('insertPartOpener', () => {
  it('inserts a titled, blockless, flagged opener at the index', () => {
    const edited = service.insertPartOpener(book(), 1, 'Part I: Beginnings');
    expect(edited.mainContent).toHaveLength(4);
    const opener = edited.mainContent[1] as Chapter;
    expect(opener.partOpener).toBe(true);
    expect(opener.title).toBe('Part I: Beginnings');
    expect(opener.content).toEqual([]);
  });

  it('numbering stays CONTINUOUS across openers — a divider consumes no chapter number', () => {
    const edited = service.insertPartOpener(book(), 1, 'Part I');
    const numbers = edited.mainContent.filter((c): c is Chapter => c.type === 'chapter' && !c.partOpener).map((c) => c.number);
    expect(numbers).toEqual([1, 2, 3]); // "Chapter 2" did not become "Chapter 3"
    expect((edited.mainContent[1] as Chapter).number).toBe(0); // the opener's number is inert
  });

  it('insert then remove restores the original chapter sequence and numbering (round-trip)', () => {
    const original = book();
    const inserted = service.insertPartOpener(original, 1, 'Part I');
    const openerId = inserted.mainContent[1].id;
    const restored = service.removePartOpener(inserted, openerId);
    expect(restored.mainContent.map((c) => c.id)).toEqual(original.mainContent.map((c) => c.id));
    expect(restored.mainContent.filter((c): c is Chapter => c.type === 'chapter').map((c) => c.number)).toEqual([1, 2, 3]);
  });

  it('rejects an empty title and an out-of-range index', () => {
    expect(() => service.insertPartOpener(book(), 1, '   ')).toThrow(/Part title/);
    expect(() => service.insertPartOpener(book(), 4, 'Part I')).toThrow(ContentNotFoundError);
    expect(() => service.insertPartOpener(book(), -1, 'Part I')).toThrow(ContentNotFoundError);
  });

  it('never mutates its input (ADR-0001)', () => {
    const original = book();
    const before = JSON.stringify(original.mainContent);
    service.insertPartOpener(original, 0, 'Part I');
    expect(JSON.stringify(original.mainContent)).toBe(before);
  });
});

describe('removePartOpener', () => {
  it('refuses to remove a REAL chapter through the opener op', () => {
    expect(() => service.removePartOpener(book(), 'c2')).toThrow(ContentNotFoundError);
  });

  it('chapters after a removed opener keep their numbers (continuous numbering)', () => {
    const inserted = service.insertPartOpener(book(), 0, 'Part I');
    const removed = service.removePartOpener(inserted, inserted.mainContent[0].id);
    expect(removed.mainContent.filter((c): c is Chapter => c.type === 'chapter').map((c) => c.number)).toEqual([1, 2, 3]);
  });
});

describe('interactions with existing ops', () => {
  it('reorderChapters across an opener keeps openers unnumbered and chapters continuous', () => {
    const inserted = service.insertPartOpener(book(), 1, 'Part I'); // [c1, opener, c2, c3]
    const reordered = service.reorderChapters(inserted, 3, 0); // c3 to the front
    const chapters = reordered.mainContent.filter((c): c is Chapter => c.type === 'chapter' && !c.partOpener);
    expect(chapters.map((c) => c.id)).toEqual(['c3', 'c1', 'c2']);
    expect(chapters.map((c) => c.number)).toEqual([1, 2, 3]);
    const opener = reordered.mainContent.find((c): c is Chapter => c.type === 'chapter' && c.partOpener === true);
    expect(opener?.number).toBe(0);
  });

  it('a chapter directly after an opener cannot merge into it — the divider is protected', () => {
    const inserted = service.insertPartOpener(book(), 1, 'Part I'); // [c1, opener, c2, c3]
    expect(() => service.mergeChapterIntoPrevious(inserted, 'c2')).toThrow(/part divider/);
    // The opener is untouched — still blockless.
    expect((inserted.mainContent[1] as Chapter).content).toEqual([]);
  });

  it('rename works on an opener (it is titled content like any other)', () => {
    const inserted = service.insertPartOpener(book(), 0, 'Part I');
    const renamed = service.rename(inserted, inserted.mainContent[0].id, 'Part One: A Better Name');
    expect((renamed.mainContent[0] as Chapter).title).toBe('Part One: A Better Name');
    expect((renamed.mainContent[0] as Chapter).partOpener).toBe(true);
  });
});
