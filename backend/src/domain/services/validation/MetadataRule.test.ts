import { describe, it, expect } from 'vitest';
import { MetadataRule } from './MetadataRule';
import { createBook } from '../../models/Book';
import type { BookMetadata, Image } from '../../models/Book';
import type { ValidationContext } from '../../models/ValidationContext';

const cover: Image = { type: 'image', id: 'cover-1', url: 'https://example.com/cover.png' };

function completeMetadata(overrides: Partial<BookMetadata> = {}): BookMetadata {
  return {
    title: 'My Book',
    author: 'Jane Doe',
    language: 'en',
    isbn: '978-3-16-148410-0',
    description: 'A book about testing.',
    coverImage: cover,
    ...overrides,
  };
}

describe('MetadataRule', () => {
  const rule = new MetadataRule();

  it('reports no issues when ISBN, language, description, and cover are all set', () => {
    const book = createBook(completeMetadata(), []);

    const issues = rule.evaluate({ book });

    expect(issues).toHaveLength(0);
  });

  it('reports a missing ISBN as a WARNING', () => {
    const book = createBook(completeMetadata({ isbn: undefined }), []);

    const issues = rule.evaluate({ book });

    expect(issues).toEqual([
      { code: 'MISSING_ISBN', message: 'Book ISBN is not set', location: 'metadata', severity: 'WARNING' },
    ]);
  });

  it('reports a blank ISBN the same as a missing one', () => {
    const book = createBook(completeMetadata({ isbn: '   ' }), []);

    const issues = rule.evaluate({ book });

    expect(issues.some((i) => i.code === 'MISSING_ISBN')).toBe(true);
  });

  it('reports a missing language', () => {
    const book = createBook(completeMetadata({ language: '' }), []);

    const issues = rule.evaluate({ book });

    expect(issues.some((i) => i.code === 'MISSING_LANGUAGE')).toBe(true);
  });

  it('reports a missing description', () => {
    const book = createBook(completeMetadata({ description: undefined }), []);

    const issues = rule.evaluate({ book });

    expect(issues.some((i) => i.code === 'MISSING_DESCRIPTION')).toBe(true);
  });

  it('reports a missing cover image', () => {
    const book = createBook(completeMetadata({ coverImage: undefined }), []);

    const issues = rule.evaluate({ book });

    expect(issues.some((i) => i.code === 'MISSING_COVER_IMAGE')).toBe(true);
  });

  it('reports all four issues when every field is missing', () => {
    const book = createBook(
      { title: 'My Book', author: 'Jane Doe', language: '' },
      []
    );

    const issues = rule.evaluate({ book });

    expect(issues.map((i) => i.code).sort()).toEqual([
      'MISSING_COVER_IMAGE',
      'MISSING_DESCRIPTION',
      'MISSING_ISBN',
      'MISSING_LANGUAGE',
    ]);
  });

  it('does not mutate its input context or book', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: '' }, []);
    const context: ValidationContext = { book };
    const snapshotBefore = structuredClone(context);

    rule.evaluate(context);

    expect(context).toEqual(snapshotBefore);
  });
});
