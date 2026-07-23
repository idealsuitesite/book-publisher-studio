import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectDTO, CleanupSuggestionDTO } from 'shared-types';
import { CleanupSuggestionsPanel } from './CleanupSuggestionsPanel';
import { fetchCleanupSuggestions, editStructure } from '@/lib/api-client';

vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>();
  return { ...actual, fetchCleanupSuggestions: vi.fn(), editStructure: vi.fn() };
});

const numbered = (markerId: string, markerText: string, targetTitle: string): CleanupSuggestionDTO => ({
  markerId, markerText, kind: 'numbered', targetChapterId: `${markerId}-t`, targetTitle,
});
const editorial = (markerId: string, markerText: string, targetTitle: string, canonicalLabel: string): CleanupSuggestionDTO => ({
  markerId, markerText, kind: 'editorial', targetChapterId: `${markerId}-t`, targetTitle, canonicalLabel,
});

beforeEach(() => {
  vi.mocked(fetchCleanupSuggestions).mockReset();
  vi.mocked(editStructure).mockReset().mockResolvedValue({ updatedAt: '2026-07-23T00:00:01Z' } as ProjectDTO);
});

describe('CleanupSuggestionsPanel (STRUCTURE_CLEANUP)', () => {
  it('renders the redundant markers as a checklist, marker → target', async () => {
    vi.mocked(fetchCleanupSuggestions).mockResolvedValue([
      numbered('m1', 'CHAPTER 1', 'The Holiness Of God'),
      editorial('m2', 'INTRODUCTION', 'Jesus Christ, Our Passover', 'Introduction'),
    ]);
    render(<CleanupSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    expect(await screen.findByText('CHAPTER 1')).toBeInTheDocument();
    expect(screen.getByText('2 redundant chapter markers')).toBeInTheDocument();
    // The editorial marker shows the canonical label it will inherit; the numbered shows its real title.
    expect(screen.getByText(/→ The Holiness Of God/)).toBeInTheDocument();
    expect(screen.getByText(/→ Introduction/)).toBeInTheDocument();
  });

  it('renders NOTHING when there is nothing to collapse — the bidirectional pole stays silent', async () => {
    vi.mocked(fetchCleanupSuggestions).mockResolvedValue([]);
    const { container } = render(<CleanupSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    await waitFor(() => expect(vi.mocked(fetchCleanupSuggestions)).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('"Collapse all" collapses every marker (document order — order-independent)', async () => {
    vi.mocked(fetchCleanupSuggestions).mockResolvedValue([
      numbered('m1', 'CHAPTER 1', 'A'),
      numbered('m2', 'CHAPTER 2', 'B'),
      numbered('m3', 'CHAPTER 3', 'C'),
    ]);
    const onEdited = vi.fn();
    render(<CleanupSuggestionsPanel projectId="p1" refreshKey="k" onEdited={onEdited} />);

    await screen.findByText('CHAPTER 1');
    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }));

    await waitFor(() => expect(vi.mocked(editStructure)).toHaveBeenCalledTimes(3));
    const order = vi.mocked(editStructure).mock.calls.map((c) => (c[1] as { markerId: string }).markerId);
    expect(order).toEqual(['m1', 'm2', 'm3']);
    expect(onEdited).toHaveBeenCalledTimes(1);
  });

  it('per-item "Collapse" collapses exactly that marker', async () => {
    vi.mocked(fetchCleanupSuggestions).mockResolvedValue([numbered('m1', 'CHAPTER 1', 'A'), numbered('m2', 'CHAPTER 2', 'B')]);
    render(<CleanupSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    await screen.findByText('CHAPTER 2');
    await userEvent.click(screen.getAllByRole('button', { name: 'Collapse' })[1]); // the CHAPTER 2 row

    await waitFor(() => expect(vi.mocked(editStructure)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(editStructure)).toHaveBeenCalledWith('p1', { type: 'collapseMarker', markerId: 'm2' });
  });

  it('A1: an in-flight collapse changes ONLY its own button — the others stay live', async () => {
    vi.mocked(fetchCleanupSuggestions).mockResolvedValue([numbered('m1', 'CHAPTER 1', 'A'), numbered('m2', 'CHAPTER 2', 'B')]);
    let resolveEdit: (p: ProjectDTO) => void = () => {};
    vi.mocked(editStructure).mockImplementation(() => new Promise<ProjectDTO>((res) => { resolveEdit = res; }));
    render(<CleanupSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    await screen.findByText('CHAPTER 1');
    await userEvent.click(screen.getAllByRole('button', { name: 'Collapse' })[0]); // the m1 row

    // Only the m1 row shows the in-flight state.
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
    // Every other control stays live: m2's Collapse, "Collapse all", and both Dismiss buttons.
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeEnabled(); // only m2's remains
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeEnabled();
    screen.getAllByRole('button', { name: 'Dismiss' }).forEach((b) => expect(b).toBeEnabled());

    resolveEdit({ updatedAt: 'x' } as ProjectDTO); // release the pending op
  });

  it('"Dismiss" removes a candidate without collapsing it (session-remembered)', async () => {
    vi.mocked(fetchCleanupSuggestions).mockResolvedValue([numbered('m1', 'CHAPTER 1', 'A'), numbered('m2', 'CHAPTER 2', 'B')]);
    render(<CleanupSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    await screen.findByText('CHAPTER 1');
    await userEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);

    expect(screen.queryByText('CHAPTER 1')).not.toBeInTheDocument();
    expect(screen.getByText('CHAPTER 2')).toBeInTheDocument();
    expect(vi.mocked(editStructure)).not.toHaveBeenCalled();
    expect(screen.getByText('1 redundant chapter marker')).toBeInTheDocument();
  });
});
