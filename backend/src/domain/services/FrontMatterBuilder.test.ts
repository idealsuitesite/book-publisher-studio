import { describe, it, expect } from 'vitest';
import { FrontMatterBuilder } from './FrontMatterBuilder';
import { createBook } from '../models/Book';
import type { BookMetadata, TitlePage, CopyrightPage } from '../models/Book';

const builder = new FrontMatterBuilder();

function bookWith(metadata: Partial<BookMetadata>) {
  return createBook({ title: '', author: '', language: 'en', ...metadata });
}

describe('FrontMatterBuilder — title page', () => {
  it('builds a title page from the real title and author', () => {
    const front = builder.build(bookWith({ title: 'Le Guide de Jean', author: 'Jean Dupont' }));

    expect(front.titlePage).toEqual<TitlePage>({
      title: 'Le Guide de Jean',
      subtitle: undefined,
      author: 'Jean Dupont',
    });
  });

  it('includes a subtitle when the book has one', () => {
    const front = builder.build(
      bookWith({ title: 'Le Guide', subtitle: 'Édition Spéciale', author: 'Jean' })
    );

    expect(front.titlePage?.subtitle).toBe('Édition Spéciale');
  });

  it('preserves non-ASCII exactly — the Unicode invariant applies here too', () => {
    const front = builder.build(bookWith({ title: '红楼梦', author: '曹雪芹' }));

    expect(front.titlePage?.title).toBe('红楼梦');
    expect(front.titlePage?.author).toBe('曹雪芹');
  });

  it('emits no title page at all when there is neither title nor author', () => {
    const front = builder.build(bookWith({ title: '', author: '' }));

    expect(front.titlePage).toBeUndefined();
  });

  it('treats whitespace-only metadata as absent rather than as content', () => {
    const front = builder.build(bookWith({ title: '   ', author: '  ' }));

    expect(front.titlePage).toBeUndefined();
  });

  it('still emits a page when only one of title or author is present', () => {
    const front = builder.build(bookWith({ title: 'Untitled Manuscript', author: '' }));

    expect(front.titlePage?.title).toBe('Untitled Manuscript');
    expect(front.titlePage?.author).toBe('Unknown author');
  });

  it('never overwrites a hand-authored title page', () => {
    const book = bookWith({ title: 'Generated', author: 'Generated' });
    const authored: TitlePage = { title: 'Authored', author: 'Real Author', tagline: 'A tagline' };
    const front = builder.build({ ...book, frontMatter: { titlePage: authored } });

    expect(front.titlePage).toBe(authored);
  });
});

describe('FrontMatterBuilder — copyright page', () => {
  it('uses an explicit copyright notice when the book supplies one', () => {
    const front = builder.build(
      bookWith({ author: 'Jean', copyright: '© 2024 Éditions Lumière' })
    );

    expect(front.copyrightPage?.text).toBe('© 2024 Éditions Lumière');
  });

  it('derives a copyright line from author and publication year when none is supplied', () => {
    const front = builder.build(
      bookWith({ author: 'Jean Dupont', publicationDate: new Date('2019-04-01') })
    );

    expect(front.copyrightPage?.text).toBe('© 2019 Jean Dupont');
  });

  it('falls back to the current year when there is no publication date', () => {
    const front = builder.build(bookWith({ author: 'Jean Dupont' }));

    expect(front.copyrightPage?.text).toBe(`© ${new Date().getFullYear()} Jean Dupont`);
  });

  it('carries the ISBN when the book has one', () => {
    const front = builder.build(bookWith({ author: 'Jean', isbn: '978-3-16-148410-0' }));

    expect(front.copyrightPage?.isbn).toBe('978-3-16-148410-0');
  });

  it('omits the ISBN rather than printing an empty label', () => {
    const front = builder.build(bookWith({ author: 'Jean' }));

    expect(front.copyrightPage?.isbn).toBeUndefined();
  });

  it('combines publisher, rights and licence into one legal notice', () => {
    const front = builder.build(
      bookWith({
        author: 'Jean',
        publisher: 'Éditions Lumière',
        rights: 'All rights reserved',
        license: 'CC-BY-4.0',
      })
    );

    expect(front.copyrightPage?.legalNotice).toBe(
      'Published by Éditions Lumière · All rights reserved · Licensed under CC-BY-4.0'
    );
  });

  it('omits the legal notice entirely when none of its parts exist', () => {
    const front = builder.build(bookWith({ author: 'Jean' }));

    expect(front.copyrightPage?.legalNotice).toBeUndefined();
  });

  it('emits no copyright page when there is nothing to assert — never "© undefined"', () => {
    const front = builder.build(bookWith({ title: 'A Book', author: '' }));

    expect(front.copyrightPage).toBeUndefined();
  });

  it('never overwrites a hand-authored copyright page', () => {
    const book = bookWith({ author: 'Jean' });
    const authored: CopyrightPage = { text: 'Authored notice', legalNotice: 'Bespoke' };
    const front = builder.build({ ...book, frontMatter: { copyrightPage: authored } });

    expect(front.copyrightPage).toBe(authored);
  });
});

describe('FrontMatterBuilder — purity', () => {
  it('does not mutate the book it was given (ADR-0001)', () => {
    const book = bookWith({ title: 'Le Guide', author: 'Jean' });
    const snapshot = structuredClone(book);

    builder.build(book);

    expect(book).toEqual(snapshot);
    expect(book.frontMatter).toEqual({});
  });

  it('preserves front matter fields it does not build, such as an existing TOC', () => {
    const book = bookWith({ title: 'Le Guide', author: 'Jean' });
    const withToc = { ...book, frontMatter: { toc: { generateAutomatically: true, entries: [] } } };

    const front = builder.build(withToc);

    expect(front.toc).toEqual({ generateAutomatically: true, entries: [] });
    expect(front.titlePage).toBeDefined();
  });
});
