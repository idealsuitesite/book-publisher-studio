import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ProjectDTO } from 'shared-types';
import { StructureEditor, applyReorder } from './StructureEditor';
import type { editStructure as editStructureFn } from '@/lib/api-client';

function project(overrides: Partial<ProjectDTO> = {}): ProjectDTO {
  const base = {
    id: 'p1',
    name: 'A Book',
    book: {
      metadata: { title: 'A Book', author: 'Jean' },
      mainContent: [
        {
          id: 'c1',
          type: 'chapter',
          number: 1,
          title: 'Intro',
          content: [{ type: 'paragraph', id: 'b1', text: 'one two three' }],
          sections: [
            { id: 's1', type: 'section', title: 'Background', content: [{ type: 'paragraph', id: 'b2', text: 'alpha beta' }] },
          ],
        },
        { id: 'c2', type: 'chapter', number: 2, title: 'Method', content: [], sections: [] },
      ],
    },
    report: { issues: [] },
    versions: [],
    publications: [],
    settings: { layoutName: 'letter', themeName: 'classic' },
    updatedAt: '2026-07-21T00:00:00.000Z',
  };
  return { ...base, ...overrides } as unknown as ProjectDTO;
}

describe('StructureEditor (read-only, phase 3 commit 3)', () => {
  it('lists chapters and their sections with real word counts', () => {
    render(<StructureEditor project={project()} onEdited={() => {}} />);

    expect(screen.getByText('Chapter 1: Intro')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2: Method')).toBeInTheDocument();
    expect(screen.getByText('Background')).toBeInTheDocument();
    expect(screen.getByText(/2 parts/)).toBeInTheDocument();
    // Chapter 1 = its paragraph (3) + the section (2) = 5; the section itself = 2.
    expect(screen.getByText('5 words')).toBeInTheDocument();
    expect(screen.getByText('2 words')).toBeInTheDocument();
  });

  it('surfaces the ADR-0049 "0 chapters" banner when the report carries the finding', () => {
    const withFinding = project({
      report: {
        issues: [
          {
            code: 'UNSTRUCTURED_MANUSCRIPT',
            severity: 'ERROR',
            message: 'No chapters were detected in a book-length manuscript',
            suggestion: 'Apply Heading 1 styles to your chapter titles',
          },
        ],
      },
    } as unknown as Partial<ProjectDTO>);

    render(<StructureEditor project={withFinding} onEdited={() => {}} />);

    expect(screen.getByRole('alert')).toHaveTextContent('0 chapters detected — needs review');
    expect(screen.getByText(/No chapters were detected/)).toBeInTheDocument();
  });
});

// The reorder gesture itself (dnd-kit + real layout) is proven by the commit-8 Playwright test,
// not jsdom (Phase 3 §3bis / Q5). Here we test OUR handler logic in isolation — indices, the API
// call, server-authoritative apply, and the error path — decoupled from the gesture pipeline.
describe('applyReorder (reorder handler — Phase 3 commit 4)', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('maps active/over ids to the mainContent indices reorderChapters expects, then applies the result', async () => {
    const editStructure = vi.fn().mockResolvedValue({ id: 'p1', name: 'moved' }) as unknown as typeof editStructureFn;
    const onEdited = vi.fn();
    const onError = vi.fn();

    await applyReorder('p1', ids, 'd', 'a', { editStructure, onEdited, onError });

    expect(editStructure).toHaveBeenCalledWith('p1', { type: 'reorderChapters', fromIndex: 3, toIndex: 0 });
    expect(onEdited).toHaveBeenCalledWith({ id: 'p1', name: 'moved' });
    expect(onError).not.toHaveBeenCalled();
  });

  it('is a no-op when the item did not actually move (same id)', async () => {
    const editStructure = vi.fn() as unknown as typeof editStructureFn;
    const onEdited = vi.fn();
    const onError = vi.fn();

    await applyReorder('p1', ids, 'b', 'b', { editStructure, onEdited, onError });

    expect(editStructure).not.toHaveBeenCalled();
    expect(onEdited).not.toHaveBeenCalled();
  });

  it('surfaces an error and does NOT apply when the edit fails', async () => {
    const editStructure = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof editStructureFn;
    const onEdited = vi.fn();
    const onError = vi.fn();

    await applyReorder('p1', ids, 'a', 'c', { editStructure, onEdited, onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onEdited).not.toHaveBeenCalled();
  });
});
