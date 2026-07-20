import { describe, it, expect } from 'vitest';
import type { ProjectDTO } from 'shared-types';
import { proofRefreshKey } from './bookFacts';

function project(overrides: Partial<ProjectDTO> = {}): ProjectDTO {
  return {
    id: 'p1',
    settings: { layoutName: 'letter', themeName: 'classic' },
    updatedAt: '2026-07-21T10:00:00.000Z',
    ...overrides,
  } as unknown as ProjectDTO;
}

describe('proofRefreshKey — what makes the living Proof re-ink (Phase 3 D5)', () => {
  it('changes when the layout changes', () => {
    expect(proofRefreshKey(project())).not.toBe(
      proofRefreshKey(project({ settings: { layoutName: 'kdp-6x9', themeName: 'classic' } }))
    );
  });

  it('changes when the theme changes', () => {
    expect(proofRefreshKey(project())).not.toBe(
      proofRefreshKey(project({ settings: { layoutName: 'letter', themeName: 'modern' } }))
    );
  });

  it('changes when a structure edit advances updatedAt — even with identical settings', () => {
    const before = proofRefreshKey(project());
    // A reorder/rename/undo bumps updatedAt (ProjectService); settings are untouched.
    const after = proofRefreshKey(project({ updatedAt: '2026-07-21T10:05:00.000Z' }));
    expect(after).not.toBe(before);
  });
});
