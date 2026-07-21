import { describe, it, expect } from 'vitest';
import type { BookDTO, ProjectDTO } from 'shared-types';
import { computeBookFacts, proofRefreshKey } from './bookFacts';

function project(overrides: Partial<ProjectDTO> = {}): ProjectDTO {
  return {
    id: 'p1',
    settings: { layoutName: 'letter', themeName: 'classic' },
    updatedAt: '2026-07-21T10:00:00.000Z',
    ...overrides,
  } as unknown as ProjectDTO;
}

function book(mainContent: unknown[]): BookDTO {
  return { id: 'b1', metadata: {}, mainContent } as unknown as BookDTO;
}
const ch = (title: string, content: unknown[] = [], sections: unknown[] = []) => ({
  type: 'chapter', id: title, number: 1, title, content, sections,
});
const sec = (title: string, content: unknown[] = []) => ({ type: 'section', id: title, title, level: 1, content });

describe('computeBookFacts — editorial parts excluded from the chapter count (MINI_DR_EDITORIAL_PARTS)', () => {
  it('counts the faith-alone shape as 15 chapters + 2 editorial parts, not "17 ch"', () => {
    const chapters = Array.from({ length: 15 }, (_, i) => ch(`Chapter ${i + 1}: A Title`));
    const facts = computeBookFacts(
      book([
        sec(''), // untitled preamble -> stays a section, not an editorial part
        ch('INTRODUCTION'), // editorial (front)
        ...chapters,
        ch('Conclusion: Nothing but Faith'), // editorial (back)
      ])
    );
    expect(facts.chapters).toBe(15); // the miscount fix: not 17
    expect(facts.editorialParts.map((p) => p.key)).toEqual(['introduction', 'conclusion']);
    expect(facts.editorialParts[0].detectedTitle).toBe('INTRODUCTION');
    expect(facts.editorialParts[1].detectedTitle).toBe('Conclusion: Nothing but Faith');
  });

  it("still counts an editorial part's inner blocks as content facts", () => {
    const facts = computeBookFacts(
      book([
        ch('Introduction', [{ type: 'image', id: 'i1' }, { type: 'scripture', id: 's1' }]),
        ch('Chapter One: Start'),
      ])
    );
    expect(facts.chapters).toBe(1);
    expect(facts.images).toBe(1);
    expect(facts.citations).toBe(1);
  });

  it('classifies only TOP-LEVEL parts — a nested "Introduction" section is ordinary content', () => {
    const facts = computeBookFacts(book([ch('Chapter One: Start', [], [sec('Introduction')])]));
    expect(facts.chapters).toBe(1);
    expect(facts.sections).toBe(1);
    expect(facts.editorialParts).toEqual([]);
  });
});

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

  it('changes when the accent override changes — even with the SAME updatedAt (MINI_DR_PER_THEME_ACCENT, D5)', () => {
    // The key must re-ink on the accent's OWN signal, not rely on updatedAt as a proxy — else a
    // shade change could leave the Proof silently stale, the exact D5 risk.
    const plain = proofRefreshKey(project({ settings: { layoutName: 'letter', themeName: 'classic' } }));
    const accented = proofRefreshKey(
      project({ settings: { layoutName: 'letter', themeName: 'classic', accentOverride: '#1D4E68' } })
    );
    expect(accented).not.toBe(plain);
  });
});
