import { describe, it, expect } from 'vitest';
import {
  Book,
  BookMetadata,
  Chapter,
  Section,
  Paragraph,
  Heading,
  Image,
  createBook,
  isChapter,
  isSection,
  isParagraph,
  isHeading,
  isImage,
} from './Book';

describe('Book Model', () => {
  it('should create a book with metadata', () => {
    const metadata: BookMetadata = {
      title: 'Test Book',
      author: 'Test Author',
      language: 'en',
    };

    const book = createBook(metadata);

    expect(book.id).toBeDefined();
    expect(book.metadata.title).toBe('Test Book');
    expect(book.mainContent).toEqual([]);
    expect(book.version).toBe(1);
  });

  it('should create a book with content', () => {
    const metadata: BookMetadata = {
      title: 'Test Book',
      author: 'Test Author',
      language: 'en',
    };

    const chapter: Chapter = {
      type: 'chapter',
      id: 'ch1',
      number: 1,
      title: 'Chapter 1',
      content: [
        {
          type: 'paragraph',
          id: 'p1',
          text: 'This is a paragraph.',
        } as Paragraph,
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const book = createBook(metadata, [chapter]);

    expect(book.mainContent).toHaveLength(1);
    expect(book.mainContent[0].type).toBe('chapter');
  });

  it('isChapter should identify chapters', () => {
    const chapter: Chapter = {
      type: 'chapter',
      id: 'ch1',
      number: 1,
      title: 'Chapter 1',
      content: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(isChapter(chapter)).toBe(true);
  });

  it('isParagraph should identify paragraphs', () => {
    const paragraph: Paragraph = {
      type: 'paragraph',
      id: 'p1',
      text: 'Test paragraph',
    };

    expect(isParagraph(paragraph)).toBe(true);
  });

  it('isSection should identify sections and reject chapters', () => {
    const section: Section = {
      type: 'section',
      id: 'sec1',
      title: 'Section 1',
      content: [],
      level: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const chapter: Chapter = {
      type: 'chapter',
      id: 'ch1',
      number: 1,
      title: 'Chapter 1',
      content: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(isSection(section)).toBe(true);
    expect(isSection(chapter)).toBe(false);
  });

  it('isHeading should identify heading blocks', () => {
    const heading: Heading = { type: 'heading', id: 'h1', level: 1, text: 'Title' };
    const paragraph: Paragraph = { type: 'paragraph', id: 'p1', text: 'Body' };

    expect(isHeading(heading)).toBe(true);
    expect(isHeading(paragraph)).toBe(false);
  });

  it('isImage should identify image blocks', () => {
    const image: Image = { type: 'image', id: 'img1', url: 'https://example.com/a.png' };
    const paragraph: Paragraph = { type: 'paragraph', id: 'p1', text: 'Body' };

    expect(isImage(image)).toBe(true);
    expect(isImage(paragraph)).toBe(false);
  });

  it('should serialize and deserialize a book', () => {
    const metadata: BookMetadata = {
      title: 'Test Book',
      author: 'Test Author',
      language: 'en',
    };

    const originalBook = createBook(metadata);
    const json = JSON.stringify(originalBook);
    const deserialized: Book = JSON.parse(json);

    expect(deserialized.metadata.title).toBe(originalBook.metadata.title);
  });

  it('should have all required properties', () => {
    const metadata: BookMetadata = {
      title: 'Test',
      author: 'Test',
      language: 'en',
    };

    const book = createBook(metadata);

    expect(book.id).toBeDefined();
    expect(book.metadata).toBeDefined();
    expect(book.frontMatter).toBeDefined();
    expect(book.mainContent).toBeDefined();
    expect(book.backMatter).toBeDefined();
  });

  it('should support immutable updates', () => {
    const originalBook = createBook({
      title: 'Original',
      author: 'Author',
      language: 'en',
    });

    const updatedBook: Book = {
      ...originalBook,
      metadata: {
        ...originalBook.metadata,
        title: 'Updated',
      },
      version: 2,
    };

    expect(originalBook.metadata.title).toBe('Original');
    expect(updatedBook.metadata.title).toBe('Updated');
  });
});
