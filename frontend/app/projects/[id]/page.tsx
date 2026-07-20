'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectDTO, ManuscriptOptionsDTO } from 'shared-types';
import {
  ApiError,
  getProject,
  getManuscriptOptions,
  updateProjectSettings,
  exportProject,
} from '@/lib/api-client';
import { computeBookFacts, unstructuredFinding } from '@/lib/bookFacts';
import { useStudio } from '@/components/studio/StudioContext';
import { Explorer, buildExplorer, type StudioView } from '@/components/studio/Explorer';
import { Inspector, inspectorRows } from '@/components/studio/Inspector';
import { BookDashboard } from '@/components/studio/BookDashboard';
import { ReadyForPrint } from '@/components/studio/ReadyForPrint';
import { CommandPalette, type PaletteCommand } from '@/components/studio/CommandPalette';
import { StructureEditor } from '@/components/studio/StructureEditor';
import { FormatSelector } from '@/components/FormatSelector';
import { PreviewPanel } from '@/components/PreviewPanel';
import { PublishDesk } from '@/components/studio/PublishDesk';
import { Timeline } from '@/components/studio/Timeline';

const VIEW_TITLES: Record<StudioView, string> = {
  dashboard: 'Overview',
  structure: 'Structure',
  validation: 'Ready for Print',
  layout: 'Layout',
  proof: 'Proof',
  editions: 'Editions & Publish',
  history: 'History',
};

const VIEW_ORDER: StudioView[] = ['dashboard', 'structure', 'validation', 'layout', 'proof', 'editions', 'history'];

/** Resume-where-left (PRODUCT_EXPERIENCE §10.1): per-project UI state, client-side until S11. */
const viewStorageKey = (id: string) => `bps.view.${id}`;

