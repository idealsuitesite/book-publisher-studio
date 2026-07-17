import { describe, it, expect } from 'vitest';
import { ImageRule } from './ImageRule';
import { createBook } from '../../models/Book';
import type { Chapter, Section, Image, Block } from '../../models/Book';
import type { ValidationContext } from '../../models/ValidationContext';

function image(id: string, dpi?: number): Image {
  return { type: 'image', id, url: 'https://example.com/a.png', dpi };
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

describe('ImageRule', () => {
  const rule = new ImageRule();

  it('reports no issues for a book with no images', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([])]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('does not flag an image with no dpi set', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([image('img-1')])]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('does not flag an image at or above 300 dpi', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([image('img-1', 300)])]);

    expect(rule.evaluate({ book })).toEqual([]);
  });

  it('flags an image below 300 dpi as a WARNING', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([image('img-1', 72)])]);

    const issues = rule.evaluate({ book });

    expect(issues).toEqual([
      {
        code: 'LOW_RESOLUTION_IMAGE',
        message: 'Image resolution is 72 DPI, below the 300 DPI print-quality threshold',
        location: 'Image "img-1"',
        severity: 'WARNING',
      },
    ]);
  });

  it('flags a low-resolution cover image', () => {
    const book = createBook(
      { title: 'T', author: 'A', language: 'en', coverImage: image('cover', 96) },
      []
    );

    const issues = rule.evaluate({ book });

    expect(issues).toEqual([
      {
        code: 'LOW_RESOLUTION_IMAGE',
        message: 'Image resolution is 96 DPI, below the 300 DPI print-quality threshold',
        location: 'metadata.coverImage',
        severity: 'WARNING',
      },
    ]);
  });

  it('detects a low-resolution image inside a nested subsection', () => {
    const now = new Date();
    const section: Section = {
      type: 'section',
      id: 'sec-1',
      title: 'Section',
      content: [image('img-nested', 72)],
      level: 2,
      createdAt: now,
      updatedAt: now,
    };
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([], { sections: [section] })]);

    const issues = rule.evaluate({ book });

    expect(issues.map((i) => i.location)).toEqual(['Image "img-nested"']);
  });

  it('flags only the low-resolution images among several', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([image('good', 300), image('bad', 72), image('unset')]),
    ]);

    const issues = rule.evaluate({ book });

    expect(issues.map((i) => i.location)).toEqual(['Image "bad"']);
  });

  it('does not mutate its input context or book', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([image('img-1', 72)])]);
    const context: ValidationContext = { book };
    const snapshotBefore = structuredClone(context);

    rule.evaluate(context);

    expect(context).toEqual(snapshotBefore);
  });
});
