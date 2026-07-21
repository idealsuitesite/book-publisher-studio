import { describe, it, expect } from 'vitest';
import { LayoutEngine } from './LayoutEngine';
import { ThemeEngine } from './ThemeEngine';
import { ClassicTheme } from '../themes/ClassicTheme';
import { LetterPageLayout } from '../layouts/LetterPageLayout';
import { createBook } from '../models/Book';
import type { Chapter, Section, Paragraph } from '../models/Book';
import type { TextMeasurer } from '../ports/TextMeasurer';

/**
 * The ownsBarePage branch (PART_LEVEL_STRUCTURE commit 1): a titled, blockless, childless
 * TOP-LEVEL CHAPTER — the Part-opener shape — owns a page carrying the content's own id.
 * Every OTHER shape must paginate exactly as before the branch existed (the byte-identity
 * guard at unit level; the corpus-level guard is the parity locks, which contain no such
 * shape — measured by empty-shape-probe.ts).
 */
const fakeMeasurer: TextMeasurer = {
  measureHeight: () => 20,
  lineHeight: () => 14,
  measureWidth: (text) => text.length * 5,
  capHeight: () => 7,
};

const now = new Date();
const para = (id: string): Paragraph => ({ type: 'paragraph', id, text: 'Some real paragraph text.' });
const chapter = (id: string, number: number, title: string, blocks: Paragraph[], extra?: Partial<Chapter>): Chapter => ({
  type: 'chapter',
  id,
  number,
  title,
  content: blocks,
  createdAt: now,
  updatedAt: now,
  ...extra,
});
const section = (id: string, title: string, blocks: Paragraph[], extra?: Partial<Section>): Section => ({
  type: 'section',
  id,
  title,
  content: blocks,
  level: 1,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

const paginate = (mainContent: (Chapter | Section)[]) => {
  const book = createBook({ title: 'T', author: 'A', language: 'en' }, mainContent);
  const styled = new ThemeEngine().applyTheme(book, ClassicTheme);
  return new LayoutEngine(fakeMeasurer).paginate(styled, LetterPageLayout);
};

describe('ownsBarePage — the Part-opener shape owns a page', () => {
  it('a titled blockless childless top-level chapter gets its own page carrying the content id', () => {
    const opener = chapter('opener-1', 0, 'Part I: The Question', []);
    const { pages } = paginate([chapter('ch1', 1, 'One', [para('p1')]), opener, chapter('ch2', 2, 'Two', [para('p2')])]);

    expect(pages).toHaveLength(3);
    expect(pages[1].blocks).toEqual(['opener-1']); // the opener page holds ONLY its own id
    expect(pages[0].blocks).toEqual(['p1']);
    expect(pages[2].blocks).toEqual(['p2']);
  });

  it("openingPageStyle 'right' on an opener landing on an even page inserts the parity blank", () => {
    const opener = chapter('opener-1', 0, 'Part I', [], { openingPageStyle: 'right' });
    const { pages } = paginate([chapter('ch1', 1, 'One', [para('p1')]), opener]);

    const openerPage = pages.find((p) => p.blocks.includes('opener-1'));
    // ch1 is page 1; the opener would land on page 2 (even/verso) — 'right' forces one blank.
    expect(openerPage?.blankPagesBefore).toBe(1);
    expect(openerPage?.number).toBe(3);
  });

  it('the generated TOC resolves an opener page number via the content id fallback', () => {
    const opener = chapter('opener-1', 0, 'Part I', []);
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter('ch1', 1, 'One', [para('p1')]), opener]);
    const withToc = { ...book, frontMatter: { ...book.frontMatter, toc: { entries: [], generateAutomatically: true } } };
    const styled = new ThemeEngine().applyTheme(withToc, ClassicTheme);
    const { tableOfContents } = new LayoutEngine(fakeMeasurer).paginate(styled, LetterPageLayout);

    const entry = tableOfContents?.find((e) => e.title === 'Part I');
    expect(entry).toBeDefined();
    expect(entry?.pageNumber).toBe(2);
  });
});

describe('ownsBarePage — every other shape paginates exactly as before (byte-identity at unit level)', () => {
  it('an empty-content chapter WITH sections flows as before — no content-id page', () => {
    const withSections = chapter('ch-s', 1, 'Sectioned', [], { sections: [section('s1', 'S', [para('sp1')])] });
    const { pages } = paginate([withSections]);

    expect(pages.some((p) => p.blocks.includes('ch-s'))).toBe(false);
    expect(pages.some((p) => p.blocks.includes('sp1'))).toBe(true);
  });

  it('a blockless UNTITLED chapter stays invisible — the renderer draws nothing for it', () => {
    const untitled = chapter('ch-u', 1, '', []);
    const { pages } = paginate([chapter('ch1', 1, 'One', [para('p1')]), untitled]);

    expect(pages).toHaveLength(1);
    expect(pages.some((p) => p.blocks.includes('ch-u'))).toBe(false);
  });

  it('a blockless titled top-level SECTION gets no dedicated page (out-of-scope shape, disclosed)', () => {
    const bareSection = section('sec-b', 'Interlude', []);
    const { pages } = paginate([chapter('ch1', 1, 'One', [para('p1')]), bareSection]);

    expect(pages.some((p) => p.blocks.includes('sec-b'))).toBe(false);
  });

  it('an ordinary titled chapter with blocks never carries its own content id on a page', () => {
    const { pages } = paginate([chapter('ch1', 1, 'One', [para('p1'), para('p2')])]);

    expect(pages.some((p) => p.blocks.includes('ch1'))).toBe(false);
  });
});
