import { describe, it, expect } from 'vitest';
import { PageCountRule } from './PageCountRule';
import { createBook } from '../../models/Book';
import { KDP6x9PageLayout } from '../../layouts/KDP6x9PageLayout';
import type { PublishingBundle } from '../../models/PublishingBundle';
import type { RenderedOutputs } from '../../models/PublishingReport';

/** A bundle whose rendered artifacts carry real render-time metrics (ADR-0042). */
function bundle(manuscript: RenderedOutputs = {}): PublishingBundle {
  return {
    manuscript,
    metadata: { title: 'T', author: 'A', language: 'en' },
    assets: [],
    manifest: { formatsIncluded: [], hasCover: false, assembledAt: new Date() },
  };
}

const pdf = (pageCount?: number): RenderedOutputs => ({
  pdf: { bytes: Buffer.from('pdf'), metrics: { pageCount, pageLayout: KDP6x9PageLayout } },
});

const book = () => createBook({ title: 'T', author: 'A', language: 'en' });

describe('PageCountRule', () => {
  const rule = new PageCountRule(24, 828, 'pdf');

  it("reports no issues when the real page count is within KDP's 24-828 range", () => {
    expect(rule.evaluate({ book: book(), bundle: bundle(pdf(200)) })).toHaveLength(0);
  });

  it('reports an ERROR when the real page count is below the minimum', () => {
    const issues = rule.evaluate({ book: book(), bundle: bundle(pdf(10)) });

    expect(issues).toEqual([
      {
        code: 'PAGE_COUNT_OUT_OF_RANGE',
        message: 'Page count 10 is outside the accepted range of 24-828.',
        severity: 'ERROR',
      },
    ]);
  });

  it('reports an ERROR when the real page count is above the maximum', () => {
    expect(rule.evaluate({ book: book(), bundle: bundle(pdf(900)) })[0].code).toBe(
      'PAGE_COUNT_OUT_OF_RANGE'
    );
  });

  it('reports a WARNING, not an ERROR, when the artifact carries no page count', () => {
    const issues = rule.evaluate({ book: book(), bundle: bundle(pdf(undefined)) });

    expect(issues).toEqual([
      {
        code: 'PAGE_COUNT_UNKNOWN',
        message: 'Page count could not be determined for the pdf interior.',
        severity: 'WARNING',
      },
    ]);
  });

  it('reports UNKNOWN when the artifact it validates was never rendered', () => {
    expect(rule.evaluate({ book: book(), bundle: bundle({}) })[0].code).toBe('PAGE_COUNT_UNKNOWN');
  });
});

describe('PageCountRule - never falls back to the estimate (ADR-0042, the load-bearing rule)', () => {
  const rule = new PageCountRule(24, 828, 'pdf');

  it('ignores book.pageCount entirely when the artifact has no real count', () => {
    // A book carrying a comfortable *estimate* of 200 pages, rendered without metrics.
    // Falling back would report PASS. KDP rejects on the real count, so a PASS here would be a
    // false green on a book Amazon may refuse - the whole point of Decision 4.
    const estimated = { ...book(), pageCount: 200 };

    const issues = rule.evaluate({ book: estimated, bundle: bundle(pdf(undefined)) });

    expect(issues[0].code).toBe('PAGE_COUNT_UNKNOWN');
  });

  it('trusts the real count over a contradicting estimate', () => {
    // Estimate says 200 (fine); real pagination says 12 (below KDP's minimum). The real one wins.
    const estimated = { ...book(), pageCount: 200 };

    const issues = rule.evaluate({ book: estimated, bundle: bundle(pdf(12)) });

    expect(issues[0].code).toBe('PAGE_COUNT_OUT_OF_RANGE');
    expect(issues[0].message).toContain('12');
  });
});

describe('PageCountRule - validates the artifact it was configured for', () => {
  it('a rule configured for epub ignores the pdf metrics', () => {
    const epubRule = new PageCountRule(24, 828, 'epub');

    // A reflowable EPUB genuinely has no page count - absence is a real answer, not a gap.
    const issues = epubRule.evaluate({ book: book(), bundle: bundle(pdf(200)) });

    expect(issues[0].code).toBe('PAGE_COUNT_UNKNOWN');
    expect(issues[0].message).toContain('epub');
  });
});
