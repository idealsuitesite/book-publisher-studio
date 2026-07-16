import { describe, it, expect } from 'vitest';
import { BookMapper } from './BookMapper';
import { createBook } from '../../domain/models/Book';
import type {
  Chapter,
  Section,
  Heading,
  Paragraph,
  Quote,
  Scripture,
  Image,
  Table,
  List,
  Footnote,
} from '../../domain/models/Book';

function heading(text: string, id = 'h-1'): Heading {
  return { type: 'heading', id, level: 1, text };
}

function paragraph(text: string, id = 'p-1'): Paragraph {
  return { type: 'paragraph', id, text, inlines: [{ type: 'bold', text: 'bold bit' }] };
}

function quote(text: string, id = 'q-1'): Quote {
  return { type: 'quote', id, text, attribution: 'Someone', quoteType: 'epigraph' };
}

function scripture(text: string, id = 'scr-1'): Scripture {
  return {
    type: 'scripture',
    id,
    text,
    translation: 'KJV',
    reference: { book: 'John', chapter: 3, verses: '16' },
  };
}

function image(id = 'img-1'): Image {
  return {
    type: 'image',
    id,
    url: 'https://example.com/a.png',
    caption: 'A cover',
    width: 800,
    height: 600,
  };
}

function table(id = 'tbl-1'): Table {
  return { type: 'table', id, headers: ['Name'], rows: [['Alexandre']] };
}

function list(id = 'list-1'): List {
  return { type: 'list', id, ordered: false, items: ['One', 'Two'] };
}

function footnote(id = 'fn-1'): Footnote {
  return { type: 'footnote', id, number: 1, content: 'See appendix.' };
}

function section(overrides: Partial<Section> = {}): Section {
  const now = new Date();
  return {
    type: 'section',
    id: 'sec-1',
    title: 'A Section',
    content: [],
    level: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function chapter(overrides: Partial<Chapter> = {}): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: 'c-1',
    number: 1,
    title: 'Chapter One',
    content: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('BookMapper', () => {
  const mapper = new BookMapper();

  it('maps book metadata', () => {
    const publicationDate = new Date('2026-01-01T00:00:00Z');
    const book = createBook(
      { title: 'My Book', author: 'Jane Doe', language: 'en', publicationDate },
      [chapter()]
    );

    const dto = mapper.map(book);

    expect(dto.metadata.title).toBe('My Book');
    expect(dto.metadata.author).toBe('Jane Doe');
    expect(dto.metadata.language).toBe('en');
    expect(dto.metadata.publicationDate).toBe(publicationDate.toISOString());
  });

  it('maps every block type inside a chapter', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter({
        content: [
          heading('H'),
          paragraph('P'),
          quote('Q'),
          scripture('S'),
          image(),
          table(),
          list(),
          footnote(),
        ],
      }),
    ]);

    const dto = mapper.map(book);
    const chapterDTO = dto.mainContent[0];

    expect(chapterDTO.type).toBe('chapter');
    expect(chapterDTO.content.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'scripture',
      'image',
      'table',
      'list',
      'footnote',
    ]);
  });

  it('maps nested sections and subsections', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter({
        sections: [
          section({
            id: 'sec-1',
            title: 'Section A',
            subsections: [section({ id: 'sec-2', title: 'Subsection A.1' })],
          }),
        ],
      }),
    ]);

    const dto = mapper.map(book);
    const chapterDTO = dto.mainContent[0];

    expect(chapterDTO.type).toBe('chapter');
    if (chapterDTO.type !== 'chapter') throw new Error('expected chapter');
    expect(chapterDTO.sections?.[0].title).toBe('Section A');
    expect(chapterDTO.sections?.[0].subsections?.[0].title).toBe('Subsection A.1');
  });

  it('maps a top-level section (not wrapped in a chapter)', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      section({ title: 'Preamble' }),
    ]);

    const dto = mapper.map(book);

    expect(dto.mainContent[0].type).toBe('section');
  });

  it('carries over wordCount/pageCount/readingTime as-is (no calculation)', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter()]);
    const enriched = { ...book, wordCount: 42, pageCount: 3, readingTime: 1 };

    const dto = mapper.map(enriched);

    expect(dto.wordCount).toBe(42);
    expect(dto.pageCount).toBe(3);
    expect(dto.readingTime).toBe(1);
  });

  it('does not mutate the input book', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter({ content: [paragraph('P')] }),
    ]);
    const snapshot = JSON.parse(JSON.stringify(book));

    mapper.map(book);

    expect(JSON.parse(JSON.stringify(book))).toEqual(snapshot);
  });
});
