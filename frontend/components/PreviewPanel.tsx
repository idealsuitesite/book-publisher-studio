'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui';

// Sprint 7 commit 9a - real PDF preview (Decision 1: full re-export, not an incremental preview
// system). "Generate Preview" fires a real POST /api/manuscripts/export?format=pdf for the
// currently selected layout/theme and embeds the real returned PDF. The page count shown next
// to it is derived from that same real PDF's bytes (a /MediaBox occurrence count, the same
// heuristic backend/src/test-utils/extractPdfText.ts already uses for this project's own PDFKit
// output) - not a live per-option estimate in the selector, which would need one export call per
// layout before the user has even chosen (see docs/TODO.md's Commit 9a note for why that was
// rejected). Download (commit 9b) is a separate action, not wired here.
//
// Commit 11 redesign (CTO direction): shows the real selected format/theme labels up front, so
// the user knows what will be generated before clicking - "Estimated pages" still only appears
// once a preview has actually been generated (a real number from a real PDF), never guessed
// ahead of a real request. onGenerated is a real-completion callback for ProgressStepper, not a
// simulated "done" flag.
interface PreviewPanelProps {
  /**
   * Produces the PDF this panel previews. Injected rather than owned (HOME_WORKSPACE.md
   * Decision 6): the Workspace passes a project-based exporter that renders from the STORED
   * source, so this panel never needs to know a File exists — the browser holds an id, the
   * system holds the book.
   */
  exporter: () => Promise<Blob>;
  /** Identifies the settings the exporter will use — staleness is detected when it changes. */
  settingsKey: string;
  layoutLabel: string;
  themeLabel: string;
  onGenerated?: () => void;
  /** Reports the REAL page count read from the produced PDF, for the shell's engine facts. */
  onPageCount?: (pages: number | null) => void;
}

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; blobUrl: string; pageCount: number | null; settingsKey: string }
  | { status: 'error'; message: string };

function countPdfPages(bytes: ArrayBuffer): number | null {
  const text = new TextDecoder('latin1').decode(bytes);
  const matches = text.match(/\/MediaBox/g);
  return matches ? matches.length : null;
}

export function PreviewPanel({ exporter, settingsKey, layoutLabel, themeLabel, onGenerated, onPageCount }: PreviewPanelProps) {
  const [state, setState] = useState<PreviewState>({ status: 'idle' });
  const blobUrlRef = useRef<string | null>(null);

  // Staleness (the current preview no longer matches the selected layout/theme) is a derived
  // render-time value, not effect-driven state - avoids the cascading-setState-in-effect
  // anti-pattern a layout-change useEffect would otherwise trigger on every mount.
  const isStale = state.status === 'ready' && state.settingsKey !== settingsKey;

  // Cleanup-only effect (no setState in the body) - just revokes the last blob URL on unmount,
  // e.g. when "Import another file" tears this component down.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  async function generatePreview() {
    setState({ status: 'loading' });
    try {
      const blob = await exporter();
      const bytes = await blob.arrayBuffer();
      const pageCount = countPdfPages(bytes);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      setState({ status: 'ready', blobUrl, pageCount, settingsKey });
      onGenerated?.();
      onPageCount?.(pageCount);
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Preview failed.' });
    }
  }

  return (
    <Card className="flex max-w-2xl flex-col gap-4 px-8 py-6 text-left">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-app-text">Proof</h3>
        <Button onClick={() => void generatePreview()} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Refreshing…' : state.status === 'ready' ? 'Refresh proof' : 'Create proof'}
        </Button>
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
        {state.status === 'ready' && state.pageCount != null && (
          <div>
            <dt className="text-app-text-muted">Estimated pages</dt>
            <dd className="font-medium text-app-text">{state.pageCount}</dd>
          </div>
        )}
      </dl>

      {state.status === 'error' && <p className="text-sm text-app-error">{state.message}</p>}

      {isStale && (
        <p className="text-xs text-app-warning">
          Layout or theme changed since this proof — refresh it to see the book as it now stands.
        </p>
      )}

      {state.status === 'ready' && (
        <embed
          data-baseline-mask
          src={state.blobUrl}
          type="application/pdf"
          className={`h-[500px] w-full rounded-lg border border-app-border ${isStale ? 'opacity-50' : ''}`}
        />
      )}
    </Card>
  );
}
