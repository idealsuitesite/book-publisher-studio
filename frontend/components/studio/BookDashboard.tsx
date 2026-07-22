'use client';

import { useEffect, useState } from 'react';
import type { ProjectDTO } from 'shared-types';
import type { BookFacts } from '@/lib/bookFacts';
import { Card } from '@/components/ui';

/**
 * The Book dashboard — the center of the studio (PRODUCT_EXPERIENCE §4.2). État, progression,
 * dernière publication, prochaine action — every figure measured or stored, and "next action"
 * DERIVED from the highest-severity real finding, never invented.
 *
 * "La mise en place" (VISUAL_LANGUAGE §6): on first open the desk sets itself — the title
 * settles, then the facts take their places. Magic made of measurements. Respects
 * prefers-reduced-motion via CSS.
 */
interface BookDashboardProps {
  project: ProjectDTO;
  facts: BookFacts;
  layoutLabel: string;
  themeLabel: string;
  measuredPages?: number;
  onNavigate: (view: 'validation' | 'history' | 'editions') => void;
}

function nextAction(project: ProjectDTO): { label: string; view: 'validation' } | null {
  const errors = project.report.issues.filter((issue) => issue.severity === 'ERROR');
  const first = errors[0] ?? project.report.issues[0];
  if (!first) return null;
  return { label: first.suggestion ?? first.message, view: 'validation' };
}

export function BookDashboard({ project, facts, layoutLabel, themeLabel, measuredPages, onNavigate }: BookDashboardProps) {
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const lastPublication = project.publications[project.publications.length - 1];
  const action = nextAction(project);
  const meta = project.book.metadata;

  const settle =
    `transition-all duration-[var(--motion-view)] motion-reduce:transition-none ${
      placed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
    }`;

  const delay = (order: number) => ({ transitionDelay: placed ? `${order * 70}ms` : '0ms' });

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      {/* The book, named in its own voice. */}
      <div className={settle} style={delay(0)}>
        <h2 className="text-3xl font-bold text-app-text" style={{ fontFamily: 'var(--font-book), Georgia, serif' }}>
          {meta.title}
        </h2>
        <p className="mt-1 text-sm text-app-text-muted">
          {meta.author ? `${meta.author} · ` : ''}{meta.language.toUpperCase()} · {themeLabel} · {layoutLabel}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={`px-5 py-4 ${settle}`} style={delay(1)}>
          <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">État</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-app-text">
            {measuredPages ? `${measuredPages} p.` : `${facts.chapters} ch.`}
          </p>
          <p className="mt-1 text-xs tabular-nums text-app-text-muted">
            {project.book.wordCount?.toLocaleString('en-US') ?? '—'} words · {facts.chapters} chapters
            {facts.images > 0 && ` · ${facts.images} images`}
          </p>
        </Card>

        <Card className={`px-5 py-4 ${settle}`} style={delay(2)}>
          <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">Progression</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-app-text">
            {project.report.score.overall}
            <span className="text-sm font-normal text-app-text-muted">/100</span>
          </p>
          <button
            onClick={() => onNavigate('validation')}
            className="mt-1 text-left text-xs text-app-accent underline-offset-2 hover:underline"
          >
            {project.report.issues.length === 0
              ? 'Ready for Print ✓'
              : `${project.report.issues.length} finding${project.report.issues.length > 1 ? 's' : ''} → review`}
          </button>
        </Card>

        <Card className={`px-5 py-4 ${settle}`} style={delay(3)}>
          <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">Dernière publication</p>
          {lastPublication ? (
            <>
              <p className="mt-2 text-2xl font-semibold text-app-text">
                {lastPublication.target.toUpperCase()}
                <span className={`ml-2 text-sm ${lastPublication.status === 'PASS' ? 'text-app-success' : 'text-app-error'}`}>
                  {lastPublication.status}
                </span>
              </p>
              <button
                onClick={() => onNavigate('history')}
                className="mt-1 text-left text-xs text-app-accent underline-offset-2 hover:underline"
              >
                {new Date(lastPublication.occurredAt).toLocaleDateString()} → history
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-app-text-muted">None yet.</p>
              <button
                onClick={() => onNavigate('editions')}
                className="mt-1 text-left text-xs text-app-accent underline-offset-2 hover:underline"
              >
                Create your first edition →
              </button>
            </>
          )}
        </Card>
      </div>

      {action && (
        <Card className={`border-app-warning px-5 py-4 ${settle}`} style={delay(4)}>
          <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">Prochaine action</p>
          <button
            onClick={() => onNavigate(action.view)}
            className="mt-1 text-left text-sm font-medium text-app-text underline-offset-4 hover:underline"
          >
            {action.label} →
          </button>
        </Card>
      )}
    </div>
  );
}
