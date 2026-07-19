import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewPanel } from './PreviewPanel';

const exporter = vi.fn<() => Promise<Blob>>();

/** A minimal PDF-shaped blob with two /MediaBox markers — the real page-count heuristic. */
const pdfBlob = (pages: number) =>
  new Blob([`%PDF-1.4${'/MediaBox [0 0 612 792]'.repeat(pages)}`]);

type Props = React.ComponentProps<typeof PreviewPanel>;

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    exporter,
    settingsKey: 'kdp-6x9/classic',
    layoutLabel: 'KDP 6" x 9"',
    themeLabel: 'Classic',
    ...overrides,
  };
  render(<PreviewPanel {...props} />);
  return props;
}

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

describe('PreviewPanel', () => {
  it('shows the current format and theme before anything is generated', () => {
    setup();
    expect(screen.getByText('KDP 6" x 9"')).toBeInTheDocument();
    expect(screen.getByText('Classic')).toBeInTheDocument();
  });

  it('does not claim a page count before a real preview exists', () => {
    setup();
    expect(screen.queryByText(/Estimated pages/i)).not.toBeInTheDocument();
  });

  it('asks its injected exporter for the preview - the panel owns no source, per Decision 6', async () => {
    exporter.mockResolvedValue(pdfBlob(2));
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: 'Create proof' }));

    await waitFor(() => expect(exporter).toHaveBeenCalledTimes(1));
  });

  it('derives the page count from the real returned PDF, not from an estimate', async () => {
    exporter.mockResolvedValue(pdfBlob(5));
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: /proof/i }));

    expect(await screen.findByText(/5/)).toBeInTheDocument();
  });

  it('notifies the parent once a preview really completed', async () => {
    exporter.mockResolvedValue(pdfBlob(2));
    const onGenerated = vi.fn();
    const user = userEvent.setup();
    setup({ onGenerated });

    await user.click(screen.getByRole('button', { name: /proof/i }));

    await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));
  });

  it('surfaces a real failure rather than leaving the panel blank', async () => {
    exporter.mockRejectedValue(new Error('Export timed out after 180s'));
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: /proof/i }));

    expect(await screen.findByText(/Export timed out after 180s/)).toBeInTheDocument();
  });

  it('is operable by keyboard', async () => {
    exporter.mockResolvedValue(pdfBlob(1));
    const user = userEvent.setup();
    setup();

    await user.tab();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(exporter).toHaveBeenCalled());
  });
});
