'use client';

import { useEffect, useState } from 'react';
import type { ProjectDTO, StructureSuggestionDTO } from 'shared-types';
import { fetchStructureSuggestions, editStructure } from '@/lib/api-client';
import { Button } from '@/components/ui';

/**
 * STRUCTURE_ASSIST — the review panel (STRUCTURE_ASSIST_DR.md §6.4). A manuscript whose structure
 * the author typed as plain text (`CHAPTER 1`, `INTRODUCTION`) gets a checklist of proposed
 * chapters. The author confirms — never the system: each confirmation is the existing
 * `promoteToChapter` mutation.
 *
 * The ≈1-gesture target is "Make all …": it promotes the proposals in REVERSE document order so
 * every marker is still a top-level block when it is promoted (promoteToChapter carries the blocks
 * AFTER a marker into its new chapter; going last-first keeps each split clean and flat). Per-item
 * confirm and dismiss handle the exceptions; a dismissed candidate is remembered for THIS editing
 * session only (a Set in state), consistent with the version model.
 *
 * Silent when it has nothing to say: an already-structured book yields no suggestions and the
 * panel renders nothing — the over-structured pole (§3), a success, not a nag.
 */
interface Props {
  projectId: string;
  /** Bumps when the book changes — re-fetch so the proposal reflects the current structure. */
  refreshKey: string;
  onEdited: (project: ProjectDTO) => void;
}

export function StructureSuggestionsPanel({ projectId, refreshKey, onEdited }: Props) {
  const [suggestions, setSuggestions] = useState<StructureSuggestionDTO[] | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  // FOUNDER_TRAVERSAL_3 A1: track WHICH control is in flight ('all', or a block's id), not one shared
  // flag — so an operation changes only its OWN button's state (the EDITION_BUTTON_STATE fix, defect 5
  // pattern: a Set of in-flight keys, the other buttons stay clickable). Latency is BATCH_CONFIRM_LATENCY.
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchStructureSuggestions(projectId)
      .then((s) => live && setSuggestions(s))
      .catch(() => live && setSuggestions([]));
    return () => {
      live = false;
    };
  }, [projectId, refreshKey]);

  if (suggestions === null) return null; // loading — no flash
  const active = suggestions.filter((s) => !dismissed.has(s.blockId));
  if (active.length === 0) return null; // nothing to suggest → stay silent (the over-structured pole)

  // BATCH_CONFIRM_LATENCY correctif A: "Make all" is now ONE call — one snapshot, one save, one
  // round-trip (was N sequential round-trips each saving the whole aggregate). The reverse-order law
  // moved SERVER-SIDE (BookEditingService.applyBatch), so the panel sends the ids as they are.
  async function run(key: string, call: () => Promise<ProjectDTO>) {
    setBusyKeys((prev) => new Set(prev).add(key));
    setError(null);
    try {
      onEdited(await call()); // the refreshKey change re-fetches the now-smaller proposal
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the chapter.');
    } finally {
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  const promoteAll = (ids: string[]) => run('all', () => editStructure(projectId, { type: 'batchApply', op: 'promoteToChapter', ids }));
  // The per-item button stays one-gesture-one-version (its own undo label), not a batch of one.
  const promoteOne = (blockId: string) => run(blockId, () => editStructure(projectId, { type: 'promoteToChapter', blockId }));

  return (
    <section
      aria-label="Suggested chapters"
      className="flex flex-col gap-3 rounded-lg border border-app-accent bg-app-surface-2 px-5 py-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-app-text">
            {active.length} suggested chapter{active.length === 1 ? '' : 's'}
          </h3>
          <p className="mt-0.5 text-xs text-app-text-muted">
            We found headings you typed as text. Confirm to turn them into chapters — nothing changes until you do.
          </p>
        </div>
        <Button onClick={() => void promoteAll(active.map((s) => s.blockId))} disabled={busyKeys.has('all')}>
          {busyKeys.has('all') ? 'Working…' : 'Make all chapters'}
        </Button>
      </div>

      {error && <p className="text-sm text-app-error">{error}</p>}

      <ul className="flex flex-col divide-y divide-app-border">
        {active.map((s) => (
          <li key={s.blockId} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 truncate text-sm text-app-text" title={s.evidence}>
              {s.proposedTitle}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {/* A1: only THIS row's Make chapter shows the in-flight state; every other button stays live. */}
              <button
                className="text-xs font-medium text-app-text underline underline-offset-2 hover:no-underline disabled:opacity-50"
                disabled={busyKeys.has(s.blockId)}
                onClick={() => void promoteOne(s.blockId)}
              >
                {busyKeys.has(s.blockId) ? 'Working…' : 'Make chapter'}
              </button>
              {/* Dismiss is synchronous (no round-trip) — it is never disabled by an in-flight op. */}
              <button
                className="text-xs text-app-text-muted hover:text-app-text"
                onClick={() => setDismissed((prev) => new Set(prev).add(s.blockId))}
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
