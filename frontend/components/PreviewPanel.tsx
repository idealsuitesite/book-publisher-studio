'use client';

import { useEffect, useRef, useState } from 'react';
import { exportManuscript } from '@/lib/api-client';
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
  file: File;
  layout: string;
  theme: string;
  layoutLabel: string;
  themeLabel: string;
  onGenerated?: () => void;
}

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; blobUrl: string; pageCount: number | null; layout: string; theme: string }
  | { status: 'error'; message: string };

function countPdfPages(bytes: ArrayBuffer): number | null {
  const text = new TextDecoder('latin1').decode(bytes);
  const matches = text.match(/\/MediaBox/g);
  return matches ? matches.length : null;
}

export function PreviewPanel({ file, layout, theme, layoutLabel, themeLabel, onGenerated }: PreviewPanelProps) {
  const [state, setState] = useState<PreviewState>({ status: 'idle' });
  const blobUrlRef = useRef<string | null>(null);

  // Staleness (the current preview no longer matches the selected layout/theme) is a derived
  // render-time value, not effect-driven state - avoids the cascading-setState-in-effect
  // anti-pattern a layout-change useEffect would otherwise trigger on every mount.
  const isStale = state.status === 'ready' && (state.layout !== layout || state.theme !== theme);

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
      const blob = await exportManuscript({ file, theme, layout, format: 'pdf' });
      const bytes = await blob.arrayBuffer();
      const pageCount = countPdfPages(bytes);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      setState({ status: 'ready', blobUrl, pageCount, layout, theme });
      onGenerated?.();
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Preview failed.' });
    }
  }

  return (
    <Card className="flex max-w-2xl flex-col gap-4 px-8 py-6 text-left">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Preview</h3>
        <Button onClick={() => void generatePreview()} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Generating…' : state.status === 'ready' ? 'Regenerate Preview' : 'Generate Preview'}
        </Button>
      </div>

      <dl className="flex flex-wrap gap-6 text-sm">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Format</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{layoutLabel}</dd>
        </div>
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Theme</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-50">{themeLabel}</dd>
        </div>
        {state.status === 'ready' && state.pageCount != null && (
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Estimated pages</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50">{state.pageCount}</dd>
          </div>
        )}
      </dl>

      {state.status === 'error' && <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>}

      {isStale && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Layout or theme changed since this preview was generated — click Regenerate Preview to update it.
        </p>
      )}

      {state.status === 'ready' && (
        <embed
          src={state.blobUrl}
          type="application/pdf"
          className={`h-[500px] w-full rounded-lg border border-zinc-200 dark:border-zinc-800 ${isStale ? 'opacity-50' : ''}`}
        />
      )}
    </Card>
  );
}
