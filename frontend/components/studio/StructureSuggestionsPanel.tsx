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
  const [busy, setBusy] = useState(false);
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

  async function promote(blockIds: string[]) {
    setBusy(true);
    setError(null);
    try {
      let updated: ProjectDTO | undefined;
      // Reverse document order: promoteToChapter pulls the blocks after a marker into its chapter,
      // so promoting last-first keeps every remaining marker a top-level block (a clean flat split).
      for (const blockId of [...blockIds].reverse()) {
        updated = await editStructure(projectId, { type: 'promoteToChapter', blockId });
      }
      if (updated) onEdited(updated); // the refreshKey change re-fetches the now-smaller proposal
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the chapter.');
    } finally {
      setBusy(false);
    }
  }

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
        <Button onClick={() => void promote(active.map((s) => s.blockId))} disabled={busy}>
          {busy ? 'Working…' : 'Make all chapters'}
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
              <button
                className="text-xs font-medium text-app-text underline underline-offset-2 hover:no-underline disabled:opacity-50"
                disabled={busy}
                onClick={() => void promote([s.blockId])}
              >
                Make chapter
              </button>
              <button
                className="text-xs text-app-text-muted hover:text-app-text disabled:opacity-50"
                disabled={busy}
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
