import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createBook, type Book, type Content, type Chapter, type Section, type Block, type Paragraph } from '../models/Book';
import { BookEditingService } from './BookEditingService';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';
import { MammothParser } from '../../infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../../infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from './ASTBuilder';

const NOW = new Date('2026-07-21T12:00:00Z');
const OLD = new Date('2020-01-01T00:00:00Z');

function section(id: string, title: string, level: number, subs: Section[] = []): Section {
  return { type: 'section', id, title, content: [], subsections: subs, level, createdAt: OLD, updatedAt: OLD };
}
function chapter(id: string, number: number, title: string, sections: Section[] = []): Chapter {
  return { type: 'chapter', id, number, title, content: [], sections, createdAt: OLD, updatedAt: OLD };
}

/** A representative nested structure: 3 chapters, sections, and a subsection. */
function sampleBook(): Book {
  return createBook({ title: 'T', author: 'A', language: 'en' }, [
    chapter('c1', 1, 'Chapter One', [section('s1a', 'Sec 1a', 2, [section('ss1', 'Sub', 3)]), section('s1b', 'Sec 1b', 2)]),
    chapter('c2', 2, 'Chapter Two', [section('s2a', 'Sec 2a', 2)]),
    chapter('c3', 3, 'Chapter Three'),
  ]);
}

/** Every chapter/section node in the tree, depth-first. */
function nodes(contents: Content[]): { id: string; title: string }[] {
  return contents.flatMap((c) => {
    const nested = c.type === 'chapter' ? c.sections : c.subsections;
    return [{ id: c.id, title: c.title }, ...(nested ? nodes(nested) : [])];
  });
}

const service = new BookEditingService();

