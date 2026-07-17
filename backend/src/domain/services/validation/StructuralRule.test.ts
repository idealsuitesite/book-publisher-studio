import { describe, it, expect } from 'vitest';
import { StructuralRule } from './StructuralRule';
import { createBook } from '../../models/Book';
import type { Chapter } from '../../models/Book';
import type { ValidationContext } from '../../models/ValidationContext';

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

describe('StructuralRule', () => {
  const rule = new StructuralRule();

  // Same cases BookValidator.test.ts already covers - migrated, not
  // reimplemented, per "migration before evolution" (Sprint 5 commit 3).
  it('reports no issues for a well-formed book', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, [chapter()]);

    const issues = rule.evaluate({ book });

    expect(issues).toHaveLength(0);
  });

  it('reports a missing title as an ERROR', () => {
    const book = createBook({ title: '', author: 'Jane Doe', language: 'en' }, [chapter()]);

    const issues = rule.evaluate({ book });

    const issue = issues.find((i) => i.code === 'MISSING_TITLE');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('ERROR');
  });

  it('reports a missing author', () => {
    const book = createBook({ title: 'My Book', author: '', language: 'en' }, [chapter()]);

    const issues = rule.evaluate({ book });

    expect(issues.some((i) => i.code === 'MISSING_AUTHOR')).toBe(true);
  });

  it('reports an empty book', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, []);

    const issues = rule.evaluate({ book });

    expect(issues.some((i) => i.code === 'EMPTY_BOOK')).toBe(true);
  });

  it('reports a chapter missing a title', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, [chapter({ title: '' })]);

    const issues = rule.evaluate({ book });

    expect(issues.some((i) => i.code === 'EMPTY_CHAPTER_TITLE')).toBe(true);
  });

  it('reports duplicate chapter numbers', () => {
    const book = createBook({ title: 'My Book', author: 'Jane Doe', language: 'en' }, [
      chapter({ id: 'c1', number: 1 }),
      chapter({ id: 'c2', number: 1 }),
    ]);

    const issues = rule.evaluate({ book });

    expect(issues.some((i) => i.code === 'DUPLICATE_CHAPTER_NUMBER')).toBe(true);
  });

  // ADR-0027 (Validation Engine Is Read-Only) enforcement - the pattern every
  // future rule's test suite follows (VALIDATION_ENGINE.md §9).
  it('does not mutate its input context or book', () => {
    const book = createBook({ title: '', author: '', language: 'en' }, [
      chapter({ id: 'c1', number: 1 }),
      chapter({ id: 'c2', number: 1 }),
    ]);
    const context: ValidationContext = { book };
    // structuredClone (not JSON round-trip) so Date fields survive as Date
    // objects, not strings - a JSON-based snapshot would report a false
    // mutation on every Date field even when nothing actually changed.
    const snapshotBefore = structuredClone(context);

    rule.evaluate(context);

    expect(context).toEqual(snapshotBefore);
  });
});
