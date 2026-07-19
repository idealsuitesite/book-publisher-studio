'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectDTO, ManuscriptOptionsDTO } from 'shared-types';
import {
  getProject,
  getManuscriptOptions,
  updateProjectSettings,
  exportProject,
} from '@/lib/api-client';
import { BookStructureView } from '@/components/BookStructureView';
import { ValidationSummary } from '@/components/ValidationSummary';
import { FormatSelector } from '@/components/FormatSelector';
import { PreviewPanel } from '@/components/PreviewPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { PublishPanel } from '@/components/PublishPanel';
import { cx } from '@/components/ui';

// The stations (HOME_WORKSPACE.md §0: stations, not steps). One section at a time; the
// pipeline's first-pass guidance survives as per-station STATUS in the nav, never as sequence.
const STATIONS = ['Manuscript', 'Validation', 'Layout', 'Preview', 'Publish', 'History'] as const;
type Station = (typeof STATIONS)[number];

export default function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [options, setOptions] = useState<ManuscriptOptionsDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [station, setStation] = useState<Station>('Manuscript');

  const reload = useCallback(() => {
    void getProject(id)
      .then(setProject)
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : 'Could not open this project.')
      );
  }, [id]);

  useEffect(() => {
    reload();
    void getManuscriptOptions().then(setOptions).catch(() => setOptions(null));
  }, [reload]);

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-lg font-medium text-red-600 dark:text-red-400">Could not open this project</p>
        <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          {loadError} Projects currently live in memory — after a server restart the library starts
          empty and previous links expire.
        </p>
        <button
          onClick={() => router.push('/')}
          className="text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
        >
          Back to the studio
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <p className="animate-pulse text-sm text-zinc-500 dark:text-zinc-400">Opening project…</p>
      </div>
    );
  }

  const layoutLabel =
    options?.layouts.find((l) => l.name === project.settings.layoutName)?.label ?? project.settings.layoutName;
  const themeLabel =
    options?.themes.find((t) => t.name === project.settings.themeName)?.label ?? project.settings.themeName;
  const settingsKey = `${project.settings.layoutName}/${project.settings.themeName}`;

  // Station status: the pipeline's guidance, demoted from sequence to information.
  const status: Partial<Record<Station, string>> = {
    Validation: `${project.report.score.overall}/100`,
    Layout: layoutLabel,
    Publish: project.publications.length > 0 ? `${project.publications.length}` : undefined,
    History: project.versions.length > 0 ? `${project.versions.length}` : undefined,
  };

  async function changeSettings(patch: { layoutName?: string; themeName?: string }) {
    await updateProjectSettings(id, patch);
    reload();
  }

  return (
    <div className="flex flex-1">
      <aside aria-label="Project sections" className="w-48 shrink-0 border-r-2 border-app-border px-4 py-6">
        <nav>
          <ul className="flex flex-col gap-1">
            {STATIONS.map((name) => (
              <li key={name}>
                <button
                  onClick={() => setStation(name)}
                  aria-current={station === name ? 'page' : undefined}
                  className={cx(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm',
                    station === name
                      ? 'bg-zinc-200 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
                  )}
                >
                  {name}
                  {status[name] && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{status[name]}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <section aria-label={station} className="flex flex-1 flex-col items-start gap-6 overflow-y-auto px-8 py-8">
        {station === 'Manuscript' && (
          <BookStructureView
            book={project.book}
            filename={project.sourceFilename ?? null}
            onReset={() => router.push('/')}
          />
        )}
        {station === 'Validation' && <ValidationSummary report={project.report} />}
        {station === 'Layout' && options && (
          <FormatSelector
            options={options}
            selectedLayout={project.settings.layoutName}
            selectedTheme={project.settings.themeName}
            onLayoutChange={(layoutName) => void changeSettings({ layoutName })}
            onThemeChange={(themeName) => void changeSettings({ themeName })}
          />
        )}
        {station === 'Preview' && (
          <PreviewPanel
            exporter={() => exportProject(id, 'pdf')}
            settingsKey={settingsKey}
            layoutLabel={layoutLabel}
            themeLabel={themeLabel}
          />
        )}
        {station === 'Publish' && (
          <>
            <ExportPanel exporter={(format) => exportProject(id, format)} downloadName={project.name} />
            <PublishPanel projectId={id} onPublished={reload} />
          </>
        )}
        {station === 'History' && (
          <div className="flex w-full max-w-2xl flex-col gap-6 text-left">
            <div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Versions</h3>
              {project.versions.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No versions yet — publishing snapshots one automatically.
                </p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {project.versions.map((version) => (
                    <li key={version.id}>
                      Version {version.number}
                      {version.label && <span className="text-zinc-500 dark:text-zinc-400"> · {version.label}</span>}
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {' '}
                        · {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Publications</h3>
              {project.publications.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No publication attempts yet.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm text-zinc-900 dark:text-zinc-50">
                  {project.publications.map((event, index) => (
                    <li key={index}>
                      <span className="font-medium uppercase">{event.target}</span> — {event.status}
                      {event.versionNumber !== undefined && (
                        <span className="text-zinc-500 dark:text-zinc-400"> · version {event.versionNumber}</span>
                      )}
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {' '}
                        · {new Date(event.occurredAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <aside
        aria-label="Project properties"
        className="hidden w-56 shrink-0 border-l-2 border-app-border px-4 py-6 text-sm xl:block"
      >
        <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">{project.name}</h2>
        <dl className="flex flex-col gap-2 text-zinc-600 dark:text-zinc-400">
          <div>
            <dt className="text-xs uppercase">Author</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{project.book.metadata.author}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase">Layout</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{layoutLabel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase">Theme</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{themeLabel}</dd>
          </div>
          {project.sourceFilename && (
            <div>
              <dt className="text-xs uppercase">Source</dt>
              <dd className="break-all text-zinc-900 dark:text-zinc-50">{project.sourceFilename}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase">Updated</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{new Date(project.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
