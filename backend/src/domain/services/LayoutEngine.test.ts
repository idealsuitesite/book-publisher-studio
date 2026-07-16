import { describe, it, expect } from 'vitest';
import { LayoutEngine } from './LayoutEngine';
import { ThemeEngine } from './ThemeEngine';
import { ClassicTheme } from '../themes/ClassicTheme';
import { createBook } from '../models/Book';
import type { Chapter, Heading, Paragraph, Image } from '../models/Book';
import type { PageLayout } from '../models/PageLayout';

const LETTER_LAYOUT: PageLayout = {
  pageSize: 'letter',
  width: 612,
  height: 792,
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
};

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, id: string, text = 'A Heading'): Heading {
  return { type: 'heading', id, level, text };
}

function paragraph(id: string, text = 'Some body text.'): Paragraph {
  return { type: 'paragraph', id, text };
}

function image(id: string, height?: number): Image {
  return { type: 'image', id, url: 'https://example.com/a.png', height };
}

function chapter(content: (Heading | Paragraph | Image)[], overrides: Partial<Chapter> = {}): Chapter {
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

function styledBookFrom(chapters: Chapter[]) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  return new ThemeEngine().applyTheme(book, ClassicTheme);
}

describe('LayoutEngine', () => {
  const engine = new LayoutEngine();

  it('places a small book entirely on one page', () => {
    const styled = styledBookFrom([chapter([heading(1, 'h-1'), paragraph('p-1')])]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].blocks).toEqual(['h-1', 'p-1']);
    expect(result.styledBook).toBe(styled);
  });

  it('returns no pages for an empty book', () => {
    const styled = styledBookFrom([]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(0);
  });

  it('breaks to a new page when content exceeds the usable page height', () => {
    const manyParagraphs = Array.from({ length: 200 }, (_, i) => paragraph(`p-${i}`, 'word '.repeat(50)));
    const styled = styledBookFrom([chapter(manyParagraphs)]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages.length).toBeGreaterThan(1);
    const allBlocks = result.pages.flatMap((p) => p.blocks);
    expect(allBlocks).toEqual(manyParagraphs.map((p) => p.id));
  });

  it('starts a new page at the beginning of each chapter after the first', () => {
    const styled = styledBookFrom([
      chapter([paragraph('p-1')], { id: 'c-1', number: 1 }),
      chapter([paragraph('p-2')], { id: 'c-2', number: 2 }),
    ]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].blocks).toEqual(['p-1']);
    expect(result.pages[1].blocks).toEqual(['p-2']);
  });

  it('uses an image block height directly rather than estimating from text', () => {
    const styled = styledBookFrom([chapter([image('img-1', 400)])]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].blocks).toEqual(['img-1']);
  });

  it('numbers pages sequentially starting at 1', () => {
    const manyParagraphs = Array.from({ length: 200 }, (_, i) => paragraph(`p-${i}`, 'word '.repeat(50)));
    const styled = styledBookFrom([chapter(manyParagraphs)]);

    const result = engine.paginate(styled, LETTER_LAYOUT);

    expect(result.pages.map((p) => p.number)).toEqual(result.pages.map((_, i) => i + 1));
  });
});
