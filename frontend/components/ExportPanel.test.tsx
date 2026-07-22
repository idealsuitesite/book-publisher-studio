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
    expect(screen.getByRole('button', { name: 'PDF edition' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DOCX edition' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EPUB edition' })).toBeInTheDocument();
  });

  it('asks its injected exporter for the clicked format - the panel owns no source, per Decision 6', async () => {
    exporter.mockResolvedValue(new Blob(['%PDF-']));
    const user = userEvent.setup();
    render(<ExportPanel exporter={exporter} downloadName="export" />);

    await user.click(screen.getByRole('button', { name: 'PDF edition' }));

    await waitFor(() => expect(exporter).toHaveBeenCalledWith('pdf'));
  });

  it('notifies the parent once a download really completed', async () => {
    exporter.mockResolvedValue(new Blob(['x']));
    const onDownloaded = vi.fn();
    const user = userEvent.setup();
    render(
      <ExportPanel exporter={exporter} downloadName="export" onDownloaded={onDownloaded} />
    );

    await user.click(screen.getByRole('button', { name: 'DOCX edition' }));

    await waitFor(() => expect(onDownloaded).toHaveBeenCalledTimes(1));
  });

  it('changes only the IN-FLIGHT button, leaving the others untouched (FOUNDER_TRAVERSAL defect 5)', async () => {
    // The founder read the old "disable all three while one exports" as "PDF selected all three
    // editions". Now only the clicked format shows "Exporting…" and is disabled; the other two
    // stay in their normal state and clickable — each edition is an independent round trip.
    exporter.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<ExportPanel exporter={exporter} downloadName="export" />);

    await user.click(screen.getByRole('button', { name: 'PDF edition' }));

    // The clicked button reflects its own in-flight state...
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exporting…' })).toBeDisabled());
    // ...and the other two are untouched: enabled, unchanged labels (never "selected").
    expect(screen.getByRole('button', { name: 'DOCX edition' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'EPUB edition' })).toBeEnabled();
  });

  it('surfaces a real export failure instead of failing silently', async () => {
    exporter.mockRejectedValue(new Error('Unknown page layout: bad'));
    const user = userEvent.setup();
    render(<ExportPanel exporter={exporter} downloadName="export" />);

    await user.click(screen.getByRole('button', { name: 'PDF edition' }));

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
