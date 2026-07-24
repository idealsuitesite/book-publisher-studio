'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { PdfProof } from '@/components/PdfProof';
import { renderRegion } from '@/lib/api-client';

/**
 * The living Proof's region-fetch loop (AUTHOR_EXPERIENCE_DR D4 / M2-C5) — the frontend wiring P1 left
 * for this chantier. It turns the measured region engine (~31 ms) into the FELT edit loop (criterion A):
 *
 *  • A FULL render on mount and on a GEOMETRY change (theme/layout — `settingsKey`) establishes the
 *    authoritative whole-book page total and paints every page.
 *  • A CONTENT edit (`editNonce` bump) REGION-renders only the visible window immediately — the visible
 *    pages re-ink under the eye, the scroll position preserved (PdfProof paints into full-book slots at
 *    the region's page offset). Then a debounced BACKGROUND FULL render re-syncs the authoritative total
 *    and repaints the whole book.
 *  • Between the edit and that re-sync the whole-book total is shown PROVISIONAL — "≈ N", never a stale N
 *    dressed as final (the ADR-0050/0051 honesty; CTO graven gate point 2, affirmed by test). The per-page
 *    footer inside the region is exact; only the whole-book denominator is marked provisional.
 *
 * The debounce is a consigned-revisable value (D4/V4), the sibling of the 500 ms re-ink debounce — a
 * measured-reasonable default, moved only at the founder taste-stop.
 */
const SYNC_DEBOUNCE_MS = 800;

function countPdfPages(bytes: ArrayBuffer): number | null {
  const text = new TextDecoder('latin1').decode(bytes);
  const matches = text.match(/\/MediaBox/g);
  return matches ? matches.length : null;
}

interface LiveProofProps {
  projectId: string;
  /** The full render (a content-agnostic PDF of the whole stored book). */
  exporter: () => Promise<Blob>;
  /** A geometry key (theme/layout) — a change forces a full render (the total is authoritative). */
  settingsKey: string;
  layoutLabel: string;
  themeLabel: string;
  /** Bumped by the workspace after a CONTENT edit — triggers the region re-ink loop. */
  editNonce: number;
  onPageCount?: (pages: number | null) => void;
}

export function LiveProof({ projectId, exporter, settingsKey, layoutLabel, themeLabel, editNonce, onPageCount }: LiveProofProps) {
  const [fullBytes, setFullBytes] = useState<ArrayBuffer | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [region, setRegion] = useState<{ bytes: ArrayBuffer; start: number } | null>(null);
  const [provisional, setProvisional] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  // Refs so the effects can use the latest exporter/callback without re-running on every parent render
  // (the exporter is a fresh closure each render; depending on it would thrash the loop).
  const exporterRef = useRef(exporter);
  const onPageCountRef = useRef(onPageCount);
  const totalRef = useRef<number | null>(null);
  const visibleRef = useRef<{ start: number; end: number }>({ start: 1, end: 1 });
  // A monotonic token: any newer operation invalidates an older one's late completion (never go backwards).
  const tokenRef = useRef(0);

  // Sync the "latest value" refs AFTER render (not during — the react-hooks/refs discipline). Declared
  // FIRST so it runs before the loop effects below in the same commit, keeping them on current values.
  useEffect(() => {
    exporterRef.current = exporter;
    onPageCountRef.current = onPageCount;
    totalRef.current = total;
  });

  async function runFullRender(token: number): Promise<void> {
    setRefreshing(true);
    setError(null);
    try {
      const blob = await exporterRef.current();
      if (tokenRef.current !== token) return;
      const bytes = await blob.arrayBuffer();
      const pages = countPdfPages(bytes);
      setFullBytes(bytes);
      setRegion(null);
      setProvisional(false);
      setTotal(pages);
      onPageCountRef.current?.(pages);
      setRefreshing(false);
    } catch (e) {
      if (tokenRef.current !== token) return;
      setError(e instanceof Error ? e.message : 'The Proof could not be generated.');
      setRefreshing(false);
    }
  }

  // FULL render — mount, geometry change, and manual retry. Authoritative total.
  useEffect(() => {
    const token = ++tokenRef.current;
    void runFullRender(token);
  }, [settingsKey, retry]);

  // CONTENT edit — region re-ink now, provisional total, background full re-sync. Skips the first run
  // (mount): the full render above owns the initial paint; editNonce only reacts to real edits.
  const firstEdit = useRef(true);
  useEffect(() => {
    if (firstEdit.current) {
      firstEdit.current = false;
      return;
    }
    const knownTotal = totalRef.current;
    if (!knownTotal) return; // no full render yet to region against
    const token = ++tokenRef.current;
    let syncTimer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      setRefreshing(true);
      setError(null);
      try {
        const { start, end } = visibleRef.current;
        const from = Math.max(1, start - 1);
        const to = end + 1; // the server clamps the top end to the real page count
        const result = await renderRegion(projectId, from, to, knownTotal);
        if (tokenRef.current !== token) return;
        setRegion({ bytes: result.bytes, start: result.start });
        setProvisional(true); // the whole-book total is now stale-but-marked, never a false N
        setRefreshing(false);
        // Background full re-sync (debounced) — restores the authoritative total + the whole book.
        syncTimer = setTimeout(() => {
          const syncToken = ++tokenRef.current;
          void runFullRender(syncToken); // runFullRender re-inks + re-establishes the authoritative total
        }, SYNC_DEBOUNCE_MS);
      } catch {
        if (tokenRef.current !== token) return;
        // The region failed — fall back to a full render so the Proof still reflects the edit honestly.
        void runFullRender(token);
      }
    })();

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editNonce]);

  const displayBytes = region ? region.bytes : fullBytes;

  return (
    <Card className="flex max-w-2xl flex-col gap-4 px-8 py-6 text-left">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-app-text">Proof</h3>
        <span className="text-xs text-app-text-muted" aria-live="polite">
          {refreshing ? 'Re-inking…' : region ? 'Preview — syncing…' : fullBytes ? 'Up to date' : ''}
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
        {total != null && (
          <div>
            <dt className="text-app-text-muted">Pages</dt>
            {/* The whole-book denominator: exact, or PROVISIONAL "≈ N" between an edit and its re-sync —
                never a stale number presented as final (D4, CTO graven gate point 2). */}
            <dd
              className={provisional ? 'font-medium tabular-nums text-app-text-muted' : 'font-medium tabular-nums text-app-text'}
              data-provisional={provisional ? 'true' : undefined}
              title={provisional ? 'Provisional total — re-syncing after your edit' : undefined}
            >
              {provisional ? `≈ ${total}` : total}
            </dd>
          </div>
        )}
      </dl>

      {error && (
        <p role="alert" className="text-sm text-app-error">
          {error}{' '}
          <Button variant="link" onClick={() => setRetry((n) => n + 1)} className="text-sm">
            Try again
          </Button>
        </p>
      )}

      {displayBytes ? (
        <PdfProof
          bytes={displayBytes}
          refreshing={refreshing}
          ariaLabel="Book proof preview"
          className="h-[500px] w-full rounded-lg border border-app-border bg-app-surface-2"
          pageOffset={region ? region.start : undefined}
          totalPages={region ? total ?? undefined : undefined}
          onVisibleRange={(start, end) => {
            visibleRef.current = { start, end };
          }}
        />
      ) : (
        <div className="flex h-[500px] w-full items-center justify-center rounded-lg border border-app-border bg-app-surface-2">
          <p className="animate-pulse text-sm text-app-text-muted">Setting the first proof…</p>
        </div>
      )}
    </Card>
  );
}
