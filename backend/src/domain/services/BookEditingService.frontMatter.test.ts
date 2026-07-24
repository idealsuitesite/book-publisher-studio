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

  it('writes the CANONICAL book title in lock-step with the title-page title — one title, not two (FOUNDER_TRAVERSAL defect 4)', () => {
    const before = bookWithFrontMatter();
    expect(before.metadata.title).toBe('T'); // canonical and title-page were out of sync

    const edited = service.editFrontMatter(before, {
      titlePage: { title: 'The Real Book Title', author: 'A' },
    });

    expect(edited.frontMatter.titlePage?.title).toBe('The Real Book Title');
    expect(edited.metadata.title).toBe('The Real Book Title'); // the canonical followed
  });

  it('removing the title PAGE leaves the canonical book title intact — a page is not the title', () => {
    const edited = service.editFrontMatter(bookWithFrontMatter(), { titlePage: null });

    expect('titlePage' in edited.frontMatter).toBe(false);
    expect(edited.metadata.title).toBe('T');
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

describe('addFrontMatterSection (AUTHOR_EXPERIENCE D2, M3-C6)', () => {
  // Deterministic ids so the composed nodes assert exactly.
  const seq = () => {
    let n = 0;
    return new BookEditingService(() => `id-${++n}`);
  };

  it('composes a dedication into a centered Block set on frontMatter.dedication', () => {
    const edited = seq().addFrontMatterSection(bookWithFrontMatter(), {
      section: 'dedication',
      text: '  For my family.  ',
    });
    expect(edited.frontMatter.dedication).toEqual({
      type: 'paragraph',
      id: 'id-1',
      text: 'For my family.', // trimmed
      align: 'center',
    });
    // the existing sections are untouched
    expect(edited.frontMatter.titlePage?.title).toBe('Faith Alone');
  });

  it('composes a preface into a titled Section, blank-line-separated input becoming paragraphs', () => {
    const now = new Date('2026-07-25T00:00:00Z');
    const edited = seq().addFrontMatterSection(
      bookWithFrontMatter(),
      { section: 'preface', title: '  Preface  ', text: 'First thought.\n\nSecond thought.' },
      now
    );
    const preface = edited.frontMatter.preface!;
    expect(preface.type).toBe('section');
    expect(preface.title).toBe('Preface'); // trimmed
    expect(preface.level).toBe(1);
    expect(preface.content.map((b) => (b.type === 'paragraph' ? b.text : ''))).toEqual([
      'First thought.',
      'Second thought.',
    ]);
    expect(preface.createdAt).toEqual(now);
  });

  it('a preface body with no blank line is a single paragraph', () => {
    const edited = seq().addFrontMatterSection(bookWithFrontMatter(), {
      section: 'preface',
      title: 'Preface',
      text: 'One continuous thought, no breaks.',
    });
    expect(edited.frontMatter.preface!.content).toHaveLength(1);
  });

  it('rejects a dedication with no text, and a preface missing its title or text (route maps to 400)', () => {
    expect(() => service.addFrontMatterSection(bookWithFrontMatter(), { section: 'dedication', text: '   ' })).toThrow(
      /dedication needs/
    );
    expect(() =>
      service.addFrontMatterSection(bookWithFrontMatter(), { section: 'preface', title: '  ', text: 'x' })
    ).toThrow(/preface needs/);
    expect(() =>
      service.addFrontMatterSection(bookWithFrontMatter(), { section: 'preface', title: 'P', text: '  ' })
    ).toThrow(/preface needs/);
  });

  it('never mutates its input (ADR-0001)', () => {
    const original = bookWithFrontMatter();
    const before = JSON.stringify(original.frontMatter);
    service.addFrontMatterSection(original, { section: 'dedication', text: 'For X.' });
    expect(JSON.stringify(original.frontMatter)).toBe(before);
  });
});
