import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorialWorkspace } from './EditorialWorkspace';
import { editStructure } from '@/lib/api-client';
import type { ProjectDTO, ContentDTO, EditorialObjectDTO } from 'shared-types';

// The single write path is `editStructure` → EditBookUseCase; mock it to assert the workspace
// dispatches an OP and re-renders from the returned project (never a local mutation).
vi.mock('@/lib/api-client', () => ({
  editStructure: vi.fn(),
  ApiError: class ApiError extends Error {},
}));
const editStructureMock = vi.mocked(editStructure);

/**
 * M1-C2 (AUTHOR_EXPERIENCE_DR §8): the read studio renders the D1 skeleton (left) and the selected
 * object's document (centre), and — the CTO Divergence-2 gate condition — locks the D8 grammar
 * BEFORE any editing wiring: no title-retype path exists and no number is authorable. If a later
 * commit slips an input into the skeleton or an editable number field, this test fails.
 */

// Test fixtures cast through `unknown` — the runtime shape is exactly what the component reads;
// the full DTOs (required `inlines`, the whole report) are irrelevant to this view's behaviour.
function chapter(id: string, number: number, title: string, prose: string): ContentDTO {
  return {
    type: 'chapter', id, number, title,
    content: [{ type: 'paragraph', id: `${id}-p1`, text: prose, inlines: [] }],
    createdAt: '2026-07-24T00:00:00.000Z', updatedAt: '2026-07-24T00:00:00.000Z',
  } as unknown as ContentDTO;
}

function backPart(id: string, title: string): ContentDTO {
  return {
    type: 'chapter', id, number: 0, title,
    content: [{ type: 'paragraph', id: `${id}-p1`, text: 'A short author note.', inlines: [] }],
    createdAt: '2026-07-24T00:00:00.000Z', updatedAt: '2026-07-24T00:00:00.000Z',
  } as unknown as ContentDTO;
}

function makeProject(): ProjectDTO {
  const c1 = chapter('c1', 1, 'What Is Faith?', 'Faith is not a leap in the dark.');
  const c2 = chapter('c2', 2, 'Justified by Faith Alone', 'The just shall live by faith.');
  const about = backPart('about', 'About the Author');
  const objects: EditorialObjectDTO[] = [
    { type: 'chapter', title: 'What Is Faith?', place: 'body', sourceRef: { kind: 'content', id: 'c1' }, number: 1 },
    { type: 'chapter', title: 'Justified by Faith Alone', place: 'body', sourceRef: { kind: 'content', id: 'c2' }, number: 2 },
    { type: 'back-matter', title: 'About the Author', place: 'back', sourceRef: { kind: 'content', id: 'about' } },
  ];
  return {
    id: 'p1', name: 'Faith Alone',
    book: {
      id: 'b1', metadata: { title: 'Faith Alone' }, frontMatter: {}, mainContent: [c1, c2, about], backMatter: {},
    } as ProjectDTO['book'],
    skeleton: { objects },
    settings: { layoutName: 'letter', themeName: 'classic' },
    report: { issues: [], score: { overall: 90, categories: { structure: 90, metadata: 90, typography: 90, accessibility: 90 } } } as unknown as ProjectDTO['report'],
    versions: [], publications: [], updatedAt: '2026-07-24T00:00:00.000Z',
  };
}

