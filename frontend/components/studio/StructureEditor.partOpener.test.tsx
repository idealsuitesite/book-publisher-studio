import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectDTO } from 'shared-types';
import { StructureEditor, applyInsertPartOpener, applyRemovePartOpener } from './StructureEditor';
import { editStructure } from '@/lib/api-client';

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
        { id: 'op1', type: 'chapter', number: 0, title: 'Part I: Beginnings', content: [], partOpener: true },
        { id: 'c1', type: 'chapter', number: 1, title: 'Intro', content: [{ type: 'paragraph', id: 'b1', text: 'one two' }] },
        { id: 'c2', type: 'chapter', number: 2, title: 'Method', content: [] },
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

describe('StructureEditor — part dividers (PART_LEVEL_STRUCTURE)', () => {
  it('renders a divider row with its badge, rename and remove — no chapter number, no word count', () => {
    render(<StructureEditor project={project()} onEdited={() => {}} />);

    expect(screen.getByText('Part')).toBeInTheDocument(); // the badge
    expect(screen.getByRole('button', { name: 'Rename Part I: Beginnings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove divider' })).toBeInTheDocument();
    // The divider is not numbered — "Chapter 0" must never appear.
    expect(screen.queryByText(/Chapter 0/)).not.toBeInTheDocument();
  });

  it('the summary counts dividers as parts and excludes them from chapters (§6 wording)', () => {
    render(<StructureEditor project={project()} onEdited={() => {}} />);
    expect(screen.getByText(/1 part · 2 chapters/)).toBeInTheDocument();
  });

  it('clicking "Remove divider" issues the removePartOpener mutation', async () => {
    const updated = project();
    vi.mocked(editStructure).mockResolvedValue(updated);
    render(<StructureEditor project={project()} onEdited={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove divider' }));

    expect(editStructure).toHaveBeenCalledWith('p1', { type: 'removePartOpener', id: 'op1' });
  });

  it('clicking "+ Part" on a chapter row inserts a divider BEFORE that row', async () => {
    vi.mocked(editStructure).mockResolvedValue(project());
    render(<StructureEditor project={project()} onEdited={() => {}} />);

    // c2 is at mainContent index 2 — the divider lands above it.
    await userEvent.click(screen.getByRole('button', { name: 'Start a part before Chapter 2: Method' }));

    expect(editStructure).toHaveBeenCalledWith('p1', { type: 'insertPartOpener', index: 2, title: 'New part' });
  });

  it('a divider row offers no merge, placement or "+ Part" controls of its own', () => {
    render(<StructureEditor project={project()} onEdited={() => {}} />);
    // Two chapter rows have "+ Part" buttons; the divider row has none.
    expect(screen.getAllByText('+ Part')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Start a part before Part I/ })).not.toBeInTheDocument();
  });
});

describe('apply helpers', () => {
  const deps = (onEdited = vi.fn(), onError = vi.fn()) => ({ editStructure: vi.mocked(editStructure), onEdited, onError });

  it('applyInsertPartOpener trims the title and refuses an empty one without a call', async () => {
    const d = deps();
    await applyInsertPartOpener('p1', 0, '   ', d);
    expect(editStructure).not.toHaveBeenCalled();

    vi.mocked(editStructure).mockResolvedValue(project());
    await applyInsertPartOpener('p1', 0, '  Part I  ', d);
    expect(editStructure).toHaveBeenCalledWith('p1', { type: 'insertPartOpener', index: 0, title: 'Part I' });
    expect(d.onEdited).toHaveBeenCalled();
  });

  it('applyRemovePartOpener reports a nameable error on failure', async () => {
    // A LOCAL failing fn, the file's established error-path pattern (see applyReorder's
    // "surfaces an error" precedent) — not the module mock.
    const failing = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof editStructure;
    const onEdited = vi.fn();
    const onError = vi.fn();
    await applyRemovePartOpener('p1', 'op1', { editStructure: failing, onEdited, onError });
    expect(onError).toHaveBeenCalledWith('Could not reach the server.');
    expect(onEdited).not.toHaveBeenCalled();
  });
});
