import { describe, it, expect } from 'vitest';
import { StructureSuggester } from './StructureSuggester';
import { classifyMarker } from './structureTaxonomy';
import { createBook } from '../../models/Book';
import type { Book, Chapter, Paragraph } from '../../models/Book';

/**
 * STRUCTURE_ASSIST commit 1 — the Domain foundation and the load-bearing BIDIRECTIONAL INVARIANT
 * (STRUCTURE_ASSIST_DR.md §3, CTO). This test exists from the first commit, before any API or UI,
 * because it is the property that governs everything: the suggester NEVER mutates the Book, and it
 * behaves correctly at BOTH poles — proposes on the under-structured book, stays silent-and-harmless
 * on the over-structured one. If making a later feature work ever requires bending this test, the
 * DESIGN is wrong, not the test (CTO).
 */

const now = new Date();
const para = (id: string, text: string): Paragraph => ({ type: 'paragraph', id, text });
const chapter = (id: string, title: string, content: Paragraph[]): Chapter => ({
  type: 'chapter', id, number: 1, title, content, createdAt: now, updatedAt: now,
});

// UNDER-structured (traversal 1 shape): one flat container; the author's CHAPTER/INTRODUCTION
// markers are ordinary BODY PARAGRAPHS the importer never turned into chapters.
function underStructuredBook(): Book {
  return createBook({ title: 'Under', author: 'A', language: 'en' }, [
    chapter('c0', 'Body', [
      para('p1', 'INTRODUCTION'),
      para('p2', 'Spiritual growth is one of the most misunderstood pursuits in the life of a believer.'),
      para('p3', 'CHAPTER 1'),
      para('p4', 'Throughout the Bible, blood occupies a sacred and judicial place.'),
      para('p5', 'Chapitre 2'),
      para('p6', 'This is ordinary prose that carries no marker and must never be flagged.'),
      para('p7', 'FOREWORD'),
    ]),
  ]);
}

// OVER-structured (traversal 2 shape): already chaptered — the markers are TITLES, the bodies are
// prose. The suggester must find ~nothing and, above all, add nothing.
function overStructuredBook(): Book {
  return createBook({ title: 'Over', author: 'A', language: 'en' }, [
    chapter('c1', 'INTRODUCTION', [para('p1', 'Before one can understand the necessity of the cross…')]),
    chapter('c2', 'CHAPTER 1', [para('p2', 'The doctrine of redemption did not begin at Calvary.')]),
    chapter('c3', 'THE HOLINESS OF GOD', [para('p3', 'The central attribute of divine revelation…')]),
  ]);
}

describe('StructureSuggester — the bidirectional invariant (STRUCTURE_ASSIST §3)', () => {
  it('THE INVARIANT — suggesting then discarding leaves the Book byte-identical (UNDER-structured)', () => {
    const book = underStructuredBook();
    const before = structuredClone(book);

    new StructureSuggester().suggest(book);

    expect(book).toEqual(before); // not one byte of the Book changed
  });

  it('THE INVARIANT — suggesting then discarding leaves the Book byte-identical (OVER-structured)', () => {
    const book = overStructuredBook();
    const before = structuredClone(book);

    new StructureSuggester().suggest(book);

    expect(book).toEqual(before);
  });

  it('UNDER-structured pole: proposes the typed markers (and NOT the prose)', () => {
    const suggestions = new StructureSuggester().suggest(underStructuredBook());

    expect(suggestions.map((s) => s.evidence)).toEqual(['INTRODUCTION', 'CHAPTER 1', 'Chapitre 2', 'FOREWORD']);
    // The promoted-body-sentence and the ordinary prose are correctly absent.
    expect(suggestions.some((s) => /Spiritual growth is one/.test(s.evidence))).toBe(false);
    expect(suggestions.some((s) => /ordinary prose/.test(s.evidence))).toBe(false);
    // Each carries a blockId to promote and its kind.
    expect(suggestions[0]).toMatchObject({ blockId: 'p1', kind: 'editorial', key: 'introduction' });
    expect(suggestions[1]).toMatchObject({ blockId: 'p3', kind: 'numbered-chapter', key: 'chapter' });
  });

  it('OVER-structured pole: ≈0 suggestions is a SUCCESS, not a detection failure (CTO)', () => {
    const suggestions = new StructureSuggester().suggest(overStructuredBook());

    // The markers are already chapter TITLES; the bodies are prose. Nothing to suggest, nothing
    // added — a suggester that stays silent when it has nothing to say is a good suggester.
    expect(suggestions).toEqual([]);
  });
});