describe('EditorialWorkspace — the read studio (M1-C2)', () => {
  it('renders the skeleton spine: chapter numbers, a back-matter badge, and the titles', () => {
    render(<EditorialWorkspace project={makeProject()} />);
    const skeleton = screen.getByRole('navigation', { name: 'Editorial skeleton' });

    expect(within(skeleton).getByText('What Is Faith?')).toBeInTheDocument();
    expect(within(skeleton).getByText('Justified by Faith Alone')).toBeInTheDocument();
    // The computed chapter numbers, rendered as data.
    expect(within(skeleton).getByText('1')).toBeInTheDocument();
    expect(within(skeleton).getByText('2')).toBeInTheDocument();
    // The back-matter part carries a place badge, not a number.
    expect(within(skeleton).getByText('Back')).toBeInTheDocument();
  });

  it('opens the first chapter by default and shows its document with the number header', () => {
    render(<EditorialWorkspace project={makeProject()} />);
    const doc = screen.getByRole('article', { name: 'Document' });
    expect(within(doc).getByText('Chapter 1')).toBeInTheDocument();
    expect(within(doc).getByRole('heading', { name: 'What Is Faith?' })).toBeInTheDocument();
    expect(within(doc).getByText('Faith is not a leap in the dark.')).toBeInTheDocument();
  });

  it('navigates to another object on click, swapping the document', async () => {
    const user = userEvent.setup();
    render(<EditorialWorkspace project={makeProject()} />);
    await user.click(screen.getByRole('button', { name: /Justified by Faith Alone/ }));
    const doc = screen.getByRole('article', { name: 'Document' });
    expect(within(doc).getByText('Chapter 2')).toBeInTheDocument();
    expect(within(doc).getByText('The just shall live by faith.')).toBeInTheDocument();
  });

  it('mounts the permanent Proof panel as the third column when the proof wiring is provided (C3)', () => {
    // A pending exporter — the panel mounts and shows its heading before the 500ms re-ink timer runs;
    // the full PdfProof pipeline is PreviewPanel's own tested concern, not this layout assertion.
    const proof = {
      exporter: () => new Promise<Blob>(() => {}),
      settingsKey: 'letter/classic//',
      layoutLabel: 'Letter',
      themeLabel: 'Classic',
    };
    render(<EditorialWorkspace project={makeProject()} proof={proof} />);
    const proofRegion = screen.getByRole('region', { name: 'Proof' });
    expect(within(proofRegion).getByRole('heading', { name: 'Proof' })).toBeInTheDocument();
  });

  it('omits the Proof panel when no proof wiring is passed (the read-only case)', () => {
    render(<EditorialWorkspace project={makeProject()} />);
    expect(screen.queryByRole('region', { name: 'Proof' })).toBeNull();
  });

  it('LOCKS the D8 grammar: no title-retype path and no authorable number anywhere (CTO Divergence-2)', () => {
    render(<EditorialWorkspace project={makeProject()} />);
    // No free-text input (a title-retype path) and no number spinner (an authorable number) exist in
    // the read studio — the grammar is confirm-not-retype and the number is a datum.
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    // The chapter number is present as rendered text, not an editable control.
    const doc = screen.getByRole('article', { name: 'Document' });
    expect(within(doc).getByText('Chapter 1')).toBeInTheDocument();
  });

  // ── M2-C4: contextual editing (D3) ─────────────────────────────────────────────────────────────

  describe('contextual editing (M2-C4)', () => {
    beforeEach(() => {
      editStructureMock.mockReset();
      editStructureMock.mockResolvedValue(makeProject());
    });

    it('dispatches a block op through editStructure and re-renders from the returned project (single write path)', async () => {
      const user = userEvent.setup();
      const onEdited = vi.fn();
      render(<EditorialWorkspace project={makeProject()} onEdited={onEdited} />);
      // Select a paragraph in the open chapter, then convert it.
      await user.click(screen.getByRole('button', { name: 'Faith is not a leap in the dark.' }));
      await user.click(screen.getByRole('button', { name: 'Chapter' }));
      expect(editStructureMock).toHaveBeenCalledWith('p1', { type: 'promoteToChapter', blockId: 'c1-p1' });
      // The panel re-renders from the RETURNED project — never a local mutation.
      expect(onEdited).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
    });

    it('dispatches an object placement op (setPartRole) from the placement control', async () => {
      const user = userEvent.setup();
      render(<EditorialWorkspace project={makeProject()} onEdited={vi.fn()} />);
      // The open chapter is body; tag it Back.
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(editStructureMock).toHaveBeenCalledWith('p1', { type: 'setPartRole', id: 'c1', role: 'back' });
    });

    it('keeps the D8 grammar in the EDITING studio too: editing is menu-driven, still no textbox/number field', async () => {
      const user = userEvent.setup();
      render(<EditorialWorkspace project={makeProject()} onEdited={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Faith is not a leap in the dark.' }));
      // The convert menu is open, yet no free-text or number-spinner control exists — the ops are
      // menu gestures, and the number stays a datum (title editing is D6's own surface, M3).
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByRole('spinbutton')).toBeNull();
    });
  });
});
