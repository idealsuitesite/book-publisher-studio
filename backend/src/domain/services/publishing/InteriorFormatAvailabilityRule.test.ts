import { describe, it, expect } from 'vitest';
import { InteriorFormatAvailabilityRule } from './InteriorFormatAvailabilityRule';
import { createBook } from '../../models/Book';
import type { PublishingBundle } from '../../models/PublishingBundle';

function bundleWith(formatsIncluded: ('pdf' | 'epub' | 'docx')[]): PublishingBundle {
  return {
    manuscript: {},
    metadata: { title: 'T', author: 'A', language: 'en' },
    assets: [],
    manifest: { formatsIncluded, hasCover: false, assembledAt: new Date() },
  };
}

describe('InteriorFormatAvailabilityRule', () => {
  const rule = new InteriorFormatAvailabilityRule(['pdf', 'docx']); // KDP's real accepted set (ADR-0035)
  const book = createBook({ title: 'T', author: 'A', language: 'en' });

  it('reports no issues when pdf was rendered', () => {
    expect(rule.evaluate({ book, bundle: bundleWith(['pdf']) })).toHaveLength(0);
  });

  it('reports no issues when docx was rendered', () => {
    expect(rule.evaluate({ book, bundle: bundleWith(['docx']) })).toHaveLength(0);
  });

  it('reports an ERROR when only epub was rendered - not a KDP paperback interior format', () => {
    const issues = rule.evaluate({ book, bundle: bundleWith(['epub']) });

    expect(issues).toEqual([
      {
        code: 'NO_ACCEPTED_INTERIOR_FORMAT',
        message: "None of the rendered formats (epub) are accepted for this target's interior manuscript.",
        severity: 'ERROR',
      },
    ]);
  });

  it('reports an ERROR when no format was rendered at all', () => {
    const issues = rule.evaluate({ book, bundle: bundleWith([]) });

    expect(issues[0].message).toContain('(none)');
  });
});
