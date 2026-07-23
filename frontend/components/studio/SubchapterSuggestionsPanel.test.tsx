import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectDTO, SubchapterSuggestionDTO } from 'shared-types';
import { SubchapterSuggestionsPanel } from './SubchapterSuggestionsPanel';
import { fetchSubchapterSuggestions, editStructure } from '@/lib/api-client';

vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>();
  return { ...actual, fetchSubchapterSuggestions: vi.fn(), editStructure: vi.fn() };
});

const sug = (blockId: string, chapterId: string, title = 'Conclusion'): SubchapterSuggestionDTO => ({
  blockId, proposedTitle: title, key: title.toLowerCase(), chapterId, chapterTitle: chapterId,
});

beforeEach(() => {
  vi.mocked(fetchSubchapterSuggestions).mockReset();
  vi.mocked(editStructure).mockReset().mockResolvedValue({ updatedAt: '2026-07-23T00:00:01Z' } as ProjectDTO);
});

describe('SubchapterSuggestionsPanel (SUBCHAPTER_PROMOTION)', () => {
  it('groups recurring occurrences into ONE row, one decision (une ligne, une décision)', async () => {
    vi.mocked(fetchSubchapterSuggestions).mockResolvedValue([sug('b1', 'c1'), sug('b2', 'c2'), sug('b3', 'c3')]);
    render(<SubchapterSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    // One row, naming the recurrence and its count — not three identical rows.
    expect(await screen.findByText(/repeats in 3 chapters/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Make sections' })).toHaveLength(1);
  });

  it('renders NOTHING when nothing recurs — the third silence pole', async () => {
    vi.mocked(fetchSubchapterSuggestions).mockResolvedValue([]);
    const { container } = render(<SubchapterSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);
    await waitFor(() => expect(vi.mocked(fetchSubchapterSuggestions)).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('"Make sections" issues ONE batch call for the group (BATCH_CONFIRM_LATENCY) — server owns the order', async () => {
    vi.mocked(fetchSubchapterSuggestions).mockResolvedValue([sug('b1', 'c1'), sug('b2', 'c2'), sug('b3', 'c3')]);
    const onEdited = vi.fn();
    render(<SubchapterSuggestionsPanel projectId="p1" refreshKey="k" onEdited={onEdited} />);

    await screen.findByText(/repeats in 3 chapters/);
    await userEvent.click(screen.getByRole('button', { name: 'Make sections' }));

    await waitFor(() => expect(vi.mocked(editStructure)).toHaveBeenCalledTimes(1)); // ONE round-trip, not N
    expect(vi.mocked(editStructure)).toHaveBeenCalledWith('p1', { type: 'batchApply', op: 'promoteToSubsection', ids: ['b1', 'b2', 'b3'] });
    expect(onEdited).toHaveBeenCalledTimes(1);
  });

  it('A1: an in-flight "Make sections" changes ONLY its own button; a second group\'s stays live', async () => {
    vi.mocked(fetchSubchapterSuggestions).mockResolvedValue([sug('b1', 'c1', 'Conclusion'), sug('b2', 'c2', 'Summary')]);
    let resolveEdit: (p: ProjectDTO) => void = () => {};
    vi.mocked(editStructure).mockImplementation(() => new Promise<ProjectDTO>((res) => { resolveEdit = res; }));
    render(<SubchapterSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    await screen.findByText(/“Conclusion”/);
    await userEvent.click(screen.getAllByRole('button', { name: 'Make sections' })[0]); // the Conclusion group

    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Make sections' })).toBeEnabled(); // the Summary group stays live
    screen.getAllByRole('button', { name: 'Dismiss' }).forEach((b) => expect(b).toBeEnabled());
    resolveEdit({ updatedAt: 'x' } as ProjectDTO);
  });

  it('"Dismiss" removes a group without making sections', async () => {
    vi.mocked(fetchSubchapterSuggestions).mockResolvedValue([sug('b1', 'c1'), sug('b2', 'c2')]);
    render(<SubchapterSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    await screen.findByText(/repeats in 2 chapters/);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText(/repeats in/)).not.toBeInTheDocument();
    expect(vi.mocked(editStructure)).not.toHaveBeenCalled();
  });
});
