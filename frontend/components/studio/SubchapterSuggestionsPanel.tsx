'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProjectDTO, SubchapterSuggestionDTO } from 'shared-types';
import { fetchSubchapterSuggestions, editStructure } from '@/lib/api-client';
import { Button } from '@/components/ui';

/**
 * SUBCHAPTER_PROMOTION — the review panel (SUBCHAPTER_PROMOTION_DR §5). The third structural form:
 * an author who typed the same editorial name (e.g. "Conclusion") at the end of every chapter is
 * offered to make each a SECTION of its chapter — a continuity — never N peer chapters.
 *
 * Governed by the founder's law "une ligne, une décision": recurring occurrences of the SAME name are
 * ONE row and ONE decision — "'Conclusion' repeats in 26 chapters — make each a section?" — not 26
 * identical rows, no input field, no competing options. "Make sections" is ONE batch call
 * (BATCH_CONFIRM_LATENCY correctif A — `batchApply` op `promoteToSubsection`); the greedy
 * reverse-document-order law lives SERVER-SIDE now. Button state follows A1: a Set of in-flight keys,
 * only the in-flight button changes state. Silent when nothing recurs — the family's third silence pole.
 */
interface Props {
  projectId: string;
  refreshKey: string;
  onEdited: (project: ProjectDTO) => void;
}

interface Group {
  key: string;
  label: string;
  blockIds: string[]; // in document order
}

export function SubchapterSuggestionsPanel({ projectId, refreshKey, onEdited }: Props) {
  const [suggestions, setSuggestions] = useState<SubchapterSuggestionDTO[] | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchSubchapterSuggestions(projectId)
      .then((s) => live && setSuggestions(s))
      .catch(() => live && setSuggestions([]));
    return () => {
      live = false;
    };
  }, [projectId, refreshKey]);

  // One row per recurring editorial NAME (une ligne, une décision) — occurrences grouped by key.
  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, Group>();
    for (const s of suggestions ?? []) {
      const g = byKey.get(s.key) ?? { key: s.key, label: s.proposedTitle, blockIds: [] };
      g.blockIds.push(s.blockId);
      byKey.set(s.key, g);
    }
    return [...byKey.values()];
  }, [suggestions]);

  if (suggestions === null) return null; // loading — no flash
  const active = groups.filter((g) => !dismissed.has(g.key));
  if (active.length === 0) return null; // nothing recurs → stay silent (the third silence pole)

  // BATCH_CONFIRM_LATENCY correctif A: a group's "Make sections" is ONE call now (was one round-trip
  // per marker). The greedy reverse-document-order law moved SERVER-SIDE (BookEditingService.applyBatch),
  // so the panel sends the group's ids as-is; the server orders them from the book.
  async function makeSections(group: Group) {
    setBusyKeys((prev) => new Set(prev).add(group.key));
    setError(null);
    try {
      onEdited(await editStructure(projectId, { type: 'batchApply', op: 'promoteToSubsection', ids: group.blockIds }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make the section.');
    } finally {
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(group.key);
        return next;
      });
    }
  }

  return (
    <section
      aria-label="Recurring chapter endings"
      className="flex flex-col gap-3 rounded-lg border border-app-accent bg-app-surface-2 px-5 py-4"
    >
      <ul className="flex flex-col divide-y divide-app-border">
        {active.map((g) => (
          <li key={g.key} className="flex items-center justify-between gap-3 py-1.5">
            <span className="min-w-0 text-sm text-app-text">
              <span className="font-medium">“{g.label}”</span> repeats in {g.blockIds.length} chapter{g.blockIds.length === 1 ? '' : 's'} — make each a section of its chapter?
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Button onClick={() => void makeSections(g)} disabled={busyKeys.has(g.key)}>
                {busyKeys.has(g.key) ? 'Working…' : 'Make sections'}
              </Button>
              {/* Dismiss is synchronous — never disabled by an in-flight op (A1). */}
              <button
                className="text-xs text-app-text-muted hover:text-app-text"
                onClick={() => setDismissed((prev) => new Set(prev).add(g.key))}
              >
                Dismiss
              </button>
            </span>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-app-error">{error}</p>}
    </section>
  );
}
