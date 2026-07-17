import { describe, it, expect } from 'vitest';
import { HyperlinkRule } from './HyperlinkRule';
import { createBook } from '../../models/Book';
import type { Chapter, Paragraph, List, InlineElement, Block } from '../../models/Book';
import type { ValidationContext } from '../../models/ValidationContext';

function paragraphWithLink(url: string, text = 'link text', id = 'p-1'): Paragraph {
  const inlines: InlineElement[] = [{ type: 'link', text, url }];
  return { type: 'paragraph', id, text, inlines };
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

describe('HyperlinkRule', () => {
  const rule = new HyperlinkRule();

  it('reports no issues for a book with no links', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([{ type: 'paragraph', id: 'p-1', text: 'No links here.' }]),
    ]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it.each([['https://example.com'], ['http://example.com/path?x=1']])(
    'accepts a valid http(s) URL: %s',
    (url) => {
      const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([paragraphWithLink(url)])]);

      expect(rule.evaluate({ book })).toEqual([]);
    }
  );

  it('accepts a valid mailto address', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([paragraphWithLink('mailto:author@example.com')]),
    ]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('accepts a non-empty internal anchor', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([paragraphWithLink('#chapter-2')]),
    ]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('rejects an empty href as an ERROR', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([paragraphWithLink('')])]);

    const issues = rule.evaluate({ book });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'BROKEN_HYPERLINK', severity: 'ERROR' });
  });

  it('rejects a bare anchor with nothing after the #', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([paragraphWithLink('#')])]);

    expect(rule.evaluate({ book })).toHaveLength(1);
  });

  it('rejects a malformed mailto address', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([paragraphWithLink('mailto:not-an-email')]),
    ]);

    expect(rule.evaluate({ book })).toHaveLength(1);
  });

  it('rejects a non-http(s) protocol', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([paragraphWithLink('ftp://example.com/file')]),
    ]);

    expect(rule.evaluate({ book })).toHaveLength(1);
  });

  it('rejects an unparseable URL', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([paragraphWithLink('not a url at all')]),
    ]);

    expect(rule.evaluate({ book })).toHaveLength(1);
  });

  it('detects a broken link inside a list item', () => {
    const list: List = {
      type: 'list',
      id: 'l-1',
      ordered: false,
      items: ['First'],
      inlines: [[{ type: 'link', text: 'First', url: '' }]],
    };
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([list])]);

    expect(rule.evaluate({ book })).toHaveLength(1);
  });

  it('reports the correct location for a broken link', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([paragraphWithLink('', 'broken', 'p-42')], { number: 3 }),
    ]);

    const issues = rule.evaluate({ book });

    expect(issues[0].location).toBe('Chapter 3 > paragraph "p-42"');
    expect(issues[0].message).toContain('broken');
  });

  it('does not mutate its input context or book', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([paragraphWithLink('')])]);
    const context: ValidationContext = { book };
    const snapshotBefore = structuredClone(context);

    rule.evaluate(context);

    expect(context).toEqual(snapshotBefore);
  });
});
