import { describe, it, expect } from 'vitest';
import { BookValidator } from './BookValidator';
import { createBook } from '../models/Book';
import type { Chapter } from '../models/Book';

function chapter(overrides: Partial<Chapter> = {}): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: 'chapter-1',
    number: 1,
    title: 'Chapter One',
    content: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('BookValidator', () => {
  const validator = new BookValidator();

  it('reports no errors for a well-formed book', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, [chapter()]);
    const result = validator.validate(book);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports a missing title', () => {
    const book = createBook({ title: '', author: 'Jane Doe', language: 'en' }, [chapter()]);
    const result = validator.validate(book);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_TITLE')).toBe(true);
  });

  it('reports a missing author', () => {
    const book = createBook({ title: 'My Book', author: '', language: 'en' }, [chapter()]);
    const result = validator.validate(book);

    expect(result.errors.some((e) => e.code === 'MISSING_AUTHOR')).toBe(true);
  });

  it('reports an empty book', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, []);
    const result = validator.validate(book);

    expect(result.errors.some((e) => e.code === 'EMPTY_BOOK')).toBe(true);
  });

  it('reports a chapter missing a title', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, [
      chapter({ title: '' }),
    ]);
    const result = validator.validate(book);

    expect(result.errors.some((e) => e.code === 'EMPTY_CHAPTER_TITLE')).toBe(true);
  });

  it('reports duplicate chapter numbers', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, [
      chapter({ id: 'c1', number: 1 }),
      chapter({ id: 'c2', number: 1 }),
    ]);
    const result = validator.validate(book);

    expect(result.errors.some((e) => e.code === 'DUPLICATE_CHAPTER_NUMBER')).toBe(true);
  });
});
