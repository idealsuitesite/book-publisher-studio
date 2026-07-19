import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportPanel } from './ExportPanel';

const exporter = vi.fn<(format: string) => Promise<Blob>>();



beforeEach(() => {
  exporter.mockReset();
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
    render(<ExportPanel exporter={exporter} downloadName="export" />);
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download DOCX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download EPUB' })).toBeInTheDocument();
  });

  it('asks its injected exporter for the clicked format - the panel owns no source, per Decision 6', async () => {
    exporter.mockResolvedValue(new Blob(['%PDF-']));
    const user = userEvent.setup();
    render(<ExportPanel exporter={exporter} downloadName="export" />);

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    await waitFor(() => expect(exporter).toHaveBeenCalledWith('pdf'));
  });

  it('notifies the parent once a download really completed', async () => {
    exporter.mockResolvedValue(new Blob(['x']));
    const onDownloaded = vi.fn();
    const user = userEvent.setup();
    render(
      <ExportPanel exporter={exporter} downloadName="export" onDownloaded={onDownloaded} />
    );

    await user.click(screen.getByRole('button', { name: 'Download DOCX' }));

    await waitFor(() => expect(onDownloaded).toHaveBeenCalledTimes(1));
  });

  it('disables the buttons while an export is in flight, so a slow export is not fired twice', async () => {
    exporter.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<ExportPanel exporter={exporter} downloadName="export" />);

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Download DOCX' })).toBeDisabled());
  });

  it('surfaces a real export failure instead of failing silently', async () => {
    exporter.mockRejectedValue(new Error('Unknown page layout: bad'));
    const user = userEvent.setup();
    render(<ExportPanel exporter={exporter} downloadName="export" />);

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(await screen.findByText(/Unknown page layout: bad/)).toBeInTheDocument();
  });

  it('is operable by keyboard', async () => {
    exporter.mockResolvedValue(new Blob(['x']));
    const user = userEvent.setup();
    render(<ExportPanel exporter={exporter} downloadName="export" />);

    await user.tab();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(exporter).toHaveBeenCalled());
  });
});
