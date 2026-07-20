import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectDTO } from 'shared-types';
import { StructureEditor, applyReorder, applyRename, applyUndo } from './StructureEditor';
import { editStructure } from '@/lib/api-client';
import type { editStructure as editStructureFn } from '@/lib/api-client';

// Real gestures aside, the inline-rename UX (a plain input) is fully jsdom-testable. Mock only the
// network call; keep ApiError real so applyReorder/applyRename's `instanceof` branch is unaffected.
vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>();
  return { ...actual, editStructure: vi.fn() };
});

beforeEach(() => vi.mocked(editStructure).mockReset());

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

    // The heading is now a "Chapter N:" prefix + an editable title (a rename button).
    expect(screen.getByRole('button', { name: 'Rename Chapter 1: Intro' })).toBeInTheDocument();
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Method')).toBeInTheDocument();
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

describe('applyRename (rename handler — Phase 3 commit 5)', () => {
  it('renames by id with a trimmed title, then applies the returned project', async () => {
    const editStructure = vi.fn().mockResolvedValue({ id: 'p1' }) as unknown as typeof editStructureFn;
    const onEdited = vi.fn();
    const onError = vi.fn();

    await applyRename('p1', 's1', '  Background  ', { editStructure, onEdited, onError });

    expect(editStructure).toHaveBeenCalledWith('p1', { type: 'rename', id: 's1', title: 'Background' });
    expect(onEdited).toHaveBeenCalledWith({ id: 'p1' });
  });

  it('refuses an empty title without calling the API', async () => {
    const editStructure = vi.fn() as unknown as typeof editStructureFn;
    const onEdited = vi.fn();
    const onError = vi.fn();

    await applyRename('p1', 's1', '   ', { editStructure, onEdited, onError });

    expect(editStructure).not.toHaveBeenCalled();
    expect(onEdited).not.toHaveBeenCalled();
  });
});

describe('inline rename UX (Phase 3 commit 5)', () => {
  it('click a title → type → Enter commits the rename through the client', async () => {
    const user = userEvent.setup();
    vi.mocked(editStructure).mockResolvedValue(project());
    render(<StructureEditor project={project()} onEdited={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Rename Chapter 1: Intro' }));
    const input = screen.getByRole('textbox', { name: 'Rename Chapter 1: Intro' });
    await user.clear(input);
    await user.type(input, 'Preface{Enter}');

    expect(vi.mocked(editStructure)).toHaveBeenCalledWith('p1', { type: 'rename', id: 'c1', title: 'Preface' });
  });

  it('Esc cancels — no rename call, the title stays', async () => {
    const user = userEvent.setup();
    render(<StructureEditor project={project()} onEdited={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Rename Chapter 2: Method' }));
    const input = screen.getByRole('textbox', { name: 'Rename Chapter 2: Method' });
    await user.clear(input);
    await user.type(input, 'Whatever{Escape}');

    expect(vi.mocked(editStructure)).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Rename Chapter 2: Method' })).toBeInTheDocument();
  });
});

describe('applyUndo (undo handler — Phase 3 commit 6)', () => {
  it('restores the given snapshot, applies the result, and returns true', async () => {
    const editStructure = vi.fn().mockResolvedValue({ id: 'p1' }) as unknown as typeof editStructureFn;
    const onEdited = vi.fn();
    const onError = vi.fn();

    const ok = await applyUndo('p1', 'v9', { editStructure, onEdited, onError });

    expect(editStructure).toHaveBeenCalledWith('p1', { type: 'restoreVersion', versionId: 'v9' });
    expect(onEdited).toHaveBeenCalledWith({ id: 'p1' });
    expect(ok).toBe(true);
  });

  it('returns false and surfaces an error on failure', async () => {
    const editStructure = vi.fn().mockRejectedValue(new Error('down')) as unknown as typeof editStructureFn;
    const onEdited = vi.fn();
    const onError = vi.fn();

    const ok = await applyUndo('p1', 'v9', { editStructure, onEdited, onError });

    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onEdited).not.toHaveBeenCalled();
  });
});

describe('undo UX (Phase 3 commit 6)', () => {
  it('is hidden until an edit, then appears and restores the snapshot the edit took', async () => {
    const user = userEvent.setup();
    // The edit returns a project whose newest version is the pre-edit snapshot (the undo target).
    const edited = project({ versions: [{ id: 'v9', number: 1 }] } as unknown as Partial<ProjectDTO>);
    vi.mocked(editStructure).mockResolvedValue(edited);
    render(<StructureEditor project={project()} onEdited={() => {}} />);

    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Rename Chapter 1: Intro' }));
    await user.clear(screen.getByRole('textbox', { name: 'Rename Chapter 1: Intro' }));
    await user.type(screen.getByRole('textbox', { name: 'Rename Chapter 1: Intro' }), 'Preface{Enter}');

    const undo = await screen.findByRole('button', { name: /Undo/ });
    vi.mocked(editStructure).mockClear();
    await user.click(undo);

    expect(vi.mocked(editStructure)).toHaveBeenCalledWith('p1', { type: 'restoreVersion', versionId: 'v9' });
  });
});
