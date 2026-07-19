'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * What the shell's permanent zones know about the current work (PRODUCT_EXPERIENCE §2).
 *
 * The Workspace publishes; the Header and Status bar subscribe. This is how "on sait
 * immédiatement où on travaille" works without the shell reaching into page state: one narrow,
 * typed channel. Everything in it is real — the shell shows nothing it wasn't told by a page
 * that measured it.
 */
export interface ProjectHeaderContext {
  projectId: string;
  projectName: string;
  /** The book's theme family, so the shell can speak the book's own type (VISUAL_LANGUAGE §4). */
  bookVoice: 'serif' | 'sans';
  versionCount: number;
  /** Ready-for-Print state: number of blocking findings; 0 = ready. */
  blockingFindings: number;
  score: number;
}

export interface EngineFacts {
  words?: number;
  chapters?: number;
  /** Real measured pages, present only after a proof has been produced this session. */
  pages?: number;
  /** Wall-clock ms of the last proof/edition render, when one happened. */
  lastRenderMs?: number;
  /** Label of the last edition created this session, e.g. "PDF · 2 min ago". */
  lastEdition?: string;
}

interface StudioState {
  project: ProjectHeaderContext | null;
  facts: EngineFacts;
  setProject: (project: ProjectHeaderContext | null) => void;
  setFacts: (facts: Partial<EngineFacts>) => void;
}

const StudioContext = createContext<StudioState | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<ProjectHeaderContext | null>(null);
  const [facts, setFactsState] = useState<EngineFacts>({});

  // STABLE identity, deliberately: consumers put these setters in effect dependency arrays.
  // The first draft created setFacts inside the value useMemo (which depends on `facts`), so
  // every call minted a new identity, re-armed the caller's effect, and looped —
  // "Maximum update depth exceeded", found by the baseline capture crashing mid-journey.
  const setFacts = useCallback((patch: Partial<EngineFacts>) => {
    setFactsState((current) => ({ ...current, ...patch }));
  }, []);

  const value = useMemo<StudioState>(
    () => ({ project, facts, setProject, setFacts }),
    [project, facts, setFacts]
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioState {
  const context = useContext(StudioContext);
  if (!context) throw new Error('useStudio must be used within StudioProvider');
  return context;
}