export default function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const studio = useStudio();
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [options, setOptions] = useState<ManuscriptOptionsDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Resume-where-left: lazy initial read so no effect-driven setState is needed.
  const [view, setViewState] = useState<StudioView>(() => {
    try {
      const saved = localStorage.getItem(viewStorageKey(id)) as StudioView | null;
      if (saved && VIEW_ORDER.includes(saved)) return saved;
    } catch {
      /* storage unavailable */
    }
    return 'dashboard';
  });
  const [measuredPages, setMeasuredPages] = useState<number | undefined>(undefined);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const setView = useCallback(
    (next: StudioView) => {
      setViewState(next);
      try {
        localStorage.setItem(viewStorageKey(id), next);
      } catch {
        /* storage unavailable is fine - resume is a comfort, not a contract */
      }
    },
    [id]
  );

  const reload = useCallback(() => {
    void getProject(id)
      .then(setProject)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === 'PROJECT_NOT_FOUND') {
          // ADR-0049 §3 recovery: a link to a project that no longer exists must not keep
          // resurrecting itself — drop its resume-where-left entry.
          try {
            localStorage.removeItem(viewStorageKey(id));
          } catch {
            /* storage unavailable */
          }
          // FIRST_SCREEN_ERROR.md: `/projects/[id]` is a real reloadable URL, so a stale deep
          // link (an old id, a reset db, a deleted project) restored on launch would land the
          // author on a terminal error screen as their FIRST contact. The project is gone; the
          // only useful place is the library — go there, don't dead-end. `replace` (not push)
          // so Back doesn't bounce straight into the dead link again. Other errors (network,
          // timeout, 500) are transient/retryable and keep the recoverable error screen below.
          router.replace('/');
          return;
        }
        setLoadError(error instanceof Error ? error.message : 'Could not open this project.');
      });
  }, [id, router]);

  useEffect(() => {
    reload();
    void getManuscriptOptions().then(setOptions).catch(() => setOptions(null));
  }, [id, reload]);

  // Publish real context into the shell (header + status bar) - and clear it on leave.
  const setStudioProject = studio.setProject;
  const setStudioFacts = studio.setFacts;
  useEffect(() => {
    if (!project) return;
    const blocking = project.report.issues.filter((issue) => issue.severity === 'ERROR').length;
    setStudioProject({
      projectId: project.id,
      projectName: project.name,
      bookVoice: 'serif',
      versionCount: project.versions.length,
      blockingFindings: blocking,
      score: project.report.score.overall,
    });
    const facts = computeBookFacts(project.book);
    setStudioFacts({
      words: project.book.wordCount,
      chapters: facts.chapters,
      pages: measuredPages,
      structureNeedsReview: Boolean(unstructuredFinding(project.report)),
    });
    return () => {
      setStudioProject(null);
      // Leaving the workspace clears the engine facts too - Home must not wear another
      // room's instruments.
      setStudioFacts({ words: undefined, chapters: undefined, pages: undefined, lastRenderMs: undefined, lastEdition: undefined });
    };
  }, [project, measuredPages, setStudioProject, setStudioFacts]);

  // Expert hands (PRODUCT_EXPERIENCE §10.3): Ctrl+K palette, Ctrl+1..7 views.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && /^[1-7]$/.test(event.key)) {
        event.preventDefault();
        setView(VIEW_ORDER[Number(event.key) - 1]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setView]);

  const facts = useMemo(() => (project ? computeBookFacts(project.book) : null), [project]);

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-lg font-medium text-app-error">Could not open this project</p>
        {/* Since ADR-0048 the library is durable — the old "projects live in memory" excuse
            became false the day SQLite landed, so the screen now says only what it knows. */}
        <p className="max-w-md text-sm text-app-text-muted">{loadError}</p>
        <button
          onClick={() => router.push('/')}
          className="text-sm font-medium text-app-text underline underline-offset-4"
        >
          Back to the studio
        </button>
      </div>
    );
  }

  if (!project || !facts) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <p className="animate-pulse text-sm text-app-text-muted">Opening project…</p>
      </div>
    );
  }

  const layoutLabel =
    options?.layouts.find((l) => l.name === project.settings.layoutName)?.label ?? project.settings.layoutName;
  const themeLabel =
    options?.themes.find((t) => t.name === project.settings.themeName)?.label ?? project.settings.themeName;
  const settingsKey = `${project.settings.layoutName}/${project.settings.themeName}`;

  const commands: PaletteCommand[] = [
    ...VIEW_ORDER.map((v, index) => ({
      id: `view-${v}`,
      label: VIEW_TITLES[v],
      hint: `Ctrl+${index + 1}`,
      run: () => setView(v),
    })),
    { id: 'home', label: 'Back to the studio', run: () => router.push('/') },
  ];

  async function changeSettings(patch: { layoutName?: string; themeName?: string }) {
    try {
      setSettingsError(null);
      await updateProjectSettings(id, patch);
      reload();
    } catch (error) {
      // Surfaced inline, never swallowed: an unhandled rejection here crashed straight into
      // the dev overlay when CORS refused PATCH - found by the real browser.
      setSettingsError(error instanceof Error ? error.message : 'Could not update settings.');
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <CommandPalette commands={commands} open={paletteOpen} onOpenChange={setPaletteOpen} />

      <aside
        aria-label="Project explorer"
        className="w-56 shrink-0 overflow-y-auto border-r border-app-border bg-app-surface-1 px-3 py-5"
      >
        <Explorer
          groups={buildExplorer(project, facts, layoutLabel, measuredPages)}
          active={view}
          onSelect={setView}
        />
      </aside>

      <section
        aria-label={VIEW_TITLES[view]}
        className="flex flex-1 flex-col items-start gap-6 overflow-y-auto px-8 py-8"
      >
        <h1 className="sr-only">{project.name}</h1>

        {view === 'dashboard' && (
          <BookDashboard
            project={project}
            facts={facts}
            layoutLabel={layoutLabel}
            themeLabel={themeLabel}
            measuredPages={measuredPages}
            onNavigate={setView}
          />
        )}
        {view === 'structure' && <StructureEditor project={project} onEdited={setProject} />}
        {view === 'validation' && <ReadyForPrint report={project.report} />}
        {view === 'layout' && settingsError && (
          <p className="text-sm text-app-error">{settingsError}</p>
        )}
        {view === 'layout' && options && (
          <FormatSelector
            options={options}
            selectedLayout={project.settings.layoutName}
            selectedTheme={project.settings.themeName}
            onLayoutChange={(layoutName) => void changeSettings({ layoutName })}
            onThemeChange={(themeName) => void changeSettings({ themeName })}
          />
        )}
        {view === 'proof' && (
          <PreviewPanel
            exporter={async () => {
              const started = performance.now();
              const blob = await exportProject(id, 'pdf');
              setStudioFacts({ lastRenderMs: Math.round(performance.now() - started) });
              return blob;
            }}
            settingsKey={settingsKey}
            layoutLabel={layoutLabel}
            themeLabel={themeLabel}
            onPageCount={(pages) => setMeasuredPages(pages ?? undefined)}
          />
        )}
        {view === 'editions' && (
          <PublishDesk
            project={project}
            exporter={async (format) => {
              const blob = await exportProject(id, format);
              setStudioFacts({ lastEdition: `${format.toUpperCase()} edition · just now` });
              return blob;
            }}
            onPublished={reload}
          />
        )}
        {view === 'history' && <Timeline project={project} />}
      </section>

      <aside
        aria-label="Inspector"
        className="hidden w-64 shrink-0 overflow-y-auto border-l border-app-border bg-app-surface-1 px-4 py-5 xl:block"
      >
        <Inspector
          title={VIEW_TITLES[view]}
          rows={inspectorRows(view, project, facts, layoutLabel, themeLabel, measuredPages)}
        />
        {/* Real wall-clock data, masked at baseline-capture time (determinism defect #4). */}
        <p data-baseline-mask className="mt-4 text-xs text-app-text-muted">
          Updated {new Date(project.updatedAt).toLocaleString()}
        </p>
      </aside>
    </div>
  );
}
