import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LiveProof } from './LiveProof';
import { renderRegion } from '@/lib/api-client';

/**
 * M2-C5 (AUTHOR_EXPERIENCE_DR D4) — the region-fetch loop's honesty gate (CTO graven gate point 2):
 * between a content edit and its background re-sync the WHOLE-BOOK total is shown PROVISIONAL ("≈ N"),
 * never a stale number dressed as final. PdfProof is stubbed (this test is the loop's state machine,
 * not the canvas), reporting a fixed visible window; renderRegion is mocked.
 */

vi.mock('@/lib/api-client', () => ({ renderRegion: vi.fn() }));
vi.mock('@/components/PdfProof', () => ({
  PdfProof: (props: { onVisibleRange?: (start: number, end: number) => void }) => {
    props.onVisibleRange?.(1, 3); // the loop fetches THIS window on edit
    return null;
  },
}));
const renderRegionMock = vi.mocked(renderRegion);

/** A minimal PDF-ish blob whose `/MediaBox` count is the page total countPdfPages reads. */
function pdfBlob(pages: number): Blob {
  const body = '%PDF-1.4\n' + '/MediaBox [0 0 612 792]\n'.repeat(pages);
  return new Blob([new TextEncoder().encode(body)], { type: 'application/pdf' });
}

describe('LiveProof — the D4 region loop + the provisional total (M2-C5)', () => {
  beforeEach(() => {
    renderRegionMock.mockReset();
    renderRegionMock.mockResolvedValue({ bytes: new ArrayBuffer(8), totalDomainPages: 10, start: 1, end: 4 });
  });

  it('crisp total after the full render; PROVISIONAL "≈ N" between an edit and its re-sync; crisp again after', async () => {
    const exporter = vi.fn(async () => pdfBlob(10));
    const props = {
      projectId: 'p1',
      exporter,
      settingsKey: 'letter/classic//',
      layoutLabel: 'Letter',
      themeLabel: 'Classic',
    };
    const { rerender } = render(<LiveProof {...props} editNonce={0} />);

    // Full render → the authoritative total, shown crisp (no ≈).
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument());
    expect(screen.queryByText('≈ 10')).toBeNull();

    // A content edit → region re-ink → the whole-book denominator is marked provisional (never a false N).
    rerender(<LiveProof {...props} editNonce={1} />);
    await waitFor(() => expect(screen.getByText('≈ 10')).toBeInTheDocument());
    // Fetched the visible window (1..3) with a ±1 margin, start clamped to 1.
    expect(renderRegionMock).toHaveBeenCalledWith('p1', 1, 4, 10);
    expect(screen.getByText('≈ 10').getAttribute('data-provisional')).toBe('true');

    // The debounced background full render re-establishes the crisp authoritative total.
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument(), { timeout: 2500 });
    expect(screen.queryByText('≈ 10')).toBeNull();
    expect(exporter).toHaveBeenCalledTimes(2); // the initial full render + the background re-sync
  });
});
