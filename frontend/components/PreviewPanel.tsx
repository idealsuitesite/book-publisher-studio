'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui';

/**
 * The living Proof (PRODUCT_EXPERIENCE §4.5, CTO: "le bouton disparaît"). The proof exists
 * because you opened it, and refreshes because you changed something — no Generate button.
 * On mount and on every settings change the panel debounces, then runs the REAL pipeline via
 * its injected exporter (from the STORED source, Decision 6). While a refresh runs, the old
 * page stays visible and dims — the re-inking (VISUAL_LANGUAGE §6), never a blank flash.
 *
 * Feasibility is measured, not hoped: the full pipeline is ~600ms on the large fixture
 * (ADR-0041); S13 (Performance) owns making it instant. The page count shown is read from the
 * produced PDF's own bytes — real, never estimated.
 */
interface PreviewPanelProps {
  /** Produces the PDF. Injected (Decision 6): the browser holds an id, the system holds the book. */
  exporter: () => Promise<Blob>;
  /** Identifies the settings the exporter will use — a change triggers the living refresh. */
  settingsKey: string;
  layoutLabel: string;
  themeLabel: string;
  onGenerated?: () => void;
  /** Reports the REAL page count read from the produced PDF, for the shell's engine facts. */
  onPageCount?: (pages: number | null) => void;
}

interface ProofState {
  blobUrl: string | null;
  pageCount: number | null;
  refreshing: boolean;
  error: string | null;
}

/** Debounce before a settings change re-inks the proof. Long enough to absorb a click-flurry
 * through presets, short enough to feel alive. */
const REFRESH_DEBOUNCE_MS = 500;

function countPdfPages(bytes: ArrayBuffer): number | null {
  const text = new TextDecoder('latin1').decode(bytes);
  const matches = text.match(/\/MediaBox/g);
  return matches ? matches.length : null;
}

export function PreviewPanel({ exporter, settingsKey, layoutLabel, themeLabel, onGenerated, onPageCount }: PreviewPanelProps) {
  const [state, setState] = useState<ProofState>({ blobUrl: null, pageCount: null, refreshing: true, error: null });
  const [retry, setRetry] = useState(0);
  const blobUrlRef = useRef<string | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // The living loop: mount → proof; settingsKey change → debounce → proof. A run that finishes
  // after a newer one started is discarded (runId guard) — the proof never goes backwards.
  useEffect(() => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setState((current) => ({ ...current, refreshing: true, error: null }));

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const blob = await exporter();
          if (runIdRef.current !== runId) return;
          const bytes = await blob.arrayBuffer();
          const pageCount = countPdfPages(bytes);
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;
          setState({ blobUrl, pageCount, refreshing: false, error: null });
          onGenerated?.();
          onPageCount?.(pageCount);
        } catch (error) {
          if (runIdRef.current !== runId) return;
          setState((current) => ({
            ...current,
            refreshing: false,
            error: error instanceof Error ? error.message : 'The proof could not be produced.',
          }));
        }
      })();
    }, REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey, retry]);

  return (
    <Card className="flex max-w-2xl flex-col gap-4 px-8 py-6 text-left">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-app-text">Proof</h3>
        {/* No Generate button - the proof is alive. This line narrates its state instead. */}
        <span className="text-xs text-app-text-muted" aria-live="polite">
          {state.refreshing ? 'Re-inking…' : state.blobUrl ? 'Up to date' : ''}
        </span>
      </div>

      <dl className="flex flex-wrap gap-6 text-sm">
        <div>
          <dt className="text-app-text-muted">Format</dt>
          <dd className="font-medium text-app-text">{layoutLabel}</dd>
        </div>
        <div>
          <dt className="text-app-text-muted">Theme</dt>
          <dd className="font-medium text-app-text">{themeLabel}</dd>
        </div>
        {state.pageCount != null && (
          <div>
            <dt className="text-app-text-muted">Pages</dt>
            <dd className="font-medium tabular-nums text-app-text">{state.pageCount}</dd>
          </div>
        )}
      </dl>

      {state.error && (
        <p className="text-sm text-app-error">
          {state.error}{' '}
          <Button variant="link" onClick={() => setRetry((n) => n + 1)} className="text-sm">
            Try again
          </Button>
        </p>
      )}

      {state.blobUrl && (
        <embed
          data-baseline-mask
          src={state.blobUrl}
          type="application/pdf"
          className={`h-[500px] w-full rounded-lg border border-app-border transition-opacity duration-[var(--motion-view)] ${
            state.refreshing ? 'opacity-40' : 'opacity-100'
          }`}
        />
      )}
      {!state.blobUrl && state.refreshing && (
        <div className="flex h-[500px] w-full items-center justify-center rounded-lg border border-app-border bg-app-surface-2">
          <p className="animate-pulse text-sm text-app-text-muted">Setting the first proof…</p>
        </div>
      )}
    </Card>
  );
}
