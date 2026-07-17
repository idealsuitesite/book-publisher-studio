import { describe, it, expect } from 'vitest';
import { TypographyResolver } from './TypographyResolver';
import { ThemeEngine } from './ThemeEngine';
import { ClassicTheme } from '../themes/ClassicTheme';
import { createBook } from '../models/Book';
import type {
  Chapter,
  Section,
  Heading,
  Paragraph,
  Quote,
  Scripture,
  Footnote,
  List,
  Table,
  Image,
  PageBreak,
  Divider,
  Block,
  InlineElement,
} from '../models/Book';

function heading(id: string, text = 'A Heading', inlines?: InlineElement[]): Heading {
  return { type: 'heading', id, level: 1, text, inlines };
}

function paragraph(id: string, text = 'Some body text.', inlines?: InlineElement[]): Paragraph {
  return { type: 'paragraph', id, text, inlines };
}

function dropCapParagraph(id: string, text: string, dropCap: boolean): Paragraph {
  return { type: 'paragraph', id, text, dropCap };
}

function quote(id: string, text = 'A quote.', inlines?: InlineElement[]): Quote {
  return { type: 'quote', id, text, inlines };
}

function scripture(id: string, text = 'In the beginning.', inlines?: InlineElement[]): Scripture {
  return { type: 'scripture', id, text, inlines };
}

function footnote(id: string, content = 'See appendix.', inlines?: InlineElement[]): Footnote {
  return { type: 'footnote', id, number: 1, content, inlines };
}

function list(id: string, items: string[] = ['One', 'Two'], inlines?: InlineElement[][]): List {
  return { type: 'list', id, ordered: false, items, inlines };
}

function table(id: string): Table {
  return { type: 'table', id, headers: ['A'], rows: [['1']] };
}

function image(id: string): Image {
  return { type: 'image', id, url: 'https://example.com/a.png' };
}

function pageBreak(id: string): PageBreak {
  return { type: 'page-break', id };
}

function divider(id: string): Divider {
  return { type: 'divider', id };
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

function styledBookFrom(chapters: Chapter[]) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, chapters);
  return new ThemeEngine().applyTheme(book, ClassicTheme);
}