describe('BookEditingService — reorderChapters (property-style, exhaustive over the structure)', () => {
  const n = sampleBook().mainContent.length;

  for (let from = 0; from < n; from++) {
    for (let to = 0; to < n; to++) {
      it(`move ${from}->${to}: preserves the chapter set, lands the moved chapter at ${to}, renumbers 1..N`, () => {
        const book = sampleBook();
        const originalIds = book.mainContent.map((c) => c.id);
        const result = service.reorderChapters(book, from, to, NOW);

        // same set of chapters, none lost or duplicated
        expect([...result.mainContent.map((c) => c.id)].sort()).toEqual([...originalIds].sort());
        // the moved chapter is at `to`
        expect(result.mainContent[to].id).toBe(originalIds[from]);
        // chapters renumbered to reading order
        result.mainContent.forEach((c, i) => {
          if (c.type === 'chapter') expect(c.number).toBe(i + 1);
        });
        // ORIGINAL is untouched (immutability, ADR-0001)
        expect(book.mainContent.map((c) => c.id)).toEqual(originalIds);
        expect((book.mainContent[0] as Chapter).number).toBe(1);
      });
    }
  }

  it('out-of-range indices throw ContentNotFoundError', () => {
    expect(() => service.reorderChapters(sampleBook(), -1, 0)).toThrow(ContentNotFoundError);
    expect(() => service.reorderChapters(sampleBook(), 0, 99)).toThrow(ContentNotFoundError);
  });

  it('a no-op move (from === to) preserves order and numbers', () => {
    const result = service.reorderChapters(sampleBook(), 1, 1, NOW);
    expect(result.mainContent.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });
});

describe('BookEditingService — rename (property-style, exhaustive over every node)', () => {
  for (const target of nodes(sampleBook().mainContent)) {
    it(`renames "${target.id}" and leaves every other node untouched`, () => {
      const book = sampleBook();
      const result = service.rename(book, target.id, 'RENAMED', NOW);

      const after = nodes(result.mainContent);
      for (const node of after) {
        const before = nodes(book.mainContent).find((b) => b.id === node.id)!;
        expect(node.title).toBe(node.id === target.id ? 'RENAMED' : before.title);
      }
      // structure preserved: same id tree
      expect(after.map((x) => x.id)).toEqual(nodes(book.mainContent).map((x) => x.id));
      // ORIGINAL untouched
      expect(nodes(book.mainContent).find((b) => b.id === target.id)!.title).toBe(target.title);
    });
  }

  it('renaming a nonexistent id throws ContentNotFoundError', () => {
    expect(() => service.rename(sampleBook(), 'does-not-exist', 'X')).toThrow(ContentNotFoundError);
  });

  it('the edited node advances updatedAt; the original instance keeps its old timestamp', () => {
    const book = sampleBook();
    const result = service.rename(book, 's1a', 'X', NOW);
    const editedSection = (result.mainContent[0] as Chapter).sections![0];
    expect(editedSection.updatedAt).toBe(NOW);
    expect((book.mainContent[0] as Chapter).sections![0].updatedAt).toBe(OLD); // original unmutated
  });
});

// ── CREATE_CHAPTER.md: promoteToChapter + mergeChapterIntoPrevious ───────────────────────────────
const para = (id: string, text: string): Paragraph => ({ type: 'paragraph', id, text });
/** A 0-chapter manuscript's shape: one untitled section holding blocks. */
function unstructuredBook(blocks: Block[]): Book {
  return createBook({ title: 'T', author: 'A', language: 'en' }, [
    { type: 'section', id: 'sec', title: '', content: blocks, level: 1, createdAt: OLD, updatedAt: OLD },
  ]);
}
/** Ids are irrelevant to structure; a deterministic generator keeps the created chapter findable. */
const withIds = () => new BookEditingService((() => { let n = 0; return () => `gen-${++n}`; })());
/** Structural projection: types + titles + block texts, ignoring ids/numbers/timestamps. */
function projection(contents: Content[]): unknown {
  return contents.map((c) => ({
    type: c.type,
    title: c.title,
    blocks: c.content.map((b) => `${b.type}:${'text' in b ? b.text : ''}`),
    children: projection(c.type === 'chapter' ? (c.sections ?? []) : (c.subsections ?? [])),
  }));
}

describe('BookEditingService — promoteToChapter', () => {
  it('splits an untitled section at a middle block: remainder kept, block becomes the chapter title', () => {
    const book = unstructuredBook([para('b1', 'One'), para('b2', 'Two'), para('b3', 'Three')]);
    const result = withIds().promoteToChapter(book, 'b2', NOW);

    expect(result.mainContent).toHaveLength(2);
    const [remainder, chapter] = result.mainContent;
    expect(remainder.type).toBe('section');
    expect(remainder.content.map((b) => (b as Paragraph).text)).toEqual(['One']);
    expect(chapter.type).toBe('chapter');
    expect(chapter.title).toBe('Two');
    expect((chapter as Chapter).number).toBe(1);
    expect(chapter.content.map((b) => (b as Paragraph).text)).toEqual(['Three']);
    // original untouched
    expect(book.mainContent).toHaveLength(1);
  });

  it('drops an untitled section left empty when its FIRST block is promoted (§9.3, no phantom section)', () => {
    const book = unstructuredBook([para('b1', 'One'), para('b2', 'Two')]);
    const result = withIds().promoteToChapter(book, 'b1', NOW);

    expect(result.mainContent).toHaveLength(1);
    expect(result.mainContent[0].type).toBe('chapter');
    expect(result.mainContent[0].title).toBe('One');
    expect(result.mainContent[0].content.map((b) => (b as Paragraph).text)).toEqual(['Two']);
  });

  it('keeps a TITLED container even when the split leaves it empty (it has a title worth preserving)', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      { type: 'chapter', id: 'c1', number: 1, title: 'Kept', content: [para('b1', 'Only')], createdAt: OLD, updatedAt: OLD },
    ]);
    const result = withIds().promoteToChapter(book, 'b1', NOW);
    expect(result.mainContent.map((c) => c.title)).toEqual(['Kept', 'Only']);
    expect(result.mainContent[0].content).toHaveLength(0); // titled chapter kept though empty
  });

  it('renumbers chapters after the insert', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      { type: 'chapter', id: 'c1', number: 1, title: 'A', content: [para('b1', 'x'), para('b2', 'Split here')], createdAt: OLD, updatedAt: OLD },
      { type: 'chapter', id: 'c2', number: 2, title: 'B', content: [], createdAt: OLD, updatedAt: OLD },
    ]);
    const result = withIds().promoteToChapter(book, 'b2', NOW);
    const numbers = result.mainContent.filter((c) => c.type === 'chapter').map((c) => (c as Chapter).number);
    expect(numbers).toEqual([1, 2, 3]);
  });

  it('throws ContentNotFoundError for an unknown block, and for a non-text block', () => {
    const book = unstructuredBook([para('b1', 'One'), { type: 'divider', id: 'd1' }]);
    expect(() => withIds().promoteToChapter(book, 'nope', NOW)).toThrow(ContentNotFoundError);
    expect(() => withIds().promoteToChapter(book, 'd1', NOW)).toThrow(ContentNotFoundError);
  });
});

