import { describe, it, expect } from 'vitest';
import { StructurePresenceRule } from './StructurePresenceRule';
import { createBook } from '../../models/Book';
import type { Chapter, Section } from '../../models/Book';
import type { PublishingBundle } from '../../models/PublishingBundle';

function bundle(): PublishingBundle {
  return {
    manuscript: {},
    metadata: { title: 'T', author: 'A', language: 'en' },
    assets: [],
    manifest: { formatsIncluded: [], hasCover: true, assembledAt: new Date() },
  };
}

// The rule counts words from the AST ITSELF, never `book.wordCount` — the publish path
// rebuilds the book without metrics enrichment, and a test that hand-sets the enriched
// field would pass while the real path silently read 0 (found live). So these fixtures
// carry their words in real paragraph text.
function paragraphOf(words: number) {
  return { type: 'paragraph' as const, id: 'p-1', text: 'word '.repeat(words).trim() };
}

function chapter(words: number): Chapter {
  const now = new Date();
  return {
    type: 'chapter',
    id: 'c-1',
    number: 1,
    title: 'One',
    content: [paragraphOf(words)],
    createdAt: now,
    updatedAt: now,
  };
}

function anonymousSection(words: number): Section {
  const now = new Date();
  return {
    type: 'section',
    id: 's-1',
    level: 0,
    title: '',
    content: [paragraphOf(words)],
    createdAt: now,
    updatedAt: now,
  };
}

// PROVISIONAL by CTO amendment (ADR-0049): KDP-specific, never a generic publish rule.
describe('StructurePresenceRule', () => {
  const rule = new StructurePresenceRule();

  it('blocks KDP for a book-length manuscript with zero chapters', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [anonymousSection(3060)]);

    const issues = rule.evaluate({ book, bundle: bundle() });

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('UNSTRUCTURED_MANUSCRIPT');
    expect(issues[0].severity).toBe('ERROR');
  });

  it('stays silent below the word threshold - a short single-flow document is legitimate', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [anonymousSection(1424)]);

    expect(rule.evaluate({ book, bundle: bundle() })).toHaveLength(0);
  });

  it('stays silent when chapters exist, whatever the length', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }, [chapter(40_000)]);

    expect(rule.evaluate({ book, bundle: bundle() })).toHaveLength(0);
  });
});
