import { describe, it, expect } from 'vitest';
import { ThemeEngine } from './ThemeEngine';
import { ClassicTheme } from '../themes/ClassicTheme';
import { createBook } from '../models/Book';
import type { Chapter, Heading, Paragraph, Image } from '../models/Book';

function heading(level: 1 | 2 | 3 | 4 | 5 | 6, id: string): Heading {
  return { type: 'heading', id, level, text: 'A Heading' };
}

function paragraph(id: string): Paragraph {
  return { type: 'paragraph', id, text: 'Some body text.' };
}

function image(id: string): Image {
  return { type: 'image', id, url: 'https://example.com/a.png' };
}

function chapter(content: (Heading | Paragraph | Image)[], overrides: Partial<Chapter> = {}): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: 'c-1',
    number: 1,
    title: 'Chapter One',
    content,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ThemeEngine', () => {
  const engine = new ThemeEngine();

  it('resolves heading styles using the theme heading font and per-level size', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([heading(1, 'h-1'), heading(3, 'h-3')]),
    ]);

    const styled = engine.applyTheme(book, ClassicTheme);

    expect(styled.blockStyles['h-1'].fontFamily).toBe(ClassicTheme.fonts.heading);
    expect(styled.blockStyles['h-1'].fontSize).toBe(ClassicTheme.fontSizes.h1);
    expect(styled.blockStyles['h-3'].fontSize).toBe(ClassicTheme.fontSizes.h3);
  });

  it('resolves body styles for non-heading blocks using the theme body font', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([paragraph('p-1'), image('img-1')]),
    ]);

    const styled = engine.applyTheme(book, ClassicTheme);

    expect(styled.blockStyles['p-1'].fontFamily).toBe(ClassicTheme.fonts.body);
    expect(styled.blockStyles['p-1'].fontSize).toBe(ClassicTheme.fontSizes.body);
    expect(styled.blockStyles['img-1'].fontFamily).toBe(ClassicTheme.fonts.body);
  });

  it('resolves styles for blocks nested in sections and subsections', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter([], {
        sections: [
          {
            type: 'section',
            id: 'sec-1',
            title: 'A',
            content: [paragraph('p-nested')],
            level: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
            subsections: [
              {
                type: 'section',
                id: 'sec-2',
                title: 'B',
                content: [heading(3, 'h-nested')],
                level: 3,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          },
        ],
      }),
    ]);

    const styled = engine.applyTheme(book, ClassicTheme);

    expect(styled.blockStyles['p-nested']).toBeDefined();
    expect(styled.blockStyles['h-nested'].fontSize).toBe(ClassicTheme.fontSizes.h3);
  });

  it('leaves the original book untouched and references it in the result', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter([paragraph('p-1')])]);

    const styled = engine.applyTheme(book, ClassicTheme);

    expect(styled.book).toBe(book);
    expect(styled.theme).toBe(ClassicTheme);
  });
});