describe('BookEditingService — mergeChapterIntoPrevious', () => {
  it('is the exact inverse of a non-first-block promote (round-trip identity, synthetic)', () => {
    const book = unstructuredBook([para('b1', 'One'), para('b2', 'Two'), para('b3', 'Three')]);
    const svc = withIds();
    const promoted = svc.promoteToChapter(book, 'b2', NOW);
    const newChapterId = promoted.mainContent[1].id;
    const merged = svc.mergeChapterIntoPrevious(promoted, newChapterId, NOW);
    expect(projection(merged.mainContent)).toEqual(projection(book.mainContent));
  });

  it('disallows merging the first chapter — §9.1 (throws; version-undo is the exit)', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [
      { type: 'chapter', id: 'c1', number: 1, title: 'A', content: [], createdAt: OLD, updatedAt: OLD },
    ]);
    expect(() => withIds().mergeChapterIntoPrevious(book, 'c1', NOW)).toThrow(ContentNotFoundError);
  });

  it('throws for an unknown chapter id', () => {
    expect(() => withIds().mergeChapterIntoPrevious(sampleBook(), 'nope', NOW)).toThrow(ContentNotFoundError);
  });
});

// Round-trip identity on REAL manuscripts (CTO: not only the degenerate 0-chapter case, but also
// faith-alone — a book that already has chapters, a non-degenerate multi-container context).
async function importCorpus(file: string): Promise<Book> {
  const raw = await new MammothParser().parse(readFileSync(join(__dirname, '..', '..', '..', 'verification', 'corpus', file)));
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: file });
  return new ASTBuilder().build(normalized);
}
/** First top-level container with a promotable text block that is NOT its first block (so the
 * remainder is kept and the new chapter is not at index 0 — the round-trippable case). */
function nonFirstPromotableBlockId(book: Book): string {
  for (const c of book.mainContent) {
    const idx = c.content.findIndex((b) => b.type === 'paragraph' || b.type === 'heading');
    if (idx > 0) return c.content[idx].id;
    if (idx === 0) {
      const second = c.content.slice(1).find((b) => b.type === 'paragraph' || b.type === 'heading');
      if (second) return second.id;
    }
  }
  throw new Error('no non-first promotable block found');
}

describe('BookEditingService — promote→merge round-trip on real manuscripts (CTO)', () => {
  it('0-chapter manuscript: promoting a paragraph then merging back restores the content', async () => {
    const book = await importCorpus('generated-unstyled-3060w.docx');
    const svc = withIds();
    const blockId = nonFirstPromotableBlockId(book);
    const promoted = svc.promoteToChapter(book, blockId, NOW);
    const newChapter = promoted.mainContent.find((c) => c.type === 'chapter')!;
    const merged = svc.mergeChapterIntoPrevious(promoted, newChapter.id, NOW);
    expect(projection(merged.mainContent)).toEqual(projection(book.mainContent));
  }, 30_000);

  it('faith-alone (already chaptered): promote a paragraph in a chapter, merge back, structure restored', async () => {
    const book = await importCorpus('faith-alone-styled.docx');
    const svc = withIds();
    const blockId = nonFirstPromotableBlockId(book);
    const promoted = svc.promoteToChapter(book, blockId, NOW);
    // the new chapter is the one whose id is not in the original set
    const originalIds = new Set(book.mainContent.map((c) => c.id));
    const newChapter = promoted.mainContent.find((c) => c.type === 'chapter' && !originalIds.has(c.id))!;
    const merged = svc.mergeChapterIntoPrevious(promoted, newChapter.id, NOW);
    expect(projection(merged.mainContent)).toEqual(projection(book.mainContent));
  }, 30_000);
});

// ── MINI_DR_EDITORIAL_PLACEMENT: setPartRole ─────────────────────────────────────────────────────
describe('BookEditingService — setPartRole', () => {
  const roleOf = (book: Book, id: string) => book.mainContent.find((c) => c.id === id)?.role;

  it('tags a top-level part front or back', () => {
    expect(roleOf(service.setPartRole(sampleBook(), 'c1', 'front', NOW), 'c1')).toBe('front');
    expect(roleOf(service.setPartRole(sampleBook(), 'c3', 'back', NOW), 'c3')).toBe('back');
  });

  it("clears the tag with 'main', leaving no role property", () => {
    const tagged = service.setPartRole(sampleBook(), 'c1', 'front', NOW);
    const cleared = service.setPartRole(tagged, 'c1', 'main', NOW);
    expect(roleOf(cleared, 'c1')).toBeUndefined();
    expect('role' in cleared.mainContent[0]).toBe(false); // property removed, not set to undefined
  });

  it('only tags TOP-LEVEL parts — a nested section id is not found', () => {
    // 's1a' is a section inside c1, not a top-level part; roles live only on mainContent entries.
    expect(() => service.setPartRole(sampleBook(), 's1a', 'front', NOW)).toThrow(ContentNotFoundError);
  });

  it('throws for an unknown id and never mutates the input', () => {
    const book = sampleBook();
    expect(() => service.setPartRole(book, 'nope', 'front', NOW)).toThrow(ContentNotFoundError);
    expect(book.mainContent.every((c) => c.role === undefined)).toBe(true); // input untouched
  });
});