describe('TypographyResolver', () => {
  const resolver = new TypographyResolver();

  it('falls back to a single plain run when a block has no inlines', () => {
    const styled = styledBookFrom([chapter([paragraph('p-1', 'Plain text.')])]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['p-1']).toEqual({
      runs: [
        {
          text: 'Plain text.',
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
          superscript: false,
          subscript: false,
          smallCaps: false,
        },
      ],
      dropCap: false,
      orphanRisk: false,
    });
  });

  it('resolves each inline element to its own styled run', () => {
    const inlines: InlineElement[] = [
      { type: 'text', text: 'Plain ' },
      { type: 'bold', text: 'bold ' },
      { type: 'italic', text: 'italic ' },
      { type: 'underline', text: 'underline ' },
      { type: 'strikethrough', text: 'struck ' },
      { type: 'superscript', text: 'sup ' },
      { type: 'subscript', text: 'sub ' },
      { type: 'small-caps', text: 'caps' },
      { type: 'link', text: 'a link', url: 'https://example.com' },
    ];
    const styled = styledBookFrom([chapter([paragraph('p-1', 'ignored when inlines present', inlines)])]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['p-1']?.runs).toEqual([
      { text: 'Plain ', bold: false, italic: false, underline: false, strikethrough: false, superscript: false, subscript: false, smallCaps: false, linkUrl: undefined },
      { text: 'bold ', bold: true, italic: false, underline: false, strikethrough: false, superscript: false, subscript: false, smallCaps: false, linkUrl: undefined },
      { text: 'italic ', bold: false, italic: true, underline: false, strikethrough: false, superscript: false, subscript: false, smallCaps: false, linkUrl: undefined },
      { text: 'underline ', bold: false, italic: false, underline: true, strikethrough: false, superscript: false, subscript: false, smallCaps: false, linkUrl: undefined },
      { text: 'struck ', bold: false, italic: false, underline: false, strikethrough: true, superscript: false, subscript: false, smallCaps: false, linkUrl: undefined },
      { text: 'sup ', bold: false, italic: false, underline: false, strikethrough: false, superscript: true, subscript: false, smallCaps: false, linkUrl: undefined },
      { text: 'sub ', bold: false, italic: false, underline: false, strikethrough: false, superscript: false, subscript: true, smallCaps: false, linkUrl: undefined },
      { text: 'caps', bold: false, italic: false, underline: false, strikethrough: false, superscript: false, subscript: false, smallCaps: true, linkUrl: undefined },
      { text: 'a link', bold: false, italic: false, underline: false, strikethrough: false, superscript: false, subscript: false, smallCaps: false, linkUrl: 'https://example.com' },
    ]);
  });

  it('resolves runs for heading, quote, scripture, and footnote blocks', () => {
    const styled = styledBookFrom([
      chapter([heading('h-1', 'Title'), quote('q-1', 'A quote.'), scripture('s-1', 'Verse.'), footnote('f-1', 'Note.')]),
    ]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['h-1']?.runs[0].text).toBe('Title');
    expect(result.blockTypography?.['q-1']?.runs[0].text).toBe('A quote.');
    expect(result.blockTypography?.['s-1']?.runs[0].text).toBe('Verse.');
    expect(result.blockTypography?.['f-1']?.runs[0].text).toBe('Note.');
  });

  it('forces italic on quote and scripture runs as a declared internal rule, even for an explicit bold run', () => {
    const inlines: InlineElement[] = [{ type: 'bold', text: 'emphasized' }];
    const styled = styledBookFrom([chapter([quote('q-1', 'ignored', inlines), scripture('s-1', 'Verse.')])]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['q-1']?.runs).toEqual([
      { text: 'emphasized', bold: true, italic: true, underline: false, strikethrough: false, superscript: false, subscript: false, smallCaps: false, linkUrl: undefined },
    ]);
    expect(result.blockTypography?.['s-1']?.runs[0].italic).toBe(true);
  });

  it('does not force italic on heading, paragraph, footnote, or list blocks', () => {
    const styled = styledBookFrom([chapter([heading('h-1'), paragraph('p-1'), footnote('f-1'), list('l-1', ['Item'])])]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['h-1']?.runs[0].italic).toBe(false);
    expect(result.blockTypography?.['p-1']?.runs[0].italic).toBe(false);
    expect(result.blockTypography?.['f-1']?.runs[0].italic).toBe(false);
    expect(result.blockTypography?.['l-1::item-0']?.runs[0].italic).toBe(false);
  });

  it('converts straight quotes to curly quotes by default (English-only smart quotes)', () => {
    const styled = styledBookFrom([chapter([paragraph('p-1', `She said "hello" and it's "hers".`)])]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['p-1']?.runs[0].text).toBe('She said “hello” and it’s “hers”.');
  });

  it('leaves straight quotes untouched when smartQuotes: false is passed', () => {
    const styled = styledBookFrom([chapter([paragraph('p-1', `"quoted"`)])]);

    const result = resolver.resolve(styled, { smartQuotes: false });

    expect(result.blockTypography?.['p-1']?.runs[0].text).toBe('"quoted"');
  });

  it('resolves Paragraph.dropCap to dropCap: true by default', () => {
    const styled = styledBookFrom([chapter([dropCapParagraph('p-1', 'First para.', true)])]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['p-1']?.dropCap).toBe(true);
  });

  it('does not set dropCap when the paragraph does not request one', () => {
    const styled = styledBookFrom([chapter([paragraph('p-1')])]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['p-1']?.dropCap).toBe(false);
  });

  it('suppresses drop caps entirely when dropCaps: false is passed, even if the paragraph requests one', () => {
    const styled = styledBookFrom([chapter([dropCapParagraph('p-1', 'First para.', true)])]);

    const result = resolver.resolve(styled, { dropCaps: false });

    expect(result.blockTypography?.['p-1']?.dropCap).toBe(false);
  });

  it('produces an empty-runs entry for table, image, page-break, and divider blocks', () => {
    const styled = styledBookFrom([chapter([table('t-1'), image('img-1'), pageBreak('pb-1'), divider('d-1')])]);

    const result = resolver.resolve(styled);

    for (const id of ['t-1', 'img-1', 'pb-1', 'd-1']) {
      expect(result.blockTypography?.[id]).toEqual({ runs: [], dropCap: false, orphanRisk: false });
    }
  });

  it('resolves list items to one entry per item, keyed by blockId::item-index, not one entry for the whole block', () => {
    const styled = styledBookFrom([chapter([list('l-1', ['First', 'Second', 'Third'])])]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['l-1']).toBeUndefined();
    expect(result.blockTypography?.['l-1::item-0']?.runs[0].text).toBe('First');
    expect(result.blockTypography?.['l-1::item-1']?.runs[0].text).toBe('Second');
    expect(result.blockTypography?.['l-1::item-2']?.runs[0].text).toBe('Third');
  });

  it('resolves per-item inline runs for list items that have them', () => {
    const inlinesPerItem: InlineElement[][] = [
      [{ type: 'bold', text: 'Bold item' }],
      [{ type: 'text', text: 'Plain item' }],
    ];
    const styled = styledBookFrom([chapter([list('l-1', ['ignored', 'ignored'], inlinesPerItem)])]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['l-1::item-0']?.runs).toEqual([
      { text: 'Bold item', bold: true, italic: false, underline: false, strikethrough: false, superscript: false, subscript: false, smallCaps: false, linkUrl: undefined },
    ]);
    expect(result.blockTypography?.['l-1::item-1']?.runs).toEqual([
      { text: 'Plain item', bold: false, italic: false, underline: false, strikethrough: false, superscript: false, subscript: false, smallCaps: false, linkUrl: undefined },
    ]);
  });

  it('produces no entries for an empty list', () => {
    const styled = styledBookFrom([chapter([list('l-1', [])])]);

    const result = resolver.resolve(styled);

    expect(Object.keys(result.blockTypography ?? {}).filter((k) => k.startsWith('l-1'))).toEqual([]);
  });

  it('resolves blocks nested in sections and subsections', () => {
    const now = new Date();
    const section: Section = {
      type: 'section',
      id: 'sec-1',
      title: 'Section A',
      content: [paragraph('p-sec')],
      level: 2,
      createdAt: now,
      updatedAt: now,
      subsections: [
        {
          type: 'section',
          id: 'sec-2',
          title: 'Section B',
          content: [paragraph('p-subsec')],
          level: 3,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
    const styled = styledBookFrom([chapter([paragraph('p-1')], { sections: [section] })]);

    const result = resolver.resolve(styled);

    expect(Object.keys(result.blockTypography ?? {})).toEqual(['p-1', 'p-sec', 'p-subsec']);
  });

  it('does not mutate the input StyledBook', () => {
    const styled = styledBookFrom([chapter([paragraph('p-1')])]);

    const result = resolver.resolve(styled);

    expect(styled.blockTypography).toBeUndefined();
    expect(result).not.toBe(styled);
    expect(result.book).toBe(styled.book);
    expect(result.blockStyles).toBe(styled.blockStyles);
  });
});
