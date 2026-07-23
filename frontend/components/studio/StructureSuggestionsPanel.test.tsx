import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectDTO, StructureSuggestionDTO } from 'shared-types';
import { StructureSuggestionsPanel } from './StructureSuggestionsPanel';
import { fetchStructureSuggestions, editStructure } from '@/lib/api-client';

vi.mock('@/lib/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/api-client')>();
  return { ...actual, fetchStructureSuggestions: vi.fn(), editStructure: vi.fn() };
});

const suggestion = (blockId: string, title: string): StructureSuggestionDTO => ({
  blockId, proposedTitle: title, kind: 'numbered-chapter', key: 'chapter', evidence: title,
});

beforeEach(() => {
  vi.mocked(fetchStructureSuggestions).mockReset();
  vi.mocked(editStructure).mockReset().mockResolvedValue({ updatedAt: '2026-07-23T00:00:01Z' } as ProjectDTO);
});

describe('StructureSuggestionsPanel (STRUCTURE_ASSIST)', () => {
  it('renders the suggested chapters as a checklist', async () => {
    vi.mocked(fetchStructureSuggestions).mockResolvedValue([suggestion('b1', 'INTRODUCTION'), suggestion('b2', 'CHAPTER 1')]);
    render(<StructureSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    expect(await screen.findByText('INTRODUCTION')).toBeInTheDocument();
    expect(screen.getByText('CHAPTER 1')).toBeInTheDocument();
    expect(screen.getByText('2 suggested chapters')).toBeInTheDocument();
  });

  it('renders NOTHING when there is nothing to suggest — the over-structured pole stays silent', async () => {
    vi.mocked(fetchStructureSuggestions).mockResolvedValue([]);
    const { container } = render(<StructureSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    await waitFor(() => expect(vi.mocked(fetchStructureSuggestions)).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('"Make all chapters" promotes every marker in REVERSE order (so each stays a top-level split)', async () => {
    vi.mocked(fetchStructureSuggestions).mockResolvedValue([suggestion('b1', 'INTRODUCTION'), suggestion('b2', 'CHAPTER 1'), suggestion('b3', 'CHAPTER 2')]);
    const onEdited = vi.fn();
    render(<StructureSuggestionsPanel projectId="p1" refreshKey="k" onEdited={onEdited} />);

    await screen.findByText('INTRODUCTION');
    await userEvent.click(screen.getByRole('button', { name: 'Make all chapters' }));

    await waitFor(() => expect(vi.mocked(editStructure)).toHaveBeenCalledTimes(3));
    const order = vi.mocked(editStructure).mock.calls.map((c) => (c[1] as { blockId: string }).blockId);
    expect(order).toEqual(['b3', 'b2', 'b1']); // reverse document order
    expect(onEdited).toHaveBeenCalledTimes(1);
  });

  it('per-item "Make chapter" promotes exactly that block', async () => {
    vi.mocked(fetchStructureSuggestions).mockResolvedValue([suggestion('b1', 'INTRODUCTION'), suggestion('b2', 'CHAPTER 1')]);
    render(<StructureSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    await screen.findByText('CHAPTER 1');
    const rows = screen.getAllByRole('button', { name: 'Make chapter' });
    await userEvent.click(rows[1]); // the CHAPTER 1 row

    await waitFor(() => expect(vi.mocked(editStructure)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(editStructure)).toHaveBeenCalledWith('p1', { type: 'promoteToChapter', blockId: 'b2' });
  });

  it('"Dismiss" removes a candidate from the list without promoting it (session-remembered)', async () => {
    vi.mocked(fetchStructureSuggestions).mockResolvedValue([suggestion('b1', 'INTRODUCTION'), suggestion('b2', 'CHAPTER 1')]);
    render(<StructureSuggestionsPanel projectId="p1" refreshKey="k" onEdited={vi.fn()} />);

    await screen.findByText('INTRODUCTION');
    await userEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);

    expect(screen.queryByText('INTRODUCTION')).not.toBeInTheDocument();
    expect(screen.getByText('CHAPTER 1')).toBeInTheDocument();
    expect(vi.mocked(editStructure)).not.toHaveBeenCalled();
    expect(screen.getByText('1 suggested chapter')).toBeInTheDocument();
  });
});
