'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { checkHealth } from '@/lib/api-client';

/** The released version line (docs/VERSIONS.md). Real, not decorative. */
const APP_VERSION = 'v0.9.0-alpha · Sprint 9';

/**
 * The studio shell (HOME_WORKSPACE.md Decision 2 + §0): Header / Workspace / Status as real
 * landmarks. The rule that shaped it: zones are structure, screens are features — the zones all
 * exist from day one, and a zone only ever carries real content. Navigation and Properties are
 * page-level concerns (the Workspace's station nav is an `aside` inside the page), because on
 * Home they would be empty boxes wearing a zone's name (Q-C).
 *
 * Left-aligned application layout, not centred landing-page layout — "penser application, pas
 * page web" (CTO).
 */
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
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b-2 border-app-border px-6 py-3">
        <Link href="/" className="flex items-baseline gap-3 no-underline">
          <span className="text-lg font-semibold tracking-tight text-app-text">Book Publisher Studio</span>
          <span className="hidden text-xs text-app-text-muted sm:inline">
            Create · Edit · Publish Professional Books
          </span>
        </Link>
        <nav aria-label="Main">
          <Link href="/" className="text-sm font-medium text-app-text underline-offset-4 hover:underline">
            Studio
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <footer
        aria-label="Status"
        className="flex items-center justify-between border-t-2 border-app-border px-6 py-2 text-xs text-app-text-muted"
      >
        <span>
          Backend:{' '}
          {backendUp === null ? 'checking…' : backendUp ? 'connected' : 'unreachable — is the server running?'}
        </span>
        <span>{APP_VERSION}</span>
      </footer>
    </div>
  );
}
