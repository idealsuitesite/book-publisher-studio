'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProjectSummaryDTO } from 'shared-types';
import { listProjects } from '@/lib/api-client';
import { UploadDropzone } from '@/components/UploadDropzone';
import { Card } from '@/components/ui';

/**
 * Home (HOME_WORKSPACE.md §0): the library. Answers the CTO's three questions — quels projets,
 * que fais-je aujourd'hui, que viens-je de publier — and never shows any book's content; that
 * is the Workspace's context. Everything on this page comes from GET /api/projects.
 */
export default function Home() {
  const [projects, setProjects] = useState<ProjectSummaryDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listProjects()
      .then((result) => {
        if (!cancelled) setProjects(result.projects);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not load projects.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const published = (projects ?? []).flatMap((p) =>
    p.publishedTargets.map((target) => ({ project: p, target }))
  );
  const versionCount = (projects ?? []).reduce((sum, p) => sum + p.versionCount, 0);
  const distinctTargets = [...new Set(published.map((entry) => entry.target))];

  // MINI_DR_HOME_STATE_LAYOUT (Option D): the Home re-weights by library state — no new routes,
  // Home stays the library (HOME_WORKSPACE Decision 1). Loading and error are neutral first.
  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-lg font-medium text-app-error">Could not load your studio</p>
        <p className="max-w-md text-sm text-app-text-muted">{loadError}</p>
      </div>
    );
  }
  if (projects === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <p className="animate-pulse text-sm text-app-text-muted">Loading your studio…</p>
      </div>
    );
  }

  const hasProjects = projects.length > 0;

  // Empty library (0 projects): the upload IS the screen — first-run, where import is the point.
  if (!hasProjects) {
    return (
      <div className="flex flex-1 flex-col gap-10 px-8 py-10 lg:px-16">
        <section aria-label="Start" className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-app-text">Your studio</h1>
            <p className="mt-1 text-sm text-app-text-muted">Bring in a manuscript to start your first project.</p>
          </div>
          <UploadDropzone />
          {/* The honest empty state (ADR-0046/0047) — also the post-restart state; a fake-persistent
              look would be a lie. */}
          <p className="text-sm text-app-text-muted">No projects yet — import your first manuscript above to create one.</p>
        </section>
      </div>
    );
  }

  // Non-empty library: the library LEADS, with a visible primary import button (not the full form
  // competing for the first screen) — the §3A problem this fixes.
  return (
    <div className="flex flex-1 flex-col gap-10 px-8 py-10 lg:px-16">
      <section aria-label="Start" className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-app-text">Your studio</h1>
          <p className="mt-1 text-sm text-app-text-muted">Continue where you left off, or import a new manuscript.</p>
        </div>
        <UploadDropzone variant="button" />
      </section>

      <section aria-label="Recent projects" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-app-text">Recent projects</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="flex h-full flex-col gap-2 px-6 py-5">
                <p className="text-base font-semibold text-app-text">{project.name}</p>
                <p className="text-sm text-app-text-muted">
                  {project.bookTitle} · {project.author}
                </p>
                <p className="text-xs text-app-text-muted">
                  {project.versionCount} version{project.versionCount === 1 ? '' : 's'}
                  {project.publishedTargets.length > 0 && ` · published: ${project.publishedTargets.join(', ')}`}
                </p>
                <Link
                  href={`/projects/${project.id}`}
                  className="mt-auto pt-2 text-sm font-medium text-app-text underline underline-offset-4 dark:text-app-text"
                >
                  Continue
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {published.length > 0 && (
        <section aria-label="Recent publications" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-app-text">Recent publications</h2>
          <ul className="flex flex-col gap-1 text-sm text-app-text">
            {published.slice(0, 5).map((entry, index) => (
              <li key={index}>
                <span className="font-medium uppercase">{entry.target}</span>
                <span className="text-app-text-muted"> — {entry.project.bookTitle}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Statistics" className="flex gap-10 border-t-2 border-app-border pt-6 text-sm">
        <div>
          <p className="text-2xl font-semibold text-app-text">{projects.length}</p>
          <p className="text-app-text-muted">book{projects.length === 1 ? '' : 's'}</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-app-text">{versionCount}</p>
          <p className="text-app-text-muted">version{versionCount === 1 ? '' : 's'}</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-app-text">{distinctTargets.length}</p>
          <p className="text-app-text-muted">publication target{distinctTargets.length === 1 ? '' : 's'}</p>
        </div>
      </section>
    </div>
  );
}
