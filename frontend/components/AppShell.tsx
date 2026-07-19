'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { checkHealth } from '@/lib/api-client';
import { StudioProvider, useStudio } from '@/components/studio/StudioContext';
import { Badge } from '@/components/ui';

/** The released version line (docs/VERSIONS.md). Real, not decorative. */
const APP_VERSION = 'v0.9.0-alpha · Sprint 9';

/**
 * The studio shell v2 (PRODUCT_EXPERIENCE §2, VISUAL_LANGUAGE identity: L'Atelier).
 *
 * Header and Status bar are permanent; both subscribe to StudioContext so the Workspace can
 * publish real project context into them — "on sait immédiatement où on travaille" without the
 * shell reaching into page state. The status bar is where the engine's measured truth lives
 * (Manifesto vow 3: show the craft): words, chapters, real pages, last render time. Nothing
 * shown that wasn't measured.
 */
function Header() {
  const { project } = useStudio();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-app-border bg-app-surface-1 px-5 py-2.5">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight text-app-text no-underline">
          Book Publisher Studio
        </Link>
        {project && (
          <>
            <span className="text-app-border">/</span>
            {/* The book speaks in its own type (VISUAL_LANGUAGE §4's signature move): the
                studio names the book in the book's own face. */}
            <span
              className="truncate text-base font-semibold text-app-text"
              style={project.bookVoice === 'serif' ? { fontFamily: 'var(--font-book), Georgia, serif' } : undefined}
            >
              {project.projectName}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-app-text-muted">
              <span className="text-app-success">●</span> Saved
            </span>
            <span className="shrink-0 text-xs tabular-nums text-app-text-muted">v{project.versionCount}</span>
            <Badge severity={project.blockingFindings === 0 ? 'success' : 'warning'}>
              {project.blockingFindings === 0
                ? 'Ready for Print'
                : `Ready for Print · ${project.blockingFindings} to fix`}
            </Badge>
          </>
        )}
      </div>
      <nav aria-label="Main" className="flex shrink-0 items-center gap-4">
        <Link href="/" className="text-sm font-medium text-app-text underline-offset-4 hover:underline">
          Studio
        </Link>
      </nav>
    </header>
  );
}

function StatusBar({ backendUp }: { backendUp: boolean | null }) {
  const { facts } = useStudio();
  const engineFacts = [
    facts.pages !== undefined && `${facts.pages} pages`,
    facts.words !== undefined && `${facts.words.toLocaleString('en-US')} words`,
    facts.chapters !== undefined && `${facts.chapters} chapters`,
    facts.lastRenderMs !== undefined && `render ${facts.lastRenderMs} ms`,
    facts.lastEdition,
  ].filter(Boolean);

  return (
    <footer
      aria-label="Status"
      className="flex items-center justify-between border-t border-app-border bg-app-surface-1 px-5 py-1.5 text-xs text-app-text-muted"
    >
      <span>
        Backend:{' '}
        {backendUp === null ? 'checking…' : backendUp ? 'connected' : 'unreachable — is the server running?'}
      </span>
      {/* The engine, visible (Manifesto vow 3). Tabular numerals: instrument readings. */}
      {/* Wall-clock render times live here - masked at baseline capture (determinism), never
          hidden from users. */}
      <span data-baseline-mask className="tabular-nums">{engineFacts.join(' · ')}</span>
      <span>{APP_VERSION}</span>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkHealth().then((up) => {
      if (!cancelled) setBackendUp(up);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StudioProvider>
      <div className="flex min-h-screen flex-col bg-app-surface-0">
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <StatusBar backendUp={backendUp} />
      </div>
    </StudioProvider>
  );
}
