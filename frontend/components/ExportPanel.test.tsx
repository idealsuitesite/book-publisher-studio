import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportPanel } from './ExportPanel';

vi.mock('@/lib/api-client', () => ({
  exportManuscript: vi.fn(),
}));

const { exportManuscript } = await import('@/lib/api-client');

const file = () =>
  new File(['x'], 'large-book.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

beforeEach(() => {
  vi.mocked(exportManuscript).mockReset();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:fake'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ExportPanel', () => {
  it('offers all three real export formats', () => {
    render(<ExportPanel file={file()} layout="letter" theme="classic" />);
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download DOCX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download EPUB' })).toBeInTheDocument();
  });

  it('sends the real selected layout and theme, not defaults', async () => {
    vi.mocked(exportManuscript).mockResolvedValue(new Blob(['%PDF-']));
    const user = userEvent.setup();
    render(<ExportPanel file={file()} layout="kdp-6x9" theme="classic" />);

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    await waitFor(() =>
      expect(exportManuscript).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'pdf', layout: 'kdp-6x9', theme: 'classic' })
      )
    );
  });

  it('notifies the parent once a download really completed', async () => {
    vi.mocked(exportManuscript).mockResolvedValue(new Blob(['x']));
    const onDownloaded = vi.fn();
    const user = userEvent.setup();
    render(
      <ExportPanel file={file()} layout="letter" theme="classic" onDownloaded={onDownloaded} />
    );

    await user.click(screen.getByRole('button', { name: 'Download DOCX' }));

    await waitFor(() => expect(onDownloaded).toHaveBeenCalledTimes(1));
  });

  it('disables the buttons while an export is in flight, so a slow export is not fired twice', async () => {
    vi.mocked(exportManuscript).mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<ExportPanel file={file()} layout="letter" theme="classic" />);

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Download DOCX' })).toBeDisabled());
  });

  it('surfaces a real export failure instead of failing silently', async () => {
    vi.mocked(exportManuscript).mockRejectedValue(new Error('Unknown page layout: bad'));
    const user = userEvent.setup();
    render(<ExportPanel file={file()} layout="bad" theme="classic" />);

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(await screen.findByText(/Unknown page layout: bad/)).toBeInTheDocument();
  });

  it('is operable by keyboard', async () => {
    vi.mocked(exportManuscript).mockResolvedValue(new Blob(['x']));
    const user = userEvent.setup();
    render(<ExportPanel file={file()} layout="letter" theme="classic" />);

    await user.tab();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(exportManuscript).toHaveBeenCalled());
  });
});
