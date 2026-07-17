import { describe, it, expect } from 'vitest';
import { MissingRequiredStyleRule } from './MissingRequiredStyleRule';
import { createBook } from '../../models/Book';
import type { Chapter, Section, Quote, Scripture, Paragraph, Image, Block } from '../../models/Book';
import type { ValidationContext } from '../../models/ValidationContext';

function quote(id = 'q-1'): Quote {
  return { type: 'quote', id, text: 'An epigraph.' };
}

function scripture(id = 's-1'): Scripture {
  return { type: 'scripture', id, text: 'For God so loved the world.' };
}

function paragraph(id = 'p-1'): Paragraph {
  return { type: 'paragraph', id, text: 'Body text.' };
}

function image(id = 'img-1'): Image {
  return { type: 'image', id, url: 'https://example.com/a.png' };
}

function chapter(content: Block[], overrides: Partial<Chapter> = {}): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: overrides.id ?? 'c-1',
    number: overrides.number ?? 1,
    title: 'Chapter',
    content,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('MissingRequiredStyleRule', () => {
  const rule = new MissingRequiredStyleRule();

  it('reports no issue for a chapter with body text', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([paragraph()])]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('flags a chapter containing only quote blocks', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([quote()], { title: 'Prologue' }),
    ]);

    const issues = rule.evaluate({ book });

    expect(issues).toEqual([
      {
        code: 'CHAPTER_MISSING_BODY_TEXT',
        message: 'Chapter "Prologue" contains only quote/scripture blocks and no body text',
        location: 'Chapter 1',
        severity: 'INFO',
      },
    ]);
  });

  it('flags a chapter containing only scripture blocks', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([scripture()])]);

    expect(rule.evaluate({ book }).map((i) => i.code)).toEqual(['CHAPTER_MISSING_BODY_TEXT']);
  });

  it('does not flag a chapter mixing quote and paragraph blocks', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([quote(), paragraph()])]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('does not flag an empty chapter', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([])]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('does not flag a chapter with no quote/scripture blocks at all', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([image()])]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('flags only the chapter that matches, among several', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([quote()], { id: 'c-1', number: 1, title: 'Epigraph Chapter' }),
      chapter([paragraph()], { id: 'c-2', number: 2, title: 'Normal Chapter' }),
    ]);

    const issues = rule.evaluate({ book });

    expect(issues).toHaveLength(1);
    expect(issues[0].location).toBe('Chapter 1');
  });

  it('counts a paragraph in a nested subsection as body text for the whole chapter', () => {
    const now = new Date();
    const section: Section = {
      type: 'section',
      id: 'sec-1',
      title: 'Section',
      content: [paragraph()],
      level: 2,
      createdAt: now,
      updatedAt: now,
    };
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([quote()], { sections: [section] }),
    ]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('flags a chapter whose only quote lives in a nested subsection with no paragraph anywhere', () => {
    const now = new Date();
    const section: Section = {
      type: 'section',
      id: 'sec-1',
      title: 'Section',
      content: [quote()],
      level: 2,
      createdAt: now,
      updatedAt: now,
    };
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([], { sections: [section] })]);

    expect(rule.evaluate({ book }).map((i) => i.code)).toEqual(['CHAPTER_MISSING_BODY_TEXT']);
  });

  it('does not mutate its input context or book', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([quote()])]);
    const context: ValidationContext = { book };
    const snapshotBefore = structuredClone(context);

    rule.evaluate(context);

    expect(context).toEqual(snapshotBefore);
  });
});