// FOUNDER_TRAVERSAL_3 A2 — REPEATED_EDITORIAL_MARKERS. Synthetic fixtures reproduce the founder's
// book-3 pattern (an editorial name typed once per chapter ending); the real-book behavioural proof
// (keeps the 4 unique parts across books 1/2/3, drops the 26) lives in the probe
// backend/spikes/founder-hierarchy-signals.ts (PRIVATE_MANUSCRIPT_FIXTURES — no private file in CI).
describe('StructureSuggester — the repetition guard (REPEATED_EDITORIAL_MARKERS, N>1)', () => {
  const body = (paras: Paragraph[]): Book => createBook({ title: 'T', author: 'A', language: 'en' }, [chapter('c0', 'Body', paras)]);

  it('a UNIQUE canonical editorial name IS still proposed (the guard keeps true parts)', () => {
    const s = new StructureSuggester().suggest(body([
      para('p1', 'Introduction'), para('p2', 'Opening prose.'),
      para('p3', 'Conclusion'), para('p4', 'Closing prose.'),
    ]));
    expect(s.map((x) => x.evidence)).toEqual(['Introduction', 'Conclusion']); // each ×1 → both kept
  });

  it('a canonical editorial name repeated N>1 STOPS being proposed — ALL its occurrences drop', () => {
    const s = new StructureSuggester().suggest(body([
      para('p1', 'INTRODUCTION'), para('p2', 'Opening.'),
      para('p3', 'CHAPTER 1'), para('p4', 'One.'), para('p5', 'Conclusion'),   // per-chapter conclusion
      para('p6', 'CHAPTER 2'), para('p7', 'Two.'), para('p8', 'Conclusion'),   // again
      para('p9', 'CHAPTER 3'), para('p10', 'Three.'), para('p11', 'Conclusion'), // again → ×3
    ]));
    // The 3 recurring "Conclusion" are gone; the unique INTRODUCTION and the CHAPTER n markers stay.
    expect(s.map((x) => x.evidence)).toEqual(['INTRODUCTION', 'CHAPTER 1', 'CHAPTER 2', 'CHAPTER 3']);
    expect(s.some((x) => /conclusion/i.test(x.evidence))).toBe(false);
  });

  it('the threshold is exactly N>1: one occurrence kept, a second makes BOTH drop', () => {
    const once = new StructureSuggester().suggest(body([para('a', 'Conclusion'), para('b', 'x')]));
    expect(once.map((x) => x.evidence)).toEqual(['Conclusion']); // N=1 → kept

    const twice = new StructureSuggester().suggest(body([para('a', 'Conclusion'), para('b', 'x'), para('c', 'Conclusion')]));
    expect(twice).toEqual([]); // N=2 → both drop
  });

  it('case/variant occurrences count TOGETHER (keyed by canonical key, not raw text)', () => {
    // "Conclusion" and "conclusion:" both resolve to key 'conclusion' → N=2 → both drop.
    const s = new StructureSuggester().suggest(body([para('a', 'Conclusion'), para('b', 'x'), para('c', 'conclusion: the end')]));
    expect(s).toEqual([]);
  });

  it('numbered-chapter markers are UNTOUCHED even when duplicated (a repeated CHAPTER 8 is the author\'s content)', () => {
    const s = new StructureSuggester().suggest(body([
      para('p1', 'CHAPTER 8'), para('p2', 'First eight.'),
      para('p3', 'CHAPTER 8'), para('p4', 'Second eight.'),
    ]));
    expect(s.map((x) => x.evidence)).toEqual(['CHAPTER 8', 'CHAPTER 8']); // both kept — the guard is editorial-only
  });
});

describe('classifyMarker — exact discipline (the anti-absorption safeguard)', () => {
  it('matches editorial leading segments and numbered chapters (EN + FR)', () => {
    expect(classifyMarker('INTRODUCTION')).toMatchObject({ kind: 'editorial', key: 'introduction' });
    expect(classifyMarker('Conclusion: Nothing but Faith')).toMatchObject({ kind: 'editorial', key: 'conclusion' });
    expect(classifyMarker('Avant-propos')).toMatchObject({ kind: 'editorial', key: 'foreword' });
    expect(classifyMarker('CHAPTER 1')).toMatchObject({ kind: 'numbered-chapter' });
    expect(classifyMarker('Chapitre 12')).toMatchObject({ kind: 'numbered-chapter' });
    expect(classifyMarker('Chapter One')).toMatchObject({ kind: 'numbered-chapter' });
  });

  it('does NOT absorb a real chapter or ordinary prose', () => {
    expect(classifyMarker('Introduction to Quantum Fields')).toBeUndefined(); // whole segment, not "introduction"
    expect(classifyMarker('Chapter One: What Is Faith?')).toBeUndefined(); // leading segment "chapter one" is not editorial…
    expect(classifyMarker('The chapter of accidents')).toBeUndefined(); // not "<chapter-word> <number>"
    expect(classifyMarker('Spiritual growth is one of the most misunderstood pursuits.')).toBeUndefined();
    expect(classifyMarker('CHAPTER')).toBeUndefined(); // no number
  });
});
