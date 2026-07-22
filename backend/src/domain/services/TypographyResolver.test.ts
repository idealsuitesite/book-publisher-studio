import { describe, it, expect } from 'vitest';
import { TypographyResolver } from './TypographyResolver';
import { ThemeEngine } from './ThemeEngine';
import { BookEditingService } from './BookEditingService';
import { ClassicTheme } from '../themes/ClassicTheme';
import { createBook } from '../models/Book';
import type { Theme } from '../models/Theme';
import type {
  Chapter,
  Section,
  Content,
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
      staysWithNext: false,
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

  it('sets staysWithNext: true only for heading blocks', () => {
    const styled = styledBookFrom([
      chapter([
        heading('h-1'),
        paragraph('p-1'),
        quote('q-1'),
        scripture('s-1'),
        footnote('f-1'),
        list('l-1', ['Item']),
      ]),
    ]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['h-1']?.staysWithNext).toBe(true);
    expect(result.blockTypography?.['p-1']?.staysWithNext).toBe(false);
    expect(result.blockTypography?.['q-1']?.staysWithNext).toBe(false);
    expect(result.blockTypography?.['s-1']?.staysWithNext).toBe(false);
    expect(result.blockTypography?.['f-1']?.staysWithNext).toBe(false);
    expect(result.blockTypography?.['l-1::item-0']?.staysWithNext).toBe(false);
  });

  it('produces an empty-runs entry for table, image, page-break, and divider blocks', () => {
    const styled = styledBookFrom([chapter([table('t-1'), image('img-1'), pageBreak('pb-1'), divider('d-1')])]);

    const result = resolver.resolve(styled);

    for (const id of ['t-1', 'img-1', 'pb-1', 'd-1']) {
      expect(result.blockTypography?.[id]).toEqual({ runs: [], dropCap: false, staysWithNext: false });
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

// ---------------------------------------------------------------------------
// Theme-declared chapterOpening drop caps (MINI_DR_DROP_CAPS §6 commit 2).
// The §5 positional edge cases are enumerated HERE, before the implementation,
// as the review requires. The rule under test is strictly positional (§2/Q1 —
// "positional, never inferential"): a drop cap fires iff the theme declares
// scope 'chapterOpening' AND the block is a chapter's FIRST block AND that
// block is a paragraph with real text. Every case below is that rule's direct
// consequence, decided by position alone — never by guessing what the text is.
// ---------------------------------------------------------------------------

function withDropCapRule(scope: 'none' | 'chapterOpening', scale = 2.5): Theme {
  return { ...ClassicTheme, name: 'dropcap-rule-test', presentation: { dropCap: { scope, scale } } };
}

function styledWith(theme: Theme, contents: Content[]) {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, contents);
  return new ThemeEngine().applyTheme(book, theme);
}

function sectionOf(id: string, title: string, content: Block[], level = 2): Section {
  const now = new Date();
  return { type: 'section', id, title, content, level, createdAt: now, updatedAt: now };
}

describe('TypographyResolver — theme-declared chapterOpening drop caps (MINI_DR_DROP_CAPS §6 commit 2)', () => {
  const resolver = new TypographyResolver();
  const trigger = withDropCapRule('chapterOpening');

  it('fires on the first paragraph of every chapter, and on no other paragraph', () => {
    const styled = styledWith(trigger, [
      chapter([paragraph('c1-p1', 'Opening one.'), paragraph('c1-p2', 'Second.')], { id: 'c-1', number: 1 }),
      chapter([paragraph('c2-p1', 'Opening two.'), paragraph('c2-p2', 'Second.')], { id: 'c-2', number: 2 }),
    ]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['c1-p1']?.dropCap).toBe(true);
    expect(result.blockTypography?.['c1-p2']?.dropCap).toBe(false);
    expect(result.blockTypography?.['c2-p1']?.dropCap).toBe(true);
    expect(result.blockTypography?.['c2-p2']?.dropCap).toBe(false);
  });

  it('does not fire under scope none — the scope Classic and Modern ship', () => {
    const styled = styledWith(withDropCapRule('none'), [chapter([paragraph('p-1', 'Opening.')])]);

    expect(resolver.resolve(styled).blockTypography?.['p-1']?.dropCap).toBe(false);
    // The SHIPPED themes must declare 'none' (§3 instrument 3: parity byte-stability rests on it).
    expect(ClassicTheme.presentation?.dropCap?.scope).toBe('none');
  });

  it('does not fire when the theme declares no presentation at all (every pre-capability theme shape)', () => {
    const bare: Theme = { ...ClassicTheme, presentation: undefined };
    const styled = styledWith(bare, [chapter([paragraph('p-1', 'Opening.')])]);

    expect(resolver.resolve(styled).blockTypography?.['p-1']?.dropCap).toBe(false);
  });

  // §5 edge case 1: first block not a paragraph.
  it('§5: a chapter whose FIRST block is not a paragraph gets no drop cap — not even on a later paragraph', () => {
    // The ornament marks the chapter's opening TEXT. If a heading, a quote or an image opens the
    // chapter, there is no opening paragraph to ornament — a drop cap further down would sit
    // mid-flow, exactly the misfire §5 names.
    const styled = styledWith(trigger, [
      chapter([heading('h-1', 'A heading first'), paragraph('after-h', 'Then prose.')], { id: 'c-1', number: 1 }),
      chapter([quote('q-1', 'An epigraph first.'), paragraph('after-q', 'Then prose.')], { id: 'c-2', number: 2 }),
      chapter([image('img-1'), paragraph('after-img', 'Then prose.')], { id: 'c-3', number: 3 }),
    ]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['after-h']?.dropCap).toBe(false);
    expect(result.blockTypography?.['after-q']?.dropCap).toBe(false);
    expect(result.blockTypography?.['after-img']?.dropCap).toBe(false);
  });

  // §5 edge case 2: empty chapter.
  it('§5: an empty chapter — including the blockless part-opener divider — fires nowhere and does not crash', () => {
    const styled = styledWith(trigger, [
      chapter([], { id: 'empty-ch', number: 1, title: 'Empty' }),
      chapter([], { id: 'part-1', number: 0, title: 'Part I', partOpener: true }),
      chapter([paragraph('c2-p1', 'Real opening.')], { id: 'c-2', number: 2 }),
    ]);

    const result = resolver.resolve(styled);

    const fired = Object.entries(result.blockTypography ?? {}).filter(([, t]) => t.dropCap);
    expect(fired.map(([id]) => id)).toEqual(['c2-p1']);
  });

  it('§5: a chapter whose text lives under its sections gets no drop cap — the rule never descends', () => {
    // A paragraph under a section title is a SECTION opening, not the chapter's own opening; the
    // chapter's first block is the positional fact, and here there is none. This also covers the
    // untitled-section shape a structure-editing split can leave behind.
    const styled = styledWith(trigger, [
      chapter([], { id: 'c-1', number: 1, sections: [sectionOf('sec-1', 'First Section', [paragraph('sec-p1', 'Section prose.')])] }),
      chapter([paragraph('c2-p1', 'Direct opening.')], {
        id: 'c-2',
        number: 2,
        sections: [sectionOf('sec-2', '', [paragraph('sec-p2', 'Untitled-section prose.')])],
      }),
    ]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['sec-p1']?.dropCap).toBe(false);
    expect(result.blockTypography?.['sec-p2']?.dropCap).toBe(false);
    expect(result.blockTypography?.['c2-p1']?.dropCap).toBe(true); // the direct opening still fires
  });

  it('a top-level SECTION is not a chapter: its first paragraph never fires (the preamble shape)', () => {
    const styled = styledWith(trigger, [
      sectionOf('preamble', '', [paragraph('pre-p1', 'Preamble prose before any chapter.')]) as Content,
      chapter([paragraph('c1-p1', 'Chapter opening.')], { id: 'c-1', number: 1 }),
    ]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['pre-p1']?.dropCap).toBe(false);
    expect(result.blockTypography?.['c1-p1']?.dropCap).toBe(true);
  });

  // §5 edge case 3: a chapter opening on a split continuation.
  it('§5: a chapter carved out mid-flow by promoteToChapter DOES fire — positional truth, pinned deliberately', () => {
    // The new chapter's first paragraph is the continuation of the flow the split cut. The
    // resolver cannot tell — and must not guess (§2: positional, never inferential): the author
    // made this a chapter, so it opens like one. The correction path is the author's own
    // undo/merge, never an inference here. This test PINS that decision.
    const source = createBook({ title: 'T', author: 'A', language: 'en' }, [
      chapter(
        [paragraph('p1', 'The flow begins.'), paragraph('p2', 'The New Chapter Title'), paragraph('p3', 'and continues mid-thought after the cut.')],
        { id: 'c-1', number: 1 }
      ),
    ]);
    const split = new BookEditingService(() => 'promoted-ch').promoteToChapter(source, 'p2');
    const styled = new ThemeEngine().applyTheme(split, trigger);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['p3']?.dropCap).toBe(true); // the promoted chapter opens on the continuation — and fires
    expect(result.blockTypography?.['p1']?.dropCap).toBe(true); // the remainder chapter still opens on p1
  });

  it('an empty-text first paragraph is not an opening — there is no letter to ornament', () => {
    const styled = styledWith(trigger, [chapter([paragraph('p-empty', '   '), paragraph('p-2', 'Real prose.')], { id: 'c-1' })]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['p-empty']?.dropCap).toBe(false);
    expect(result.blockTypography?.['p-2']?.dropCap).toBe(false); // and the rule does NOT slide to the next paragraph
  });

  it('the dropCaps:false option suppresses the theme trigger, same as the per-block path', () => {
    const styled = styledWith(trigger, [chapter([paragraph('p-1', 'Opening.')])]);

    expect(resolver.resolve(styled, { dropCaps: false }).blockTypography?.['p-1']?.dropCap).toBe(false);
  });

  it('the deprecated per-block path and the theme trigger union rather than exclude each other', () => {
    // Block.dropCap is deprecated-not-removed (§5 resolution in DECISIONS.md); while it exists,
    // a block that carries it keeps rendering — the trigger adds openings, it never subtracts.
    const styled = styledWith(trigger, [
      chapter([paragraph('c1-p1', 'Opening.'), dropCapParagraph('c1-p2', 'Explicitly marked mid-chapter.', true)], { id: 'c-1' }),
    ]);

    const result = resolver.resolve(styled);

    expect(result.blockTypography?.['c1-p1']?.dropCap).toBe(true);
    expect(result.blockTypography?.['c1-p2']?.dropCap).toBe(true);
  });
});
