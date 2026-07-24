import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The PDF.js surface is exercised in PdfProof.test.tsx (it loads pdfjs, which does not render in jsdom).
// Here it is stubbed to a marker so these tests stay about the panel's LIVING LOOP — exporter cadence,
// page count, error recovery — not PDF painting.
vi.mock('./PdfProof', () => ({
  PdfProof: ({ bytes }: { bytes: ArrayBuffer | null }) => (
    <div data-testid="pdf-proof" data-has-bytes={bytes ? 'yes' : 'no'} />
  ),
}));

import { PreviewPanel } from './PreviewPanel';

const exporter = vi.fn<() => Promise<Blob>>();

/** A minimal PDF-shaped blob with N /MediaBox markers — the real page-count heuristic. */
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
  const view = render(<PreviewPanel {...props} />);
  return { props, view };
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

// The living Proof (PRODUCT_EXPERIENCE §4.5): no Generate button — the proof exists because
// the view opened, and refreshes because settings changed.
describe('PreviewPanel — the living proof', () => {
  it('has NO generate button — the button died with the pipeline metaphor', () => {
    exporter.mockResolvedValue(pdfBlob(1));
    setup();
    expect(screen.queryByRole('button', { name: /create|generate|refresh/i })).not.toBeInTheDocument();
  });

  it('produces the proof on its own when the view opens', async () => {
    exporter.mockResolvedValue(pdfBlob(2));
    setup();

    await waitFor(() => expect(exporter).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('re-inks when the settings change — modify → the rendering follows', async () => {
    exporter.mockResolvedValue(pdfBlob(2));
    const { view, props } = setup();
    await waitFor(() => expect(exporter).toHaveBeenCalledTimes(1), { timeout: 3000 });

    view.rerender(<PreviewPanel {...props} settingsKey="a4/classic" />);

    await waitFor(() => expect(exporter).toHaveBeenCalledTimes(2), { timeout: 3000 });
  });

  it('reads the page count from the produced PDF itself, never an estimate', async () => {
    exporter.mockResolvedValue(pdfBlob(3));
    setup();

    expect(await screen.findByText('3', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('reports the real page count upward for the engine facts', async () => {
    exporter.mockResolvedValue(pdfBlob(4));
    const onPageCount = vi.fn();
    setup({ onPageCount });

    await waitFor(() => expect(onPageCount).toHaveBeenCalledWith(4), { timeout: 3000 });
  });

  it('shows the current format and theme while the first proof is being set', () => {
    exporter.mockImplementation(() => new Promise(() => {}));
    setup();
    expect(screen.getByText('KDP 6" x 9"')).toBeInTheDocument();
    expect(screen.getByText('Classic')).toBeInTheDocument();
  });

  it('surfaces a real failure with a way to try again', async () => {
    exporter.mockRejectedValueOnce(new Error('Unknown page layout: bad'));
    exporter.mockResolvedValue(pdfBlob(1));
    const user = userEvent.setup();
    setup();

    expect(await screen.findByText(/Unknown page layout: bad/, {}, { timeout: 3000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(exporter).toHaveBeenCalledTimes(2), { timeout: 3000 });
  });
});
