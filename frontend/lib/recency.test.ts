import { describe, it, expect } from 'vitest';
import { recencyLabel } from './recency';

const NOW = new Date('2026-07-21T14:00:00.000Z');

describe('recencyLabel', () => {
  it('same day → today (even if only minutes apart or earlier that morning)', () => {
    expect(recencyLabel('2026-07-21T13:59:00.000Z', NOW)).toBe('Worked on today');
    expect(recencyLabel('2026-07-21T01:00:00.000Z', NOW)).toBe('Worked on today');
  });

  it('previous calendar day → yesterday (a date boundary, not a 24h window)', () => {
    expect(recencyLabel('2026-07-20T23:00:00.000Z', NOW)).toBe('Worked on yesterday');
  });

  it('a handful of days → N days ago', () => {
    expect(recencyLabel('2026-07-18T09:00:00.000Z', NOW)).toBe('Worked on 3 days ago');
  });

  it('a month or more → an absolute date (counting days stops being useful)', () => {
    expect(recencyLabel('2026-05-02T09:00:00.000Z', NOW)).toMatch(/^Last worked on May 2, 2026$/);
  });

  it('an unparseable stamp yields an empty label, never a crash or "NaN days"', () => {
    expect(recencyLabel('not-a-date', NOW)).toBe('');
  });
});
