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

  return (
    <div className="flex flex-1 flex-col gap-10 px-8 py-10 lg:px-16">
      <section aria-label="Start" className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Your studio
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Import a manuscript to create a project, or continue where you left off.
          </p>
        </div>
        <UploadDropzone />
      </section>

      <section aria-label="Recent projects" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent projects</h2>
        {loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
        {projects && projects.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {/* The honest empty state: also the post-restart state until persistence lands
                (ADR-0046/0047) - a fake-persistent look would be a lie. */}
            No projects yet — import your first manuscript above to create one.
          </p>
        )}
        {projects && projects.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Card className="flex h-full flex-col gap-2 px-6 py-5">
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{project.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {project.bookTitle} · {project.author}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {project.versionCount} version{project.versionCount === 1 ? '' : 's'}
                    {project.publishedTargets.length > 0 && ` · published: ${project.publishedTargets.join(', ')}`}
                  </p>
                  <Link
                    href={`/projects/${project.id}`}
                    className="mt-auto pt-2 text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
                  >
                    Continue
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {published.length > 0 && (
        <section aria-label="Recent publications" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent publications</h2>
          <ul className="flex flex-col gap-1 text-sm text-zinc-900 dark:text-zinc-50">
            {published.slice(0, 5).map((entry, index) => (
              <li key={index}>
                <span className="font-medium uppercase">{entry.target}</span>
                <span className="text-zinc-500 dark:text-zinc-400"> — {entry.project.bookTitle}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {projects && projects.length > 0 && (
        <section aria-label="Statistics" className="flex gap-10 border-t-2 border-app-border pt-6 text-sm">
          <div>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{projects.length}</p>
            <p className="text-zinc-500 dark:text-zinc-400">book{projects.length === 1 ? '' : 's'}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{versionCount}</p>
            <p className="text-zinc-500 dark:text-zinc-400">version{versionCount === 1 ? '' : 's'}</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{distinctTargets.length}</p>
            <p className="text-zinc-500 dark:text-zinc-400">
              publication target{distinctTargets.length === 1 ? '' : 's'}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
