import { describe, it, expect } from 'vitest';
import { CoverPresenceRule } from './CoverPresenceRule';
import { createBook } from '../../models/Book';
import type { PublishingBundle } from '../../models/PublishingBundle';

function bundleWith(hasCover: boolean): PublishingBundle {
  return {
    manuscript: {},
    metadata: { title: 'T', author: 'A', language: 'en' },
    assets: [],
    manifest: { formatsIncluded: [], hasCover, assembledAt: new Date() },
  };
}

describe('CoverPresenceRule', () => {
  const rule = new CoverPresenceRule();
  const book = createBook({ title: 'T', author: 'A', language: 'en' });

  it('reports no issues when the bundle has a cover', () => {
    expect(rule.evaluate({ book, bundle: bundleWith(true) })).toHaveLength(0);
  });

  it('reports a WARNING, not an ERROR, when no cover is present (real ASTBuilder gap, Risk 4)', () => {
    const issues = rule.evaluate({ book, bundle: bundleWith(false) });

    expect(issues).toEqual([
      { code: 'NO_COVER_IMAGE', message: 'No cover image was found in the manuscript.', severity: 'WARNING' },
    ]);
  });
});
