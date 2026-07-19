'use client';

import type { ProjectDTO } from 'shared-types';
import type { ExportFormat } from '@/lib/api-client';
import { Card } from '@/components/ui';
import { ExportPanel } from '@/components/ExportPanel';
import { PublishPanel } from '@/components/PublishPanel';

/**
 * The Publish desk (PRODUCT_EXPERIENCE §4.7): an architecture, not a button. Four regions,
 * all real today, built for the multi-target future the Sprint-8 RuleProvider port prepared:
 * readiness (one validation, N destinations read it — "sans dupliquer le travail" made
 * structural), destinations (KDP is the one real provider; the column grows as providers
 * land, and empty destination rows are never shown), history, and the last error in full.
 */
interface PublishDeskProps {
  project: ProjectDTO;
  exporter: (format: ExportFormat) => Promise<Blob>;
  onPublished: () => void;
}

export function PublishDesk({ project, exporter, onPublished }: PublishDeskProps) {
  const blocking = project.report.issues.filter((issue) => issue.severity === 'ERROR');
  const lastFail = [...project.publications].reverse().find((event) => event.status === 'FAIL');

  return (
    <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-3 px-6 py-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-app-text-muted">Readiness</h3>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2 text-app-text">
            <span className={blocking.length === 0 ? 'text-app-success' : 'text-app-error'}>
              {blocking.length === 0 ? '✓' : '✗'}
            </span>
            {blocking.length === 0
              ? 'Every blocking check passed'
              : `${blocking.length} blocking finding${blocking.length > 1 ? 's' : ''}`}
          </li>
          <li className="flex items-center gap-2 text-app-text">
            <span className={project.book.metadata.isbn ? 'text-app-success' : 'text-app-warning'}>
              {project.book.metadata.isbn ? '✓' : '⚠'}
            </span>
            ISBN {project.book.metadata.isbn ?? 'missing'}
          </li>
          <li className="flex items-center gap-2 text-app-text">
            <span className="text-app-success">✓</span> PDF · EPUB · DOCX editions available
          </li>
          <li className="flex items-center gap-2 text-app-text">
            <span className="tabular-nums text-app-text-muted">Score {project.report.score.overall}/100</span>
          </li>
        </ul>
      </Card>

      <Card className="flex flex-col gap-3 px-6 py-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-app-text-muted">Publication history</h3>
        {project.publications.length === 0 ? (
          <p className="text-sm text-app-text-muted">No attempts yet — the first one appears here.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-app-text">
            {[...project.publications].reverse().slice(0, 5).map((event, index) => (
              <li key={index} className="flex items-baseline justify-between gap-3">
                <span>
                  <span className="font-medium uppercase">{event.target}</span>
                  <span className={event.status === 'PASS' ? 'text-app-success' : 'text-app-error'}>
                    {' '}
                    {event.status}
                  </span>
                  {event.versionNumber !== undefined && (
                    <span className="text-app-text-muted"> · v{event.versionNumber}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-app-text-muted">
                  {new Date(event.occurredAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
        {lastFail && (
          <div className="mt-1 border-t border-app-border pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">Last rejection</p>
            <p className="mt-1 text-sm text-app-text">
              {lastFail.target.toUpperCase()} · {new Date(lastFail.occurredAt).toLocaleDateString()} — a
              rejection is exactly the history an author needs; the findings live in Ready for Print.
            </p>
          </div>
        )}
      </Card>

      <div className="lg:col-span-2">
        <ExportPanel exporter={exporter} downloadName={project.name} />
      </div>
      <div className="lg:col-span-2">
        <PublishPanel projectId={project.id} onPublished={onPublished} />
      </div>
    </div>
  );
}
