import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadDropzone } from './UploadDropzone';
import type { ImportResponseDTO, ImportReportDTO } from 'shared-types';

vi.mock('@/lib/api-client', () => ({
  importManuscript: vi.fn(),
}));

// HOME_WORKSPACE.md section 0: a successful import ENDS IN A REDIRECT to the project's
// Workspace. The router is the component's one navigation dependency; mocking it lets the
// tests assert the redirect as the success contract.
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const { importManuscript } = await import('@/lib/api-client');

const docx = () =>
  new File(['content'], 'manuscript.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

// A COMPLETE ImportResponseDTO, typed with no `as never`. The old fixtures lied about the shape
// ({ book: { id: 'b1' } }, cast to silence the compiler), so BookStructureView rendered a book
// with no metadata after one test had already finished - the unhandled TypeError every suite run
// reported without failing. A fixture that violates the type it silenced is a defect in the
// test, not in the component; the component's contract (a complete BookDTO) matches what the
// real API actually returns.
const importResponse = (report: Partial<ImportReportDTO> = {}): ImportResponseDTO => ({
  projectId: report.status === 'error' ? undefined : 'p1',
  book: {
    id: 'b1',
    metadata: { title: 'Le Guide de Jean', author: 'Jean Dupont', language: 'fr' },
    mainContent: [],
  },
  report: {
    status: 'success',
    statistics: { chapters: 1, images: 0, tables: 0, words: 120 },
    warnings: [],
    errors: [],
    issues: [],
    score: {
      overall: 90,
      categories: { structure: 90, metadata: 90, typography: 90, accessibility: 90 },
    },
    ...report,
  },
});

beforeEach(() => {
  vi.mocked(importManuscript).mockReset();
  push.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UploadDropzone — accessibility of the application entry point', () => {
  it('exposes a real file input, not drag-and-drop only', () => {
    render(<UploadDropzone />);
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
  });

  it('is reachable by keyboard — the defect that excluded keyboard users entirely', async () => {
    const user = userEvent.setup();
    render(<UploadDropzone />);

    await user.tab();

    expect(document.querySelector('input[type="file"]')).toHaveFocus();
  });

  it('accepts a file chosen through the input and redirects to the new project - the success contract', async () => {
    vi.mocked(importManuscript).mockResolvedValue(importResponse());
    const user = userEvent.setup();
    render(<UploadDropzone />);

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, docx());

    await waitFor(() => expect(importManuscript).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/projects/p1'));
  });

  it('restricts the picker to .docx rather than offering every file type', () => {
    render(<UploadDropzone />);
    expect(document.querySelector('input[type="file"]')).toHaveAttribute(
      'accept',
      expect.stringContaining('.docx') as unknown as string
    );
  });

  it('keeps the visible instruction associated with the control', () => {
    render(<UploadDropzone />);
    // The label wraps the input, so the instruction is the control's accessible name rather
    // than unlinked decorative text beside it.
    expect(screen.getByText(/Drop your DOCX here, or choose a file/)).toBeInTheDocument();
  });
});

describe('UploadDropzone — import outcomes', () => {
  it('shows an uploading state while the request is in flight', async () => {
    vi.mocked(importManuscript).mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<UploadDropzone />);

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, docx());

    expect(await screen.findByText('Uploading…')).toBeInTheDocument();
    expect(screen.getByText('manuscript.docx')).toBeInTheDocument();
  });

  it('surfaces a real server error message rather than a generic failure', async () => {
    vi.mocked(importManuscript).mockRejectedValue(new Error('Only DOCX files are allowed'));
    const user = userEvent.setup();
    render(<UploadDropzone />);

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, docx());

    expect(await screen.findByText(/Only DOCX files are allowed/)).toBeInTheDocument();
  });

  it('reports a pipeline-level failure returned with a 422 body', async () => {
    vi.mocked(importManuscript).mockResolvedValue(
      importResponse({ status: 'error', errors: ['The document has no chapters.'] })
    );
    const user = userEvent.setup();
    render(<UploadDropzone />);

    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, docx());

    expect(await screen.findByText(/The document has no chapters\./)).toBeInTheDocument();
  });
});
