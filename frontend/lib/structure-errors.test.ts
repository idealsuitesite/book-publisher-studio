import { describe, it, expect } from 'vitest';
import { describeStructureError } from './structure-errors';
import { ApiError, RequestTimeoutError, NetworkError } from './api-client';

describe('describeStructureError — one author-language sentence, never a raw string (M3-C7)', () => {
  it('maps each structure-edit code to an author-facing message that says nothing was lost', () => {
    for (const code of ['CONTENT_NOT_FOUND', 'VERSION_NOT_FOUND', 'INVALID_MUTATION'] as const) {
      const msg = describeStructureError(new ApiError('promoteToChapter: no block id x', 400, code));
      expect(msg).not.toContain('block'); // no developer vocabulary
      expect(msg).not.toContain('promoteToChapter');
      expect(msg).toMatch(/Nothing was lost/i);
    }
  });

  it('names the timeout and the network failure in plain language', () => {
    expect(describeStructureError(new RequestTimeoutError('Editing structure', 60_000))).toMatch(/took too long/i);
    expect(describeStructureError(new NetworkError('Editing structure'))).toMatch(/reach the server/i);
  });

  it('falls back to a safe author message for an unknown/undefined error — never the raw string', () => {
    expect(describeStructureError(new Error('TypeError: cannot read properties of undefined'))).toMatch(/couldn’t be applied/i);
    expect(describeStructureError(undefined)).toMatch(/couldn’t be applied/i);
    // an ApiError with an unmapped code still gets the safe fallback, not its raw message
    expect(describeStructureError(new ApiError('raw', 500, 'RENDER_FAILED'))).not.toContain('raw');
  });
});
