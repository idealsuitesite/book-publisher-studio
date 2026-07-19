import { describe, it, expect } from 'vitest';
import { BookValidator, UNSTRUCTURED_WORD_THRESHOLD } from './BookValidator';
import { createBook } from '../models/Book';
import type { Chapter, Section } from '../models/Book';

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

  // ADR-0049: a book-length manuscript with zero detected chapters is a nameable defect,
  // not a normal-looking book (IMPORT_FIDELITY.md, reproduced on a real unstyled DOCX).
  describe('UNSTRUCTURED_MANUSCRIPT (ADR-0049)', () => {
    function anonymousSection(words: number): Section {
      const now = new Date();
      return {
        type: 'section',
        id: 'section-1',
        level: 0,
        title: '',
        content: [{ type: 'paragraph', id: 'p-1', text: 'word '.repeat(words).trim() }],
        createdAt: now,
        updatedAt: now,
      };
    }

    it('reports a chapterless manuscript above the word threshold', () => {
      const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, [
        anonymousSection(UNSTRUCTURED_WORD_THRESHOLD + 500),
      ]);
      const result = validator.validate(book);

      const issue = result.errors.find((e) => e.code === 'UNSTRUCTURED_MANUSCRIPT');
      expect(issue).toBeDefined();
      expect(issue?.suggestion).toContain('Heading 1');
    });

    it('stays silent for a short chapterless document - a single-flow report is legitimate', () => {
      const book = createBook({ title: 'My Report', author: 'Jane Doe', language: 'en' }, [
        anonymousSection(300),
      ]);
      const result = validator.validate(book);

      expect(result.errors.some((e) => e.code === 'UNSTRUCTURED_MANUSCRIPT')).toBe(false);
    });

    it('stays silent when chapters exist, whatever the length', () => {
      const big = chapter({
        content: [{ type: 'paragraph', id: 'p-1', text: 'word '.repeat(5000).trim() }],
      });
      const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, [big]);
      const result = validator.validate(book);

      expect(result.errors.some((e) => e.code === 'UNSTRUCTURED_MANUSCRIPT')).toBe(false);
    });
  });
});
