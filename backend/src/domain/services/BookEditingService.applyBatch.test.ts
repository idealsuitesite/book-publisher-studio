import { describe, it, expect } from 'vitest';
import { BookEditingService } from './BookEditingService';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';
import { createBook, type Book, type Chapter, type Section, type Paragraph, type Block } from '../models/Book';

/**
 * BATCH_CONFIRM_LATENCY correctif A — `applyBatch` (BATCH_CONFIRM_LATENCY_SCOPE.md §4 Option A).
 *
 * The two load-bearing properties the CTO named:
 *  - V3b: the ORDER LAW is the SERVER'S, computed from the book — a batch whose ids arrive in the
 *    WRONG (forward) order yields the SAME correct result as any other order. The old frontend loop
 *    carried the reverse-order law; deleting it must not silently lose the law. This is THE guard
 *    against the silent break.
 *  - Amendment 1 (atomicity): a batch that fails mid-course leaves the input book byte-identical —
 *    success ⇒ +1 (proven at the use-case layer, EditBookUseCase.test), failure ⇒ +0 and nothing
 *    half-transformed. Locked by assertion, not assumed.
 * Plus: collapse order-independence turned from a doc claim into a measured property (CTO validation).
 */

const OLD = new Date('2020-01-01T00:00:00Z');
const NOW = new Date('2026-07-23T00:00:00Z');
const para = (id: string, text: string): Paragraph => ({ type: 'paragraph', id, text });

// A fresh service with a DETERMINISTIC id generator so two runs with different input orders produce
// deep-equal books (the only non-determinism in the create ops is the minted id).
function freshService(): BookEditingService {
  let n = 0;
  return new BookEditingService(() => `gen-${n++}`);
}
const runBatch = (book: Book, op: 'promoteToChapter' | 'promoteToSubsection' | 'collapseMarker', ids: string[]): Book =>
  freshService().applyBatch(book, op, ids, NOW);

// Order-independence is a claim about the resulting book STRUCTURE, not its timestamp metadata: a
// chapter transiently renumbered on one apply path carries a bumped updatedAt the other path doesn't,
// and createBook stamps a wall-clock updatedAt. Strip both so the comparison measures the real property.
const stripTimes = (book: Book): unknown =>
  JSON.parse(JSON.stringify(book, (k, v) => (k === 'createdAt' || k === 'updatedAt' ? undefined : v)));

const allText = (book: Book): string[] => {
  const out: string[] = [];
  const push = (blocks: Block[]) => blocks.forEach((b) => 'text' in b && b.text && out.push(b.text));
  const walk = (cs: (Chapter | Section)[]) =>
    cs.forEach((c) => {
      out.push(c.title);
      push(c.content);
      if (c.type === 'chapter' && c.sections) walk(c.sections);
      if (c.type === 'section' && c.subsections) walk(c.subsections);
    });
  walk(book.mainContent as (Chapter | Section)[]);
  return out.filter(Boolean);
};

// --- promoteToChapter: markers interspersed in ONE top-level preamble (the real assist case) ---
function preambleWithTwoMarkers(): Book {
  const preamble: Section = {
    type: 'section',
    id: 's0',
    title: '',
    level: 0,
    content: [para('a', 'Intro prose.'), para('m1', 'CHAPTER 1'), para('b', 'Body one.'), para('m2', 'CHAPTER 2'), para('c', 'Body two.')],
    createdAt: OLD,
    updatedAt: OLD,
  };
  return createBook({ title: 'T', author: 'A', language: 'en' }, [preamble]);
}

describe('applyBatch — promoteToChapter order law is the SERVER\'s, not the client array (V3b)', () => {
  it('ids in FORWARD (wrong-for-greedy) order still yield the correct two chapters, nothing lost', () => {
    const out = runBatch(preambleWithTwoMarkers(), 'promoteToChapter', ['m1', 'm2']); // forward = the trap
    const titles = out.mainContent.map((c) => c.title);
    expect(titles).toEqual(['', 'CHAPTER 1', 'CHAPTER 2']); // preamble kept (has 'a'), then the two chapters in order
    const chapters = out.mainContent.filter((c) => c.type === 'chapter') as Chapter[];
    expect(chapters.map((c) => c.number)).toEqual([1, 2]);
    expect(chapters[0].content.map((b) => (b as Paragraph).text)).toEqual(['Body one.']);
    expect(chapters[1].content.map((b) => (b as Paragraph).text)).toEqual(['Body two.']);
    // nothing lost: every original text survives (marker texts became chapter titles)
    expect(allText(out).sort()).toEqual(['Body one.', 'Body two.', 'CHAPTER 1', 'CHAPTER 2', 'Intro prose.']);
  });

  it('forward, reverse and shuffled client orders all produce the DEEP-EQUAL book', () => {
    const src = preambleWithTwoMarkers(); // one source (pure ops don't mutate it) → same book id
    const forward = runBatch(src, 'promoteToChapter', ['m1', 'm2']);
    const reverse = runBatch(src, 'promoteToChapter', ['m2', 'm1']);
    expect(stripTimes(reverse)).toEqual(stripTimes(forward)); // the client's order cannot change the outcome
  });
});

