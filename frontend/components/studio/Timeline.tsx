'use client';

import type { ProjectDTO } from 'shared-types';

/**
 * History as a timeline (PRODUCT_EXPERIENCE §4.8): the software tells the story. Grouped by
 * day, newest first, from REAL events — import (createdAt is an event), versions,
 * publications with outcomes. "No versions" died: a project one hour old already has a story.
 * Minute-granularity for everything else (settings changes, proofs, editions) arrives with
 * the ProjectEvent log (§10.5, designed with S11/S12) — nothing is faked meanwhile.
 */
interface TimelineEvent {
  at: Date;
  label: string;
  detail?: string;
  tone?: 'success' | 'error';
}

function buildEvents(project: ProjectDTO): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    at: new Date(project.updatedAt),
    label: 'Manuscript in the studio',
    detail: project.sourceFilename ? `from ${project.sourceFilename}` : undefined,
  });

  for (const version of project.versions) {
    events.push({
      at: new Date(version.createdAt),
      label: `Version ${version.number}`,
      detail: version.label,
    });
  }
  for (const event of project.publications) {
    events.push({
      at: new Date(event.occurredAt),
      label: `${event.target.toUpperCase()} validation — ${event.status}`,
      detail: event.versionNumber !== undefined ? `version ${event.versionNumber}` : undefined,
      tone: event.status === 'PASS' ? 'success' : 'error',
    });
  }

  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

export function Timeline({ project }: { project: ProjectDTO }) {
  const events = buildEvents(project);
  const byDay = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const key = event.at.toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {[...byDay.entries()].map(([day, dayEvents]) => (
        <section key={day} aria-label={dayLabel(new Date(day))}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-text-muted">
            {dayLabel(new Date(day))}
          </h3>
          <ol className="flex flex-col border-l-2 border-app-border pl-4">
            {dayEvents.map((event, index) => (
              <li key={index} className="relative py-1.5">
                <span
                  className={`absolute -left-[21px] top-3 h-2 w-2 rounded-full ${
                    event.tone === 'success'
                      ? 'bg-app-success'
                      : event.tone === 'error'
                        ? 'bg-app-error'
                        : 'bg-app-text-muted'
                  }`}
                />
                <p className="text-sm text-app-text">
                  {event.label}
                  {event.detail && <span className="text-app-text-muted"> · {event.detail}</span>}
                </p>
                {/* Wall-clock, masked at baseline capture like every timestamp. */}
                <p data-baseline-mask className="text-xs tabular-nums text-app-text-muted">
                  {event.at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