// ── MINI_DR_CALLOUTS commit 1: setCallout ────────────────────────────────────────────────────────
// The author's marking gesture — the producer that ships WITH the capability (the C1-trap exit,
// CALLOUTS_SCOPE.md §3). Generic per the CTO's D2 (no kind taxonomy); Shape B per §2 (an additive
// Paragraph field, no Block-union extension).

function calloutPara(id: string, text = 'Body text.'): Paragraph {
  return { type: 'paragraph', id, text };
}

/** Paragraph-bearing structure at every depth: chapter-direct, in a section, in a subsection. */
function calloutBook(): Book {
  const sub: Section = { ...section('sub1', 'Sub', 3), content: [calloutPara('p-sub')] };
  const sec: Section = { ...section('sec1', 'Sec', 2, [sub]), content: [calloutPara('p-sec')] };
  const ch: Chapter = { ...chapter('ch1', 1, 'One', [sec]), content: [calloutPara('p-top'), { type: 'heading', id: 'h1', level: 2, text: 'H' } as Block] };
  return createBook({ title: 'T', author: 'A', language: 'en' }, [ch]);
}

describe('BookEditingService — setCallout (MINI_DR_CALLOUTS commit 1)', () => {
  const flagOf = (book: Book, path: 'top' | 'sec' | 'sub'): true | undefined => {
    const ch = book.mainContent[0] as Chapter;
    if (path === 'top') return (ch.content[0] as Paragraph).callout;
    const sec = ch.sections![0];
    if (path === 'sec') return (sec.content[0] as Paragraph).callout;
    return (sec.subsections![0].content[0] as Paragraph).callout;
  };

  it('marks a paragraph at ANY depth — chapter-direct, section, subsection', () => {
    expect(flagOf(service.setCallout(calloutBook(), 'p-top', true), 'top')).toBe(true);
    expect(flagOf(service.setCallout(calloutBook(), 'p-sec', true), 'sec')).toBe(true);
    expect(flagOf(service.setCallout(calloutBook(), 'p-sub', true), 'sub')).toBe(true);
  });

  it('unmarking removes the property entirely — round-trip is EXACT identity (no timestamp on Paragraph)', () => {
    const original = calloutBook();
    const marked = service.setCallout(original, 'p-sec', true);
    const back = service.setCallout(marked, 'p-sec', false);
    expect('callout' in ((back.mainContent[0] as Chapter).sections![0].content[0] as Paragraph)).toBe(false);
    // The strongest identity this model allows: strict deep equality of the whole content tree.
    expect(back.mainContent).toEqual(original.mainContent);
  });

  it('rejects a no-op toggle as malformed — marking the already-marked, unmarking the unmarked', () => {
    const marked = service.setCallout(calloutBook(), 'p-top', true);
    expect(() => service.setCallout(marked, 'p-top', true)).toThrow(ContentNotFoundError);
    expect(() => service.setCallout(calloutBook(), 'p-top', false)).toThrow(ContentNotFoundError);
  });

  it('only paragraphs can be callouts — a heading id is not a valid target (quotes/lists stay out, v1 boundary)', () => {
    expect(() => service.setCallout(calloutBook(), 'h1', true)).toThrow(ContentNotFoundError);
  });

  it('throws for an unknown id and never mutates the input', () => {
    const book = calloutBook();
    expect(() => service.setCallout(book, 'ghost', true)).toThrow(ContentNotFoundError);
    expect(flagOf(book, 'top')).toBeUndefined();
  });

  it('real-fixture round-trip (faith-alone): mark then unmark is byte-equal on the whole tree', async () => {
    const book = await importCorpus('faith-alone-styled.docx');
    const target = book.mainContent.flatMap((c) => c.content).find((b) => b.type === 'paragraph')!;
    const marked = service.setCallout(book, target.id, true);
    expect(marked).not.toEqual(book); // the mark is a real change (a genuine cache MISS later)
    const back = service.setCallout(marked, target.id, false);
    expect(back.mainContent).toEqual(book.mainContent);
  }, 30_000);
});
