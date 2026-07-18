import { describe, it, expect } from 'vitest';
import { PageCountRule } from './PageCountRule';
import { createBook } from '../../models/Book';
import type { PublishingBundle } from '../../models/PublishingBundle';

function bundle(): PublishingBundle {
  return { manuscript: {}, metadata: { title: 'T', author: 'A', language: 'en' }, assets: [], manifest: { formatsIncluded: [], hasCover: false, assembledAt: new Date() } };
}

describe('PageCountRule', () => {
  const rule = new PageCountRule(24, 828);

  it('reports no issues when page count is within KDP\'s real 24-828 range', () => {
    const book = { ...createBook({ title: 'T', author: 'A', language: 'en' }), pageCount: 200 };

    expect(rule.evaluate({ book, bundle: bundle() })).toHaveLength(0);
  });

  it('reports an ERROR when page count is below the minimum', () => {
    const book = { ...createBook({ title: 'T', author: 'A', language: 'en' }), pageCount: 10 };

    const issues = rule.evaluate({ book, bundle: bundle() });

    expect(issues).toEqual([
      { code: 'PAGE_COUNT_OUT_OF_RANGE', message: 'Page count 10 is outside the accepted range of 24-828.', severity: 'ERROR' },
    ]);
  });

  it('reports an ERROR when page count is above the maximum', () => {
    const book = { ...createBook({ title: 'T', author: 'A', language: 'en' }), pageCount: 900 };

    const issues = rule.evaluate({ book, bundle: bundle() });

    expect(issues[0].code).toBe('PAGE_COUNT_OUT_OF_RANGE');
  });

  it('reports a WARNING, not an ERROR, when page count could not be determined', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' }); // pageCount left undefined

    const issues = rule.evaluate({ book, bundle: bundle() });

    expect(issues).toEqual([
      { code: 'PAGE_COUNT_UNKNOWN', message: 'Page count could not be determined.', severity: 'WARNING' },
    ]);
  });
});
