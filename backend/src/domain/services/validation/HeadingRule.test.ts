import { describe, it, expect } from 'vitest';
import { HeadingRule } from './HeadingRule';
import { createBook } from '../../models/Book';
import type { Chapter, Section, Heading, Paragraph, Block } from '../../models/Book';
import type { ValidationContext } from '../../models/ValidationContext';

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, id: string, text = `Heading ${level}`): Heading {
  return { type: 'heading', id, level, text };
}

function paragraph(id = 'p-1'): Paragraph {
  return { type: 'paragraph', id, text: 'Body text.' };
}

function chapter(content: Block[], overrides: Partial<Chapter> = {}): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: 'c-1',
    number: 1,
    title: 'Chapter',
    content,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('HeadingRule', () => {
  const rule = new HeadingRule();

  it('reports no issues for a book with no headings', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([paragraph()])]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('reports no issues for sequential heading levels', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([heading(1, 'h-1'), heading(2, 'h-2'), heading(3, 'h-3')]),
    ]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('does not flag the very first heading regardless of its level', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([heading(3, 'h-1')])]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('does not flag a level decrease', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([heading(3, 'h-1'), heading(1, 'h-2')]),
    ]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('flags a heading level skip (H1 -> H3)', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([heading(1, 'h-1'), heading(3, 'h-2', 'A Subsection')]),
    ]);

    const issues = rule.evaluate({ book });

    expect(issues).toEqual([
      {
        code: 'HEADING_LEVEL_SKIP',
        message: 'Heading level jumps from H1 to H3 ("A Subsection") without an intermediate level',
        location: 'Heading "A Subsection"',
        severity: 'WARNING',
      },
    ]);
  });

  it('flags multiple skips independently', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([heading(1, 'h-1'), heading(4, 'h-2'), heading(2, 'h-3'), heading(5, 'h-4')]),
    ]);

    const issues = rule.evaluate({ book });

    expect(issues.map((i) => i.code)).toEqual(['HEADING_LEVEL_SKIP', 'HEADING_LEVEL_SKIP']);
  });

  it('tracks heading level continuously through nested sections', () => {
    const now = new Date();
    const subsection: Section = {
      type: 'section',
      id: 'sec-2',
      title: 'Sub',
      content: [heading(4, 'h-2')],
      level: 3,
      createdAt: now,
      updatedAt: now,
    };
    const section: Section = {
      type: 'section',
      id: 'sec-1',
      title: 'Sec',
      content: [heading(2, 'h-1')],
      level: 2,
      createdAt: now,
      updatedAt: now,
      subsections: [subsection],
    };
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([], { sections: [section] }),
    ]);

    const issues = rule.evaluate({ book });

    // h-1 is H2 (first heading, not flagged); h-2 is H4 following an H2 -> skip
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('HEADING_LEVEL_SKIP');
  });

  it('does not mutate its input context or book', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([heading(1, 'h-1'), heading(3, 'h-2')]),
    ]);
    const context: ValidationContext = { book };
    const snapshotBefore = structuredClone(context);

    rule.evaluate(context);

    expect(context).toEqual(snapshotBefore);
  });
});
