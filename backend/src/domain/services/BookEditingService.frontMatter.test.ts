import { describe, it, expect } from 'vitest';
import { BookEditingService } from './BookEditingService';
import { createBook } from '../models/Book';
import type { Book } from '../models/Book';

const service = new BookEditingService();

function bookWithFrontMatter(): Book {
  const base = createBook({ title: 'T', author: 'A', language: 'en' });
  return {
    ...base,
    frontMatter: {
      titlePage: { title: 'Faith Alone', author: 'Ruan Carlos', subtitle: 'An Essay' },
      copyrightPage: { text: '© 2026 Ruan Carlos', isbn: '978-1-4028-9462-6' },
    },
  };
}

describe('editFrontMatter (MINI_DR_EDIT_FRONT_MATTER)', () => {
  it('replaces the title page whole, trimming and normalising empty optionals to undefined', () => {
    const edited = service.editFrontMatter(bookWithFrontMatter(), {
      titlePage: { title: '  New Title  ', author: ' New Author ', subtitle: '   ', tagline: ' A tagline ' },
    });

    expect(edited.frontMatter.titlePage).toEqual({
      title: 'New Title',
      author: 'New Author',
      subtitle: undefined,
      tagline: 'A tagline',
    });
    // The other section is untouched (undefined = leave alone).
    expect(edited.frontMatter.copyrightPage?.text).toBe('© 2026 Ruan Carlos');
  });

  it('replaces the copyright page whole', () => {
    const edited = service.editFrontMatter(bookWithFrontMatter(), {
      copyrightPage: { text: '© 2027 Someone Else', legalNotice: 'All rights reserved.' },
    });

    expect(edited.frontMatter.copyrightPage).toEqual({
      text: '© 2027 Someone Else',
      isbn: undefined,
      copyrightText: undefined,
      legalNotice: 'All rights reserved.',
      printingInfo: undefined,
    });
    expect(edited.frontMatter.titlePage?.title).toBe('Faith Alone');
  });

  it('null CLEARS a section — the key of the cleared field is gone, not set to undefined', () => {
    const edited = service.editFrontMatter(bookWithFrontMatter(), { copyrightPage: null });

    expect('copyrightPage' in edited.frontMatter).toBe(false);
    expect(edited.frontMatter.titlePage).toBeDefined();

    const bothCleared = service.editFrontMatter(edited, { titlePage: null });
    expect('titlePage' in bothCleared.frontMatter).toBe(false);
  });

  it('rejects a title page without a title or author, and a copyright page without text', () => {
    expect(() => service.editFrontMatter(bookWithFrontMatter(), { titlePage: { title: '  ', author: 'A' } })).toThrow(
      /title and an author/
    );
    expect(() => service.editFrontMatter(bookWithFrontMatter(), { titlePage: { title: 'T', author: '' } })).toThrow(
      /title and an author/
    );
    expect(() => service.editFrontMatter(bookWithFrontMatter(), { copyrightPage: { text: '  ' } })).toThrow(
      /copyright text/
    );
  });

  it('never mutates its input (ADR-0001), and an empty patch is a no-op on content', () => {
    const original = bookWithFrontMatter();
    const before = JSON.stringify(original.frontMatter);

    const edited = service.editFrontMatter(original, {});

    expect(JSON.stringify(original.frontMatter)).toBe(before);
    expect(JSON.stringify(edited.frontMatter)).toBe(before);
  });
});
