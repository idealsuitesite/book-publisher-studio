import { describe, it, expect } from 'vitest';
import type { ProjectDTO } from 'shared-types';
import { shouldNudgeToProof, isBookRenderable, proofNudgeKey } from './proofNudge';

/**
 * MINI_DR_LIVING_PROOF_NUDGE — the first-open Proof nudge decision, asserted on the two properties
 * the CTO flagged as where this could subtly misbehave without a superficial test noticing:
 *   1. a SECOND open resumes the last saved view, never the Proof again;
 *   2. an unhealthy first open DEFERS (never consumes the one-time nudge).
 */
describe('shouldNudgeToProof', () => {
  it('fires on a healthy first open with no saved view', () => {
    expect(shouldNudgeToProof({ savedView: null, alreadyNudged: false, unstructured: false })).toBe(true);
  });

  it('NEVER fires when a saved view exists — a returning author resumes, never the Proof again', () => {
    // The exact case the CTO watches: second open (or any return) must resume the saved view.
    expect(shouldNudgeToProof({ savedView: 'structure', alreadyNudged: false, unstructured: false })).toBe(false);
    expect(shouldNudgeToProof({ savedView: 'proof', alreadyNudged: true, unstructured: false })).toBe(false);
    // A saved view wins even over an otherwise-fireable state.
    expect(shouldNudgeToProof({ savedView: 'dashboard', alreadyNudged: false, unstructured: false })).toBe(false);
  });

  it('fires at most once — a set flag suppresses it even with no saved view', () => {
    // Nudged before, author navigated nowhere and returned: falls back to the default, not Proof.
    expect(shouldNudgeToProof({ savedView: null, alreadyNudged: true, unstructured: false })).toBe(false);
  });

  it('DEFERS on an unhealthy first open — returns false so the caller leaves the flag unset', () => {
    // 0-chapter manuscript: land on the actionable Overview, not an empty Proof. The nudge is not
    // consumed, so the first HEALTHY open fires it instead.
    expect(shouldNudgeToProof({ savedView: null, alreadyNudged: false, unstructured: true })).toBe(false);
  });

  it('a project that became structured after an unhealthy first open then nudges', () => {
    // First open was unstructured -> did not fire, flag left unset (still false). Once structured,
    // the same unset-flag / no-saved-view state fires.
    expect(shouldNudgeToProof({ savedView: null, alreadyNudged: false, unstructured: false })).toBe(true);
  });
});

describe('isBookRenderable', () => {
  const project = (issues: Array<{ code: string; severity: string }>): ProjectDTO =>
    ({ report: { issues } } as unknown as ProjectDTO);

  it('is false for an UNSTRUCTURED_MANUSCRIPT (unhealthy for a Proof)', () => {
    expect(isBookRenderable(project([{ code: 'UNSTRUCTURED_MANUSCRIPT', severity: 'ERROR' }]))).toBe(false);
  });

  it('is true when only publish-time warnings are present — a missing ISBN must not suppress the nudge', () => {
    // §4.2: the Proof renders fine; ISBN is a publication concern, not a rendering blocker.
    expect(isBookRenderable(project([{ code: 'MISSING_ISBN', severity: 'WARNING' }]))).toBe(true);
    expect(isBookRenderable(project([]))).toBe(true);
  });
});

describe('proofNudgeKey', () => {
  it('is per-project and distinct from the resume-where-left key', () => {
    expect(proofNudgeKey('p1')).toBe('bps.proofNudged.p1');
    expect(proofNudgeKey('p1')).not.toBe('bps.view.p1');
  });
});
