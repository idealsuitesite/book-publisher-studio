import { describe, it, expect } from 'vitest';
import { BookMetricsCalculator } from './BookMetricsCalculator';
import { createBook } from '../models/Book';
import type { Chapter, Section, Paragraph, Scripture, Image, Table, Block } from '../models/Book';

function paragraph(text: string, id = 'p-1'): Paragraph {
  return { type: 'paragraph', id, text };
}

function scripture(text: string, id = 's-1'): Scripture {
  return { type: 'scripture', id, text };
}

function image(id = 'img-1'): Image {
  return { type: 'image', id, url: 'https://example.com/a.png' };
}

function table(id = 'tbl-1'): Table {
  return { type: 'table', id, headers: [], rows: [] };
}

function chapter(content: Block[], overrides: Partial<Chapter> = {}): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: 'c-1',
    number: 1,
    title: '',
    content,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function section(content: Block[], overrides: Partial<Section> = {}): Section {
  const now = new Date();
  return {
    type: 'section',
    id: 'sec-1',
    title: '',
    content,
    level: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('BookMetricsCalculator', () => {
  const calculator = new BookMetricsCalculator();

  it('sums word count across headings, paragraphs, quotes, and scripture', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([paragraph('Three words here'), scripture('For God so loved the world')], {
        title: 'Two Words',
      }),
    ]);

    const result = calculator.calculate(book);

    expect(result.wordCount).toBe(11);
  });

  it('derives readingTime from wordCount at 200 words per minute, rounded up', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      section([paragraph(new Array(250).fill('word').join(' '))]),
    ]);

    const result = calculator.calculate(book);

    expect(result.wordCount).toBe(250);
    expect(result.readingTime).toBe(2);
  });

  it('derives pageCount from wordCount at 300 words per page, minimum 1 page if any words exist', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      section([paragraph('Just a few words.')]),
    ]);

    const result = calculator.calculate(book);

    expect(result.wordCount).toBe(4);
    expect(result.pageCount).toBe(1);
  });

  it('does not mutate the input book', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      section([paragraph('Some words.')]),
    ]);

    calculator.calculate(book);

    expect(book.wordCount).toBeUndefined();
  });

  describe('countContent', () => {
    it('counts chapters, images, and tables across the whole tree, including nested sections', () => {
      const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
        chapter([image()], {
          id: 'c-1',
          number: 1,
          sections: [
            section([table()], {
              id: 'sec-1',
              subsections: [section([image(), table()], { id: 'sec-2' })],
            }),
          ],
        }),
        chapter([], { id: 'c-2', number: 2 }),
      ]);

      const stats = calculator.countContent(book);

      expect(stats.chapters).toBe(2);
      expect(stats.images).toBe(2);
      expect(stats.tables).toBe(2);
    });

    it('returns zeros for a book with no chapters, images, or tables', () => {
      const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
        section([paragraph('Just text.')]),
      ]);

      const stats = calculator.countContent(book);

      expect(stats).toEqual({ chapters: 0, images: 0, tables: 0 });
    });
  });
});
