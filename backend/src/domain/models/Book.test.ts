import { describe, it, expect } from 'vitest';
import {
  Book,
  BookMetadata,
  Chapter,
  Paragraph,
  createBook,
  isChapter,
  isParagraph,
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