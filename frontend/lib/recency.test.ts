import { describe, it, expect } from 'vitest';
import { recencyLabel } from './recency';

// recencyLabel works in LOCAL calendar days (that is what an author's "today" means), so the
// fixtures are built from local components — an earlier version used Z-suffixed ISO strings,
// which silently shift a day on any non-UTC machine (caught on a UTC+1 host at the midnight
// boundary): the test must be deterministic in every timezone, like the function it locks.
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const NOW = new Date(2026, 6, 21, 14, 0); // 2026-07-21 14:00 local

describe('recencyLabel', () => {
  it('same local day → today (even if only minutes apart or earlier that morning)', () => {
    expect(recencyLabel(local(2026, 7, 21, 13), NOW)).toBe('Worked on today');
    expect(recencyLabel(local(2026, 7, 21, 1), NOW)).toBe('Worked on today');
  });

  it('previous local calendar day → yesterday (a date boundary, not a 24h window)', () => {
    expect(recencyLabel(local(2026, 7, 20, 23), NOW)).toBe('Worked on yesterday');
  });

  it('a handful of days → N days ago', () => {
    expect(recencyLabel(local(2026, 7, 18, 9), NOW)).toBe('Worked on 3 days ago');
  });

  it('a month or more → an absolute date (counting days stops being useful)', () => {
    expect(recencyLabel(local(2026, 5, 2, 9), NOW)).toBe('Last worked on May 2, 2026');
  });

  it('an unparseable stamp yields an empty label, never a crash or "NaN days"', () => {
    expect(recencyLabel('not-a-date', NOW)).toBe('');
  });
});