// --- promoteToSubsection: two recurring markers in ONE chapter (greedy-swallow risk within a chapter) ---
function chapterWithTwoMarkers(): Book {
  const ch: Chapter = {
    type: 'chapter',
    id: 'c1',
    number: 1,
    title: 'One',
    content: [para('a', 'Body.'), para('m1', 'Conclusion'), para('x', 'Closing.'), para('m2', 'Summary'), para('y', 'More.')],
    createdAt: OLD,
    updatedAt: OLD,
  };
  return createBook({ title: 'T', author: 'A', language: 'en' }, [ch]);
}

describe('applyBatch — promoteToSubsection order law server-side, nothing lost', () => {
  it('forward ids → both sections created, no prose swallowed, chapter count unchanged', () => {
    const out = runBatch(chapterWithTwoMarkers(), 'promoteToSubsection', ['m1', 'm2']); // forward
    expect(out.mainContent).toHaveLength(1); // still one chapter — no peer chapter created
    const chapter = out.mainContent[0] as Chapter;
    expect((chapter.sections ?? []).map((s) => s.title).sort()).toEqual(['Conclusion', 'Summary']);
    expect(allText(out).sort()).toEqual(['Body.', 'Closing.', 'Conclusion', 'More.', 'One', 'Summary']);
  });

  it('forward vs reverse client order → structurally equal book (order ignored)', () => {
    const src = chapterWithTwoMarkers();
    expect(stripTimes(runBatch(src, 'promoteToSubsection', ['m2', 'm1']))).toEqual(
      stripTimes(runBatch(src, 'promoteToSubsection', ['m1', 'm2']))
    );
  });
});

// --- collapseMarker: order-independence, measured (CTO validation: convert the doc claim to a property) ---
function twoEmptyMarkers(): Book {
  const marker = (id: string, title: string): Chapter => ({ type: 'chapter', id, number: 0, title, content: [], createdAt: OLD, updatedAt: OLD });
  const real = (id: string, number: number, title: string): Chapter => ({
    type: 'chapter', id, number, title, content: [para(`${id}-p`, 'Prose.')], createdAt: OLD, updatedAt: OLD,
  });
  return createBook({ title: 'T', author: 'A', language: 'en' }, [
    marker('mkA', 'CHAPTER 1'), real('r1', 1, 'The Beginning'),
    marker('mkB', 'CHAPTER 2'), real('r2', 2, 'The Middle'),
  ]);
}

describe('applyBatch — collapseMarker is order-independent (measured, not just documented)', () => {
  it('[A,B] and [B,A] produce the structurally equal book', () => {
    const src = twoEmptyMarkers();
    expect(stripTimes(runBatch(src, 'collapseMarker', ['mkB', 'mkA']))).toEqual(
      stripTimes(runBatch(src, 'collapseMarker', ['mkA', 'mkB']))
    );
  });
  it('both markers removed, followers survive and renumber', () => {
    const out = runBatch(twoEmptyMarkers(), 'collapseMarker', ['mkA', 'mkB']);
    expect(out.mainContent.map((c) => c.title)).toEqual(['The Beginning', 'The Middle']);
    expect((out.mainContent as Chapter[]).map((c) => c.number)).toEqual([1, 2]);
  });
});

// --- Atomicity (CTO amendment 1): a failing batch leaves the input book byte-identical ---
describe('applyBatch — atomic: a mid-course failure leaves the input book byte-identical', () => {
  it('an unknown id throws ContentNotFoundError and mutates nothing (pure — input untouched)', () => {
    const book = preambleWithTwoMarkers();
    const before = structuredClone(book);
    expect(() => freshService().applyBatch(book, 'promoteToChapter', ['m1', 'does-not-exist'], NOW)).toThrow(ContentNotFoundError);
    expect(book).toEqual(before); // no half-transformed book left behind
  });

  it('an empty id list is refused (no silent no-op that would snapshot a phantom version)', () => {
    expect(() => freshService().applyBatch(preambleWithTwoMarkers(), 'promoteToChapter', [], NOW)).toThrow(ContentNotFoundError);
  });
});
