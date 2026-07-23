'use client';

import { useEffect, useState } from 'react';
import type { ProjectDTO, CleanupSuggestionDTO } from 'shared-types';
import { fetchCleanupSuggestions, editStructure } from '@/lib/api-client';
import { Button } from '@/components/ui';

/**
 * STRUCTURE_CLEANUP — the review panel (STRUCTURE_CLEANUP_DR.md §6.4). The over-structured mirror of
 * the assist's panel: a manuscript where the author styled `CHAPTER 1` / `INTRODUCTION` as their OWN
 * empty headings gets a checklist of redundant markers, each proposed for collapse into the real
 * chapter that follows it. The author confirms — never the system: each confirmation is the existing
 * `collapseMarker` mutation.
 *
 * "Collapse all" applies each `collapseMarker` by id — order-independent (removing one empty marker
 * never changes another marker's immediate successor), unlike the assist's reverse-order promote.
 * Per-item collapse and dismiss handle the exceptions; a dismissed candidate is remembered for THIS
 * editing session only (a Set in state), consistent with the version model.
 *
 * Silent when it has nothing to say: an under-structured (or already-clean) book yields no
 * suggestions and the panel renders nothing — the bidirectional pole (§3), a success, not a nag.
 */
interface Props {
  projectId: string;
  /** Bumps when the book changes — re-fetch so the proposal reflects the current structure. */
  refreshKey: string;
  onEdited: (project: ProjectDTO) => void;
}

export function CleanupSuggestionsPanel({ projectId, refreshKey, onEdited }: Props) {
  const [suggestions, setSuggestions] = useState<CleanupSuggestionDTO[] | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  // FOUNDER_TRAVERSAL_3 A1: track WHICH control is in flight ('all', or a marker's id), not one shared
  // flag — so an operation changes only its OWN button's state (the EDITION_BUTTON_STATE fix, defect 5
  // pattern: a Set of in-flight keys, the other buttons stay clickable). Latency is BATCH_CONFIRM_LATENCY.
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchCleanupSuggestions(projectId)
      .then((s) => live && setSuggestions(s))
      .catch(() => live && setSuggestions([]));
    return () => {
      live = false;
    };
  }, [projectId, refreshKey]);

  if (suggestions === null) return null; // loading — no flash
  const active = suggestions.filter((s) => !dismissed.has(s.markerId));
  if (active.length === 0) return null; // nothing to collapse → stay silent (the bidirectional pole)

  // BATCH_CONFIRM_LATENCY correctif A: "Collapse all" is ONE call now (was N sequential saves).
  // collapseMarker is order-independent (the domain applyBatch documents it), so the ids go as-is.
  async function run(key: string, call: () => Promise<ProjectDTO>) {
    setBusyKeys((prev) => new Set(prev).add(key));
    setError(null);
    try {
      onEdited(await call()); // the refreshKey change re-fetches the now-smaller proposal
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not collapse the marker.');
    } finally {
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  const collapseAll = (ids: string[]) => run('all', () => editStructure(projectId, { type: 'batchApply', op: 'collapseMarker', ids }));
  const collapseOne = (markerId: string) => run(markerId, () => editStructure(projectId, { type: 'collapseMarker', markerId }));

  return (
    <section
      aria-label="Redundant chapter markers"
      className="flex flex-col gap-3 rounded-lg border border-app-accent bg-app-surface-2 px-5 py-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-app-text">
            {active.length} redundant chapter marker{active.length === 1 ? '' : 's'}
          </h3>
          <p className="mt-0.5 text-xs text-app-text-muted">
            You styled these as their own empty headings. Collapse each into the chapter it belongs to — nothing changes until you confirm.
          </p>
        </div>
        <Button onClick={() => void collapseAll(active.map((s) => s.markerId))} disabled={busyKeys.has('all')}>
          {busyKeys.has('all') ? 'Working…' : 'Collapse all'}
        </Button>
      </div>

      {error && <p className="text-sm text-app-error">{error}</p>}

      <ul className="flex flex-col divide-y divide-app-border">
        {active.map((s) => (
          <li key={s.markerId} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 truncate text-sm text-app-text" title={`${s.markerText} → ${s.targetTitle}`}>
              <span className="font-medium">{s.markerText}</span>
              <span className="text-app-text-muted"> → {s.canonicalLabel ?? s.targetTitle}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {/* A1: only THIS row's Collapse shows the in-flight state; every other button stays live. */}
              <button
                className="text-xs font-medium text-app-text underline underline-offset-2 hover:no-underline disabled:opacity-50"
                disabled={busyKeys.has(s.markerId)}
                onClick={() => void collapseOne(s.markerId)}
              >
                {busyKeys.has(s.markerId) ? 'Working…' : 'Collapse'}
              </button>
              {/* Dismiss is synchronous (no round-trip) — it is never disabled by an in-flight op. */}
              <button
                className="text-xs text-app-text-muted hover:text-app-text"
                onClick={() => setDismissed((prev) => new Set(prev).add(s.markerId))}
              >
                Dismiss
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
